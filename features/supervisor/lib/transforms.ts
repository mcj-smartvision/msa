import { getTaskScheduleStatus, taskEffectiveFinish, taskEffectiveStart } from '@/features/schedule/lib/task-view-date'
import type { InventoryItemRow } from '@/features/storekeeper/lib/types'
import type {
ActualStatus,
LookaheadActivity,
ManpowerSummary,
MaterialResourceRow,
PlannedStatus,
ReadinessLevel,
ReadinessStatus,
ResourceSummary,
SupervisorIssue,
SupervisorKpis,
TodayActivity,
} from '@/features/supervisor/lib/types'
import type { ProjectAlert, ProjectTask } from '@/shared/types/schedule'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function actualStatusFromTask(task: ProjectTask, asOf: string): ActualStatus {
  const schedule = getTaskScheduleStatus(task, asOf)
  if (Number(task.percent_complete) >= 100 || schedule === 'completed') return 'finished'
  if (schedule === 'not_started') return 'notStarted'
  return 'started'
}

export function derivePlannedStatus(task: ProjectTask, asOf: string): PlannedStatus {
  const start = taskEffectiveStart(task)
  const finish = taskEffectiveFinish(task)
  if (finish === asOf) return 'shouldFinish'
  if (start === asOf) return 'shouldStart'
  return 'shouldContinue'
}

/** Project-wide material readiness: one item at/below minimum stock is a warning, three or more is critical. */
function readinessFromInventory(items: InventoryItemRow[]): ReadinessLevel {
  if (items.length === 0) return 'ok'
  const low = items.filter((i) => Number(i.current_stock) <= Number(i.min_stock))
  if (low.length >= 3) return 'critical'
  if (low.length >= 1) return 'warning'
  return 'ok'
}

function deriveReadiness(task: ProjectTask, asOf: string, inventory: InventoryItemRow[]): ReadinessStatus {
  const schedule = getTaskScheduleStatus(task, asOf)
  const invLevel = readinessFromInventory(inventory)
  return {
    materials: task.is_critical && invLevel !== 'ok' ? 'critical' : invLevel,
    manpower: schedule === 'overdue' ? 'warning' : 'ok',
    access: schedule === 'not_started' && task.is_critical ? 'warning' : 'ok',
  }
}

/**
 * Tasks the supervisor should see today: anything whose window covers today, starts or finishes
 * today, or is overdue. Not-yet-started future tasks and finished past tasks are excluded.
 */
export function tasksToTodayActivities(
  tasks: ProjectTask[],
  asOf: string,
  inventory: InventoryItemRow[] = []
): TodayActivity[] {
  return tasks
    .filter((task) => {
      const start = taskEffectiveStart(task)
      const finish = taskEffectiveFinish(task)
      if (!start && !finish) return false
      if (start && start > asOf) return false
      if (finish && finish < asOf && Number(task.percent_complete) >= 100) return false
      if (start && finish && start <= asOf && finish >= asOf) return true
      if (start === asOf || finish === asOf) return true
      if (getTaskScheduleStatus(task, asOf) === 'overdue') return true
      return false
    })
    .map((task) => ({
      id: task.id,
      kind: 'schedule' as const,
      parentId: null,
      depth: 0,
      wbs_code: task.wbs_code ?? '—',
      name: task.name,
      location: undefined,
      is_critical: task.is_critical,
      planned_status: derivePlannedStatus(task, asOf),
      actual_status: actualStatusFromTask(task, asOf),
      actual_progress_percent: Number(task.percent_complete),
      readiness: deriveReadiness(task, asOf, inventory),
      subcontractor_name: undefined,
    }))
}

/** Up to 20 tasks starting within the next 7 days, earliest first. */
export function tasksToLookahead(tasks: ProjectTask[], asOf: string): LookaheadActivity[] {
  const end = addDays(asOf, 7)
  return tasks
    .filter((task) => {
      const start = taskEffectiveStart(task)
      return start && start > asOf && start <= end
    })
    .sort((a, b) => (taskEffectiveStart(a) ?? '').localeCompare(taskEffectiveStart(b) ?? ''))
    .slice(0, 20)
    .map((task) => ({
      id: task.id,
      wbs_code: task.wbs_code ?? '—',
      name: task.name,
      date_planned_start: taskEffectiveStart(task) ?? asOf,
      is_critical: task.is_critical,
      materials_ready: task.is_critical ? 'warning' : 'ok',
      drawings_approved: 'ok' as ReadinessLevel,
      subcontractor_assigned: 'warning' as ReadinessLevel,
    }))
}

export function inventoryToMaterials(items: InventoryItemRow[]): MaterialResourceRow[] {
  return items.map((item) => {
    const stock = Number(item.current_stock)
    const min = Number(item.min_stock)
    let status: ReadinessLevel = 'ok'
    if (stock <= min) status = 'critical'
    else if (stock <= min * 1.5) status = 'warning'
    return {
      id: item.id,
      name: item.name,
      current_stock: stock,
      unit: item.unit,
      min_stock: min,
      estimated_7d_consumption: Math.max(1, Math.round(min * 0.3)),
      status,
    }
  })
}

/**
 * Resource panel data. Materials come from real inventory; crew counts are a rough estimate
 * (one crew per five active tasks) and the equipment list is static placeholder data.
 */
export function buildResourceSummary(items: InventoryItemRow[], taskCount: number): ResourceSummary {
  const materials = inventoryToMaterials(items)
  const crewsNeeded = Math.max(1, Math.ceil(taskCount / 5))
  const manpower: ManpowerSummary = {
    crews_available: Math.max(1, crewsNeeded - 1),
    crews_needed: crewsNeeded,
    shortage_note: crewsNeeded > 1 ? undefined : undefined,
  }
  if (manpower.crews_available < manpower.crews_needed) {
    manpower.shortage_note = 'Possible crew shortage for concurrent activities.'
  }
  return {
    materials,
    manpower,
    equipment: [
      { id: '1', name: 'Tower Crane', status: 'available' },
      { id: '2', name: 'Concrete Pump', status: 'in_use', note: 'Until 16:00' },
    ],
  }
}

export function computeSupervisorKpis(tasks: ProjectTask[], todayActivities: TodayActivity[], asOf: string): SupervisorKpis {
  const active = tasks.filter((t) => getTaskScheduleStatus(t, asOf) !== 'not_started')
  const plannedAvg =
    active.length === 0 ? 0 : Math.round(active.reduce((s, t) => s + 100, 0) / active.length)
  const actualAvg =
    active.length === 0
      ? 0
      : Math.round(active.reduce((s, t) => s + Number(t.percent_complete), 0) / active.length)
  const overdue = todayActivities.filter((a) => a.actual_status !== 'finished' && a.planned_status === 'shouldFinish').length
  const critical = todayActivities.filter((a) => a.is_critical).length
  const readyCount = todayActivities.filter(
    (a) => a.readiness.materials === 'ok' && a.readiness.manpower === 'ok' && a.readiness.access === 'ok'
  ).length
  const readinessScore =
    todayActivities.length === 0 ? 100 : Math.round((readyCount / todayActivities.length) * 100)
  // Heuristic forecast: every 10 points of planned-vs-actual gap ≈ one day of delay.
  const gap = plannedAvg - actualAvg
  const delayDays = gap > 5 ? Math.ceil(gap / 10) : gap > 0 ? 1 : 0

  return {
    plannedPercentToday: plannedAvg,
    actualPercentToday: actualAvg,
    delayDays,
    forecastLabel: delayDays > 0 ? `${delayDays} day(s) behind` : 'On time',
    forecastRisk: delayDays >= 3 ? 'high' : delayDays >= 1 ? 'medium' : 'low',
    todayActivitiesTotal: todayActivities.length,
    todayCritical: critical,
    todayOverdue: overdue,
    readinessScore,
  }
}

export function alertsToIssues(alerts: ProjectAlert[], tasks: ProjectTask[]): SupervisorIssue[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t.name]))
  return alerts.map((alert) => ({
    id: alert.id,
    title: alert.message.slice(0, 80),
    related_task_id: alert.related_task_id ?? undefined,
    related_task_name: alert.related_task_id ? taskMap.get(alert.related_task_id) : undefined,
    type: alert.alert_type === 'material_purchase' ? 'material' : 'other',
    description: alert.message,
    status: alert.is_resolved ? 'closed' : 'open',
    created_at: alert.created_at,
  }))
}
