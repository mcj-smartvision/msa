import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { persistProjectProgressPace } from '@/lib/schedule/persist-progress-pace'
import {
  computeProgressPace,
  paceStatusFa,
  paceThresholdsFromAlertSettings,
  resolvePaceActualStart,
  resolvePaceDurationDays,
} from '@/lib/schedule/progress-pace'
import { DEFAULT_PROJECT_ALERT_SETTINGS } from '@/lib/schedule/float-alerts'
import {
  alertQuadrantFa,
  computeAlertQuadrant,
  type AlertQuadrant,
} from '@/lib/schedule/progress-alert-quadrant'
import { loadProjectAlertSettings } from '@/lib/schedule/run-float-alerts'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import { compareWbs, wbsDepth } from '@/lib/schedule/wbs-utils'
import {
  applyWeightedParentRollup,
  type ProgressRollupNode,
} from '@/lib/schedule/parent-progress-rollup'
import { isDirectChildWbs } from '@/lib/schedule/parent-weight-rollup'

/**
 * GET  — سر‌تیترها / مادرها با رنگ ۲×۲ (فرزندان برگ نمایش داده نمی‌شوند)
 * POST — persist pace columns when migrations applied
 */

const TASK_SELECT_CORE =
  'id, wbs_code, name, parent_id, actual_start, percent_complete, duration_days, status_date, is_summary, is_milestone, is_critical, total_float_days, schedule_weight, start_planned, finish_planned, start_current, finish_current'

const TASK_SELECT_WITH_PHYSICAL = `${TASK_SELECT_CORE}, physical_percent_complete`

async function loadProjectTasksForPace(
  supabase: ReturnType<typeof createClient>,
  projectId: string
) {
  const withPhysical = await supabase
    .from('project_tasks')
    .select(TASK_SELECT_WITH_PHYSICAL)
    .eq('project_id', projectId)

  if (!withPhysical.error) return withPhysical.data ?? []

  const withoutWeight = await supabase
    .from('project_tasks')
    .select(
      'id, wbs_code, name, parent_id, actual_start, percent_complete, duration_days, status_date, is_summary, is_milestone, is_critical, total_float_days, start_planned, finish_planned, start_current, finish_current, physical_percent_complete'
    )
    .eq('project_id', projectId)
  if (!withoutWeight.error) return withoutWeight.data ?? []

  const core = await supabase
    .from('project_tasks')
    .select(
      'id, wbs_code, name, parent_id, actual_start, percent_complete, duration_days, status_date, is_summary, is_milestone, is_critical, total_float_days, start_planned, finish_planned, start_current, finish_current'
    )
    .eq('project_id', projectId)
  if (core.error) throw new Error(core.error.message)
  return core.data ?? []
}

function taskPhysical(t: Record<string, unknown>): number {
  const physicalRaw = t.physical_percent_complete
  if (physicalRaw != null && Number.isFinite(Number(physicalRaw))) {
    return Number(physicalRaw)
  }
  return Number(t.percent_complete) || 0
}

function isHeaderMother(
  t: {
    id: string
    wbs_code?: string | null
    is_summary?: boolean | null
    is_milestone?: boolean | null
    parent_id?: string | null
  },
  motherIds: Set<string>
): boolean {
  if (t.is_milestone) return false
  // مادر واقعی (فرزند دارد) یا summary
  if (motherIds.has(t.id) || t.is_summary) return true
  // سر تیتر سطح اول حتی اگر برگ باشد (مثل خاکبرداری)
  if (wbsDepth(t.wbs_code) === 0) return true
  return false
}

function descendantLeafStats(
  parentWbs: string | null,
  leaves: Array<{
    wbs: string | null
    isCritical: boolean
    totalFloatDays: number | null
    physicalPercent: number
  }>
): { isCritical: boolean; totalFloatDays: number | null } {
  if (!parentWbs?.trim()) {
    return { isCritical: false, totalFloatDays: null }
  }
  const under = leaves.filter((l) => {
    const w = l.wbs?.trim()
    if (!w) return false
    return w === parentWbs || w.startsWith(`${parentWbs}.`)
  })
  if (under.length === 0) return { isCritical: false, totalFloatDays: null }

  const isCritical = under.some((l) => l.isCritical)
  let minFloat: number | null = null
  for (const l of under) {
    if (l.totalFloatDays == null || !Number.isFinite(l.totalFloatDays)) continue
    if (minFloat == null || l.totalFloatDays < minFloat) minFloat = l.totalFloatDays
  }
  return { isCritical, totalFloatDays: minFloat }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const statusDateParam = request.nextUrl.searchParams.get('statusDate')
    const fallbackStatus =
      toIsoDateOnly(statusDateParam) ?? new Date().toISOString().slice(0, 10)

    const [tasks, calcsResult] = await Promise.all([
      loadProjectTasksForPace(supabase, projectId),
      supabase
        .from('schedule_calculations')
        .select('task_id, total_float, is_critical')
        .eq('project_id', projectId),
    ])

    const calcs = calcsResult.data
    const calcByTask = new Map(
      (calcs ?? []).map((c) => [
        c.task_id as string,
        { totalFloat: Number(c.total_float), isCritical: Boolean(c.is_critical) },
      ])
    )

    let alertSettings = { ...DEFAULT_PROJECT_ALERT_SETTINGS }
    try {
      alertSettings = await loadProjectAlertSettings(supabase, projectId)
    } catch {
      // optional
    }
    const paceThresholds = paceThresholdsFromAlertSettings(alertSettings)
    const nearCriticalDays = alertSettings.nearCriticalDays

    const all = (tasks ?? []) as Array<Record<string, unknown>>

    const rollupNodes: ProgressRollupNode[] = all
      .filter((t) => !t.is_milestone)
      .map((t) => ({
        id: String(t.id),
        wbs: (t.wbs_code as string | null) ?? null,
        name: String(t.name ?? ''),
        weight:
          t.schedule_weight != null && Number.isFinite(Number(t.schedule_weight))
            ? Number(t.schedule_weight)
            : null,
        percent: taskPhysical(t),
      }))

    const { percents: rolledPercents, parentIds: motherIds } =
      applyWeightedParentRollup(rollupNodes)

    // Also mark mothers via parent_id
    for (const t of all) {
      const pid = t.parent_id as string | null
      if (pid) motherIds.add(pid)
    }
    // WBS-based mothers (in case parent_id missing)
    for (const t of all) {
      const wbs = (t.wbs_code as string | null)?.trim()
      if (!wbs) continue
      for (const other of all) {
        const ow = (other.wbs_code as string | null)?.trim()
        if (ow && isDirectChildWbs(wbs, ow)) {
          motherIds.add(String(t.id))
          break
        }
      }
    }

    const leafMeta = all
      .filter((t) => !t.is_summary && !t.is_milestone && !motherIds.has(String(t.id)))
      .map((t) => {
        const id = String(t.id)
        const calc = calcByTask.get(id)
        return {
          wbs: (t.wbs_code as string | null) ?? null,
          isCritical: Boolean(calc?.isCritical ?? t.is_critical),
          totalFloatDays:
            calc?.totalFloat != null && Number.isFinite(calc.totalFloat)
              ? calc.totalFloat
              : t.total_float_days != null && Number.isFinite(Number(t.total_float_days))
                ? Number(t.total_float_days)
                : null,
          physicalPercent: taskPhysical(t),
        }
      })

    const headerRows = all
      .filter((t) =>
        isHeaderMother(
          {
            id: String(t.id),
            wbs_code: t.wbs_code as string | null,
            is_summary: t.is_summary as boolean | null,
            is_milestone: t.is_milestone as boolean | null,
            parent_id: t.parent_id as string | null,
          },
          motherIds
        )
      )
      .sort((a, b) =>
        compareWbs(a.wbs_code as string | null, b.wbs_code as string | null)
      )
      .map((t) => {
        const id = String(t.id)
        const calc = calcByTask.get(id)
        const wbs = (t.wbs_code as string | null) ?? null

        const ownPhysical = taskPhysical(t)
        const rolled = rolledPercents[id]
        const physical =
          motherIds.has(id) && rolled != null
            ? rolled
            : ownPhysical > 0
              ? ownPhysical
              : rolled ?? ownPhysical

        const fromKids = descendantLeafStats(wbs, leafMeta)
        const isCritical = Boolean(
          calc?.isCritical ?? t.is_critical ?? fromKids.isCritical
        )
        let totalFloatDays: number | null =
          calc?.totalFloat != null && Number.isFinite(calc.totalFloat)
            ? calc.totalFloat
            : t.total_float_days != null && Number.isFinite(Number(t.total_float_days))
              ? Number(t.total_float_days)
              : null
        if (totalFloatDays == null) totalFloatDays = fromKids.totalFloatDays
        // مادر بحرانی اگر هر فرزند برگش بحرانی باشد
        const criticalFlag = isCritical || fromKids.isCritical

        const effectiveStart = resolvePaceActualStart({
          actualStart: t.actual_start as string | null,
          physicalPercentComplete: physical,
          startCurrent: t.start_current as string | null,
          startPlanned: t.start_planned as string | null,
          allowZeroProgress: true,
        })
        const durationDays = resolvePaceDurationDays({
          durationDays: t.duration_days as number | null,
          startCurrent: t.start_current as string | null,
          startPlanned: t.start_planned as string | null,
          finishCurrent: t.finish_current as string | null,
          finishPlanned: t.finish_planned as string | null,
        })

        // physical 100 → pace null در compute؛ برای ۰٪ اگر تاریخ شروع گذشته باشد نرخ می‌آید
        const livePhysical = physical >= 100 ? 100 : physical
        const live = computeProgressPace({
          actualStart: effectiveStart,
          physicalPercentComplete: livePhysical,
          durationDays,
          statusDate: toIsoDateOnly(t.status_date as string | null) ?? fallbackStatus,
          isSummary: Boolean(t.is_summary),
          isMilestone: false,
          includeSummary: true,
          paceThresholds,
        })

        // برای ۱۰۰٪: بدون نمایش هشدار؛ برای ۰٪ قبل از شروع: بدون دسته تا وقتی نرخ معنا دارد
        let alertQuadrant: AlertQuadrant | null = computeAlertQuadrant({
          paceStatus: live.paceStatus,
          isCritical: criticalFlag,
          totalFloatDays,
          nearCriticalDays,
        })
        if (physical >= 100) {
          alertQuadrant = 'no_display'
        }

        const quadrantLabel =
          physical >= 100
            ? 'تمام‌شده'
            : alertQuadrant
              ? alertQuadrantFa(alertQuadrant)
              : physical <= 0
                ? 'شروع‌نشده'
                : '—'

        return {
          id,
          wbs,
          name: String(t.name ?? ''),
          actualStart: effectiveStart,
          physicalPercent: physical,
          durationDays,
          expectedPercent: live.expectedPercent,
          elapsedDays: live.elapsedDays,
          paceRatio: live.paceRatio,
          paceStatus: live.paceStatus,
          paceStatusFa: paceStatusFa(live.paceStatus),
          isCritical: criticalFlag,
          totalFloatDays,
          alertQuadrant,
          alertQuadrantFa: quadrantLabel,
          isHeader: true,
        }
      })

    // همهٔ سر‌تیترها / مادرهای برنامه — رنگ از ۲×۲ وقتی نرخ قابل محاسبه باشد
    const displayRows = headerRows

    const inProgress = displayRows.filter((r) => r.paceStatus != null)
    const counts = {
      good: inProgress.filter((r) => r.paceStatus === 'good').length,
      warning: inProgress.filter((r) => r.paceStatus === 'warning').length,
      bad: inProgress.filter((r) => r.paceStatus === 'bad').length,
      total: displayRows.length,
      urgent: displayRows.filter((r) => r.alertQuadrant === 'urgent').length,
      normalWatch: displayRows.filter((r) => r.alertQuadrant === 'normal_watch').length,
      softNotice: displayRows.filter((r) => r.alertQuadrant === 'soft_notice').length,
      noDisplay: displayRows.filter((r) => r.alertQuadrant === 'no_display').length,
      notStarted: displayRows.filter(
        (r) => r.physicalPercent <= 0 && r.paceStatus == null
      ).length,
      completed: displayRows.filter((r) => r.physicalPercent >= 100).length,
    }

    return NextResponse.json({
      projectId,
      statusDate: fallbackStatus,
      settings: {
        paceGoodThreshold: alertSettings.paceGoodThreshold,
        paceWarningThreshold: alertSettings.paceWarningThreshold,
        nearCriticalDays: alertSettings.nearCriticalDays,
      },
      counts,
      rows: displayRows,
      allRows: headerRows,
      scope: 'all_headers',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load progress pace'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const projectId = String(body.projectId ?? body.project_id ?? '')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const result = await persistProjectProgressPace(supabase, projectId, {
      statusDate: body.statusDate ?? body.status_date ?? null,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to recompute progress pace'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
