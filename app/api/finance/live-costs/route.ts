import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { WorkshopError } from '@/lib/workshop/domain'
import { workshopErrorResponse } from '@/lib/workshop/service'
import { readPackageUnitPrice } from '@/lib/workshop/package-commercial'
import {
  packageSchedulePhysicalPercent,
  schedulePhysicalPercent,
} from '@/lib/schedule/physical-progress'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import {
  enumerateProjectJalaliMonths,
  projectDateSpan,
} from '@/lib/schedule/monthly-deducted-weight'
import { deductedMonthFromLabel } from '@/lib/finance/overhead-schedule-months'
import {
  TOMAN_SCALE,
  buildLiveWorkshopCostModel,
  type ContractorActivityCost,
  type OverheadMonthAmount,
} from '@/lib/finance/live-workshop-cost'

function taskDates(row: Record<string, unknown>): { start: string | null; finish: string | null } {
  return {
    start: toIsoDateOnly(
      (row.start_current as string) ??
        (row.start_planned as string) ??
        (row.baseline_start as string) ??
        null
    ),
    finish: toIsoDateOnly(
      (row.finish_current as string) ??
        (row.finish_planned as string) ??
        (row.baseline_finish as string) ??
        null
    ),
  }
}

function isLeafTask(
  row: Record<string, unknown>,
  tasks: Array<Record<string, unknown>>,
  packages: Array<Record<string, unknown>>
): boolean {
  const id = String(row.id)
  if (row.is_summary) return false
  if (packages.some((pkg) => String(pkg.project_task_id ?? '') === id)) return false
  if (tasks.some((other) => String(other.parent_id ?? '') === id)) return false
  const wbs = String(row.wbs_code ?? '').trim()
  if (
    wbs &&
    tasks.some(
      (other) =>
        String(other.id) !== id && String(other.wbs_code ?? '').trim().startsWith(`${wbs}.`)
    )
  ) {
    return false
  }
  return true
}

function isLeafPackage(
  row: Record<string, unknown>,
  packages: Array<Record<string, unknown>>
): boolean {
  const id = String(row.id)
  return !packages.some((other) => String(other.parent_package_id ?? '') === id)
}

function todayIsoTehran(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })
}

function yearFromLabels(labels: string[]): number | null {
  for (const label of labels) {
    const match = String(label).match(/(13|14)\d{2}/)
    if (match) return Number(match[0])
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const todayIso = todayIsoTehran()

    const [
      { data: workbookRow },
      { data: tasks, error: taskError },
      { data: packages, error: packageError },
      progressRes,
    ] = await Promise.all([
      supabase
        .from('project_overhead_workbooks')
        .select('month_labels, categories')
        .eq('project_id', projectId)
        .maybeSingle(),
      supabase.from('project_tasks').select('*').eq('project_id', projectId),
      supabase.from('workshop_packages').select('*').eq('project_id', projectId),
      supabase
        .from('task_progress_updates')
        .select('task_id, progress_date, percent_complete')
        .eq('project_id', projectId)
        .order('progress_date', { ascending: true }),
    ])

    if (taskError) throw new WorkshopError('VALIDATION', taskError.message)
    if (packageError) throw new WorkshopError('VALIDATION', packageError.message)
    const progressRows =
      progressRes.error &&
      /task_progress_updates|schema cache|does not exist/i.test(progressRes.error.message)
        ? []
        : (progressRes.data ?? [])

    const overheadMonths: OverheadMonthAmount[] = []
    const labels = Array.isArray(workbookRow?.month_labels)
      ? (workbookRow.month_labels as string[])
      : []
    const categories = Array.isArray(workbookRow?.categories)
      ? (workbookRow.categories as Array<{ months?: Array<string | number> }>)
      : []
    if (labels.length > 0) {
      const year = yearFromLabels(labels)
      labels.forEach((label, index) => {
        const month = deductedMonthFromLabel(label, index, year)
        if (!month.startIso || !month.endIso) return
        const stored = categories.reduce((sum, category) => {
          const raw = category.months?.[index]
          const value = Number(raw)
          return sum + (Number.isFinite(value) ? value : 0)
        }, 0)
        overheadMonths.push({
          startIso: month.startIso,
          endIso: month.endIso,
          label: month.label,
          amountToman: stored * TOMAN_SCALE,
        })
      })
    }

    const historyById = new Map<string, Array<{ date: string; percent: number }>>()
    for (const row of progressRows ?? []) {
      const id = String((row as { task_id?: string }).task_id ?? '').replace(/^package:/, '')
      const date = toIsoDateOnly((row as { progress_date?: string }).progress_date ?? null)
      const percent = Number((row as { percent_complete?: number }).percent_complete)
      if (!id || !date || !Number.isFinite(percent)) continue
      const list = historyById.get(id) ?? []
      list.push({ date, percent })
      historyById.set(id, list)
    }

    const taskRows = (tasks ?? []) as Array<Record<string, unknown>>
    const packageRows = (packages ?? []) as Array<Record<string, unknown>>
    const activities: ContractorActivityCost[] = []
    const dateSpanItems: Array<{ startDate: string | null; finishDate: string | null }> = []

    for (const row of taskRows) {
      if (!isLeafTask(row, taskRows, packageRows)) continue
      const dates = taskDates(row)
      dateSpanItems.push({ startDate: dates.start, finishDate: dates.finish })
      activities.push({
        id: String(row.id),
        contractValue: (Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
        currentPercent: schedulePhysicalPercent(row) ?? 0,
        start: dates.start,
        finish: dates.finish,
        progressHistory: historyById.get(String(row.id)) ?? [],
      })
    }

    for (const row of packageRows) {
      if (!isLeafPackage(row, packageRows)) continue
      const fields =
        row.schedule_fields && typeof row.schedule_fields === 'object'
          ? (row.schedule_fields as Record<string, unknown>)
          : {}
      const dates = {
        start: toIsoDateOnly((row.start_date as string) ?? null),
        finish: toIsoDateOnly((row.finish_date as string) ?? null),
      }
      dateSpanItems.push({ startDate: dates.start, finishDate: dates.finish })
      activities.push({
        id: String(row.id),
        contractValue: (Number(row.quantity) || 0) * readPackageUnitPrice(row),
        currentPercent: packageSchedulePhysicalPercent(fields) ?? 0,
        start: dates.start,
        finish: dates.finish,
        progressHistory: historyById.get(String(row.id)) ?? [],
      })
    }

    const span = projectDateSpan(dateSpanItems)
    const start = span.start ?? overheadMonths[0]?.startIso ?? todayIso
    const months = enumerateProjectJalaliMonths(start, todayIso)
    const model = buildLiveWorkshopCostModel({
      overheadMonths:
        overheadMonths.length > 0
          ? overheadMonths
          : months.map((month) => ({
              startIso: month.startIso,
              endIso: month.endIso,
              label: month.label,
              amountToman: 0,
            })),
      activities,
      todayIso,
    })

    return NextResponse.json(
      {
        ...model,
        activityCount: activities.length,
        monthLabels: overheadMonths.map((month) => month.label),
        monthAmounts: overheadMonths.map((month) => month.amountToman),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
