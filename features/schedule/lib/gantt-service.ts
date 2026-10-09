import type { SupabaseClient } from '@supabase/supabase-js'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import {
applyDateChangeWithSuccessorCascade,
type CascadeDependency,
} from '@/features/schedule/lib/cascade-successors'
import {
durationDaysFromRange,
linkParentsFromWbs,
type GanttDateNode,
} from '@/features/schedule/lib/gantt-parent-expand'
import type { GanttLinkDto } from '@/features/schedule/lib/gantt-link-paths'
import {
pickHighestAlertSeverity,
resolveGanttBarTone,
type GanttBarTone,
} from '@/features/schedule/lib/gantt-tone'
import type { AlertQuadrant } from '@/features/schedule/lib/progress-alert-quadrant'
import {
packageSchedulePhysicalPercent,
schedulePhysicalPercent,
} from '@/features/schedule/lib/physical-progress'
import type { ScheduleAlertSeverity } from '@/features/schedule/lib/float-alerts'
import { DEFAULT_MSP_MINUTES_PER_DAY } from '@/features/schedule/lib/predecessor-format'
import type { TaskRelationType } from '@/shared/types/schedule'
import { compareWbs, wbsDepth } from '@/features/schedule/lib/wbs-utils'
import { loadProjectAlertSettings } from '@/features/schedule/lib/run-float-alerts'
import { DEFAULT_PROJECT_ALERT_SETTINGS } from '@/features/schedule/lib/float-alerts'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { getWorkshopCapabilities } from '@/features/workshop/lib/service'
import { WorkshopError } from '@/features/workshop/lib/domain'

export interface GanttRowDto {
  id: string
  name: string
  wbs: string | null
  parentId: string | null
  depth: number
  startDate: string | null
  finishDate: string | null
  durationDays: number
  isSummary: boolean
  isMilestone: boolean
  isCritical: boolean
  totalFloat: number | null
  alertSeverity: ScheduleAlertSeverity | null
  tone: GanttBarTone
  /** Physical percent complete (0–100), null when never recorded. */
  percentComplete: number | null
  /** workshop package row (appears under MSP parent; not CPM-editable) */
  kind?: 'task' | 'package'
}

/** Cap float line so one outlier doesn't blow up the whole chart width. */
export const GANTT_FLOAT_DISPLAY_CAP_DAYS = 21

function clampPercent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

/** Percent columns vary by deployment, so failures here only drop the progress fill. */
async function loadTaskPercents(
  supabase: SupabaseClient,
  projectId: string
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  for (const columns of [
    'id, physical_percent_complete, percent_complete',
    'id, physical_percent_complete',
  ]) {
    const { data, error } = await supabase
      .from('project_tasks')
      .select(columns)
      .eq('project_id', projectId)
    if (error) continue
    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      out.set(
        String(row.id),
        clampPercent(
          schedulePhysicalPercent({
            physical_percent_complete: row.physical_percent_complete as number | null | undefined,
            percent_complete: row.percent_complete as number | null | undefined,
          })
        )
      )
    }
    break
  }
  return out
}

async function loadPackagePercents(
  supabase: SupabaseClient,
  projectId: string
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  const { data, error } = await supabase
    .from('workshop_packages')
    .select('id, schedule_fields')
    .eq('project_id', projectId)
  if (error) return out
  for (const row of data ?? []) {
    const fields =
      row.schedule_fields && typeof row.schedule_fields === 'object'
        ? (row.schedule_fields as Record<string, unknown>)
        : null
    out.set(String(row.id), clampPercent(packageSchedulePhysicalPercent(fields)))
  }
  return out
}

export async function getProjectGanttRows(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ rows: GanttRowDto[]; links: GanttLinkDto[]; readOnly: boolean }> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const capabilities = await getWorkshopCapabilities(supabase, projectId)

  let nearCriticalDays = DEFAULT_PROJECT_ALERT_SETTINGS.nearCriticalDays
  try {
    const alertSettings = await loadProjectAlertSettings(supabase, projectId)
    nearCriticalDays = alertSettings.nearCriticalDays
  } catch {
    // optional
  }

  const [
    tasksResult,
    { data: calcs },
    { data: alerts },
    { data: packages },
    { data: deps, error: depsError },
    taskPercents,
    packagePercents,
  ] = await Promise.all([
    supabase
      .from('project_tasks')
      .select(
        'id, name, wbs_code, parent_id, duration_days, is_summary, is_milestone, is_critical, alert_quadrant, start_planned, finish_planned, start_current, finish_current'
      )
      .eq('project_id', projectId)
      .order('wbs_code', { ascending: true }),
    supabase
      .from('schedule_calculations')
      .select('task_id, total_float, is_critical')
      .eq('project_id', projectId),
    supabase
      .from('schedule_alerts')
      .select('activity_id, severity')
      .eq('project_id', projectId)
      .eq('acknowledged', false),
    supabase
      .from('workshop_packages')
      .select('id, name, wbs_code, project_task_id, parent_package_id, start_date, finish_date')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    supabase
      .from('task_dependencies')
      .select('predecessor_task_id, successor_task_id, relation_type, lag_duration')
      .eq('project_id', projectId),
    loadTaskPercents(supabase, projectId),
    loadPackagePercents(supabase, projectId),
  ])

  let tasks = tasksResult.data
  let tasksError = tasksResult.error
  if (tasksError && /alert_quadrant|does not exist|42703/i.test(tasksError.message)) {
    const fallback = await supabase
      .from('project_tasks')
      .select(
        'id, name, wbs_code, parent_id, duration_days, is_summary, is_milestone, is_critical, start_planned, finish_planned, start_current, finish_current'
      )
      .eq('project_id', projectId)
      .order('wbs_code', { ascending: true })
    tasks = (fallback.data ?? []).map((task) => ({ ...task, alert_quadrant: null }))
    tasksError = fallback.error
  }

  if (tasksError) throw new WorkshopError('VALIDATION', tasksError.message)
  if (depsError && depsError.code !== '42P01') {
    throw new WorkshopError('VALIDATION', depsError.message)
  }

  const calcByTask = new Map(
    (calcs ?? []).map((c) => [
      c.task_id as string,
      { totalFloat: Number(c.total_float), isCritical: Boolean(c.is_critical) },
    ])
  )

  const alertsByTask = new Map<string, ScheduleAlertSeverity[]>()
  for (const a of alerts ?? []) {
    const id = a.activity_id as string
    const list = alertsByTask.get(id) ?? []
    list.push(a.severity as ScheduleAlertSeverity)
    alertsByTask.set(id, list)
  }

  const rows: GanttRowDto[] = (tasks ?? [])
    .map((t) => {
      // Match workshop schedule table: current dates after reschedule, else planned.
      const start = toIsoDateOnly(t.start_current) ?? toIsoDateOnly(t.start_planned)
      const finish = toIsoDateOnly(t.finish_current) ?? toIsoDateOnly(t.finish_planned)
      const calc = calcByTask.get(t.id as string)
      const alertSeverity = pickHighestAlertSeverity(alertsByTask.get(t.id as string) ?? [])
      const isCritical = Boolean(calc?.isCritical ?? t.is_critical)
      const totalFloat = calc?.totalFloat ?? null

      const spanDays = start && finish ? durationDaysFromRange(start, finish) : 0
      const durationDays =
        start && finish
          ? Math.max(spanDays, 0)
          : t.duration_days != null && Number.isFinite(Number(t.duration_days))
            ? Math.max(0, Number(t.duration_days))
            : 0

      const isMilestone =
        Boolean(t.is_milestone) ||
        (!t.is_summary && Boolean(start) && Boolean(finish) && spanDays === 0)

      const percentComplete = taskPercents.get(t.id as string) ?? null
      const tone = resolveGanttBarTone({
        isCritical,
        totalFloat,
        alertSeverity,
        alertQuadrant:
          'alert_quadrant' in (t as object)
            ? ((t as { alert_quadrant?: AlertQuadrant | null }).alert_quadrant ?? null)
            : null,
        nearCriticalDays,
        percentComplete,
      })

      return {
        id: t.id as string,
        name: String(t.name ?? ''),
        wbs: (t.wbs_code as string | null)?.trim() || null,
        parentId: (t.parent_id as string | null) ?? null,
        depth: wbsDepth(t.wbs_code as string | null),
        startDate: start,
        finishDate: finish,
        durationDays,
        isSummary: Boolean(t.is_summary),
        isMilestone,
        isCritical,
        totalFloat,
        alertSeverity,
        tone,
        percentComplete,
        kind: 'task' as const,
      } satisfies GanttRowDto
    })
    .sort((a, b) => compareWbs(a.wbs, b.wbs))

  // Display rollup: header bars always span all direct children (expand + shrink)
  const dateNodes: GanttDateNode[] = rows
    .filter((r) => r.startDate && r.finishDate)
    .map((r) => ({
      id: r.id,
      parentId: r.parentId,
      wbs: r.wbs,
      start: r.startDate!,
      finish: r.finishDate!,
    }))
  linkParentsFromWbs(dateNodes)
  const byId = new Map(dateNodes.map((n) => [n.id, n]))
  const childrenByParent = new Map<string, GanttDateNode[]>()
  for (const n of dateNodes) {
    if (!n.parentId) continue
    const list = childrenByParent.get(n.parentId) ?? []
    list.push(n)
    childrenByParent.set(n.parentId, list)
  }
  // Bottom-up: deeper WBS first so parents use rolled children
  const parents = dateNodes
    .filter((n) => childrenByParent.has(n.id))
    .sort((a, b) => compareWbs(b.wbs, a.wbs))
  for (const parent of parents) {
    const kids = childrenByParent.get(parent.id) ?? []
    let coverStart: string | null = null
    let coverFinish: string | null = null
    for (const kid of kids) {
      const node = byId.get(kid.id) ?? kid
      if (!coverStart || node.start < coverStart) coverStart = node.start
      if (!coverFinish || node.finish > coverFinish) coverFinish = node.finish
    }
    if (!coverStart || !coverFinish) continue
    parent.start = coverStart
    parent.finish = coverFinish
    byId.set(parent.id, parent)
  }

  for (const row of rows) {
    const rolled = byId.get(row.id)
    if (!rolled || !childrenByParent.has(row.id)) continue
    row.startDate = rolled.start
    row.finishDate = rolled.finish
    row.durationDays = durationDaysFromRange(rolled.start, rolled.finish)
  }

  // Workshop packages as child bars under their schedule parent (same dates as parent leaf)
  const taskIndex = new Map(rows.map((r) => [r.id, r]))
  const pkgById = new Map(
    (packages ?? []).map((p) => [String(p.id), p as Record<string, unknown>])
  )

  function resolveScheduleTaskId(pkg: Record<string, unknown>): string | null {
    let cur: Record<string, unknown> | undefined = pkg
    const guard = new Set<string>()
    while (cur) {
      const id = String(cur.id)
      if (guard.has(id)) break
      guard.add(id)
      const taskId = cur.project_task_id ? String(cur.project_task_id) : null
      if (taskId && taskIndex.has(taskId)) return taskId
      const parentPkgId = cur.parent_package_id ? String(cur.parent_package_id) : null
      if (!parentPkgId) return taskId
      cur = pkgById.get(parentPkgId)
    }
    return null
  }

  const packageRows: GanttRowDto[] = []
  for (const raw of packages ?? []) {
    const pkg = raw as Record<string, unknown>
    const scheduleTaskId = resolveScheduleTaskId(pkg)
    if (!scheduleTaskId) continue
    const parentTask = taskIndex.get(scheduleTaskId)
    if (!parentTask) continue

    const parentPkgId = pkg.parent_package_id ? String(pkg.parent_package_id) : null
    const ganttParentId = parentPkgId ? `pkg:${parentPkgId}` : scheduleTaskId
    const wbs =
      ((pkg.wbs_code as string | null)?.trim() || null) ??
      (parentTask.wbs ? `${parentTask.wbs}.p` : null)
    const startDate =
      toIsoDateOnly(pkg.start_date as string | null | undefined) ?? parentTask.startDate
    const finishDate =
      toIsoDateOnly(pkg.finish_date as string | null | undefined) ?? parentTask.finishDate
    if (!startDate || !finishDate) continue
    const spanDays = durationDaysFromRange(startDate, finishDate)
    const percentComplete = packagePercents.get(String(pkg.id)) ?? null

    packageRows.push({
      id: `pkg:${String(pkg.id)}`,
      name: String(pkg.name ?? 'زیرمجموعه'),
      wbs,
      parentId: ganttParentId,
      depth: (parentTask.depth ?? 0) + (parentPkgId ? 2 : 1),
      startDate,
      finishDate,
      durationDays: spanDays,
      isSummary: false,
      isMilestone: false,
      isCritical: false,
      totalFloat: null,
      alertSeverity: null,
      tone: resolveGanttBarTone({ percentComplete }),
      percentComplete,
      kind: 'package',
    })
  }

  const merged = [...rows, ...packageRows].sort((a, b) => compareWbs(a.wbs, b.wbs))

  const dayLen = DEFAULT_MSP_MINUTES_PER_DAY
  const taskIdSet = new Set(rows.map((r) => r.id))
  const links: GanttLinkDto[] = (deps ?? [])
    .map((d) => {
      const predecessorId = d.predecessor_task_id as string
      const successorId = d.successor_task_id as string
      if (!taskIdSet.has(predecessorId) || !taskIdSet.has(successorId)) return null
      const lagMin = Number(d.lag_duration) || 0
      return {
        predecessorId,
        successorId,
        type: ((d.relation_type as TaskRelationType) || 'FS') as TaskRelationType,
        lagDays: lagMin && dayLen > 0 ? Math.round(lagMin / dayLen) : 0,
      } satisfies GanttLinkDto
    })
    .filter((x): x is GanttLinkDto => x != null)

  return { rows: merged, links, readOnly: capabilities.readOnly }
}

export async function updateGanttTaskDates(
  supabase: SupabaseClient,
  input: {
    projectId: string
    taskId: string
    startDate: string
    finishDate: string
  }
): Promise<{ updated: Array<{ id: string; startDate: string; finishDate: string; durationDays: number }> }> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, input.projectId)
  const capabilities = await getWorkshopCapabilities(supabase, input.projectId)
  if (!capabilities.canWrite) {
    throw new WorkshopError('FORBIDDEN', 'اجازه ویرایش برنامه را ندارید')
  }

  const start = toIsoDateOnly(input.startDate)
  const finish = toIsoDateOnly(input.finishDate)
  if (!start || !finish) {
    throw new WorkshopError('VALIDATION', 'تاریخ شروع/پایان نامعتبر است')
  }
  if (finish < start) {
    throw new WorkshopError('VALIDATION', 'پایان نمی‌تواند قبل از شروع باشد')
  }

  const [{ data: tasks, error }, { data: deps, error: depsError }] = await Promise.all([
    supabase
      .from('project_tasks')
      .select(
        'id, parent_id, wbs_code, is_summary, start_planned, finish_planned, start_current, finish_current'
      )
      .eq('project_id', input.projectId),
    supabase
      .from('task_dependencies')
      .select('predecessor_task_id, successor_task_id, relation_type, lag_duration')
      .eq('project_id', input.projectId),
  ])
  if (error) throw new WorkshopError('VALIDATION', error.message)
  if (depsError) throw new WorkshopError('VALIDATION', depsError.message)

  const nodes = (tasks ?? []).map((t) => {
    const s = toIsoDateOnly(t.start_current) ?? toIsoDateOnly(t.start_planned) ?? start
    const f = toIsoDateOnly(t.finish_current) ?? toIsoDateOnly(t.finish_planned) ?? finish
    return {
      id: t.id as string,
      parentId: (t.parent_id as string | null) ?? null,
      wbs: (t.wbs_code as string | null)?.trim() || null,
      start: s,
      finish: f,
      isSummary: Boolean(t.is_summary),
    }
  })

  if (!nodes.some((n) => n.id === input.taskId)) {
    throw new WorkshopError('NOT_FOUND', 'فعالیت پیدا نشد')
  }

  const dayLen = DEFAULT_MSP_MINUTES_PER_DAY
  const cascadeDeps: CascadeDependency[] = (deps ?? []).map((d) => ({
    predecessorId: d.predecessor_task_id as string,
    successorId: d.successor_task_id as string,
    type: (d.relation_type as TaskRelationType) || 'FS',
    lagDays:
      Number(d.lag_duration) && dayLen > 0
        ? Math.round(Number(d.lag_duration) / dayLen)
        : 0,
  }))

  const changed = applyDateChangeWithSuccessorCascade(
    nodes,
    input.taskId,
    start,
    finish,
    cascadeDeps
  )
  if (changed.length === 0) {
    throw new WorkshopError('VALIDATION', 'تغییر تاریخ اعمال نشد')
  }

  for (const row of changed) {
    const durationDays = durationDaysFromRange(row.start, row.finish)
    const patch: Record<string, unknown> = {
      start_current: `${row.start}T12:00:00.000Z`,
      finish_current: `${row.finish}T12:00:00.000Z`,
      duration_days: durationDays,
      start_planned: `${row.start}T12:00:00.000Z`,
      finish_planned: `${row.finish}T12:00:00.000Z`,
    }
    const { error: updError } = await supabase
      .from('project_tasks')
      .update(patch)
      .eq('id', row.id)
      .eq('project_id', input.projectId)
    if (updError) throw new WorkshopError('VALIDATION', updError.message)
  }

  return {
    updated: changed.map((row) => ({
      id: row.id,
      startDate: row.start,
      finishDate: row.finish,
      durationDays: durationDaysFromRange(row.start, row.finish),
    })),
  }
}
