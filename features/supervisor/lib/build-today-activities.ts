import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import type { InventoryItemRow } from '@/features/storekeeper/lib/types'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import { collectScheduleTaskNodes } from '@/features/workshop/lib/wbs-numbering'
import type { ProjectTask } from '@/shared/types/schedule'
import {
derivePlannedStatus,
tasksToTodayActivities,
} from '@/features/supervisor/lib/transforms'
import type { ActualStatus, TodayActivity } from '@/features/supervisor/lib/types'
import { getTaskScheduleStatus, taskEffectiveFinish } from '@/features/schedule/lib/task-view-date'

type TodayAssignmentRow = {
  id: string
  planned_qty: number
  workshop_packages?: {
    id?: string
    project_task_id?: string | null
  } | null
}

function packageActualStatus(pkg: WorkshopPackageNode): ActualStatus {
  if (pkg.status === 'done') return 'finished'
  if (pkg.status === 'draft' || pkg.status === 'ready' || pkg.status === 'needs_review') return 'notStarted'
  return 'started'
}

function taskRowFromTask(task: ProjectTask, asOf: string, inventory: InventoryItemRow[]): TodayActivity {
  const base = tasksToTodayActivities([task], asOf, inventory)[0]
  if (base) return { ...base, kind: 'schedule', depth: 0, parentId: null }
  const schedule = getTaskScheduleStatus(task, asOf)
  let actual_status: ActualStatus = 'started'
  if (Number(task.percent_complete) >= 100 || schedule === 'completed') actual_status = 'finished'
  else if (schedule === 'not_started') actual_status = 'notStarted'
  return {
    id: task.id,
    kind: 'schedule',
    parentId: null,
    depth: 0,
    wbs_code: task.wbs_code ?? '—',
    name: task.name,
    is_critical: task.is_critical,
    planned_status: derivePlannedStatus(task, asOf),
    actual_status,
    actual_progress_percent: Number(task.percent_complete),
    readiness: { materials: 'ok', manpower: 'ok', access: 'ok' },
  }
}

function walkPackages(
  packages: WorkshopPackageNode[],
  parentTaskId: string,
  parentWbs: string,
  depth: number,
  assignmentByPackage: Map<string, { id: string; planned_qty: number }>,
  cumulativeActual: Record<string, number>
): TodayActivity[] {
  const rows: TodayActivity[] = []
  for (const p of packages) {
    const cumulative = cumulativeActual[p.id] ?? 0
    const qty = Number(p.quantity) > 0 ? Number(p.quantity) : 1
    const percent = Math.min(100, Math.round((cumulative / qty) * 100))
    const asg = assignmentByPackage.get(p.id)
    rows.push({
      id: `package:${p.id}`,
      kind: 'package',
      parentId: parentTaskId,
      depth,
      wbs_code: p.wbs ?? parentWbs,
      name: p.name,
      location: p.location ?? undefined,
      is_critical: false,
      planned_status: 'shouldContinue',
      actual_status: packageActualStatus(p),
      actual_progress_percent: percent,
      readiness: { materials: 'ok', manpower: 'ok', access: 'ok' },
      packageId: p.id,
      assignmentId: asg?.id ?? null,
      quantity: p.quantity,
      uom: p.uom,
      plannedQtyToday: asg?.planned_qty ?? null,
      approvalStatus: p.approvalStatus,
      workshopNote: p.note,
    })
    rows.push(
      ...walkPackages(
        p.children,
        parentTaskId,
        p.wbs ?? parentWbs,
        depth + 1,
        assignmentByPackage,
        cumulativeActual
      )
    )
  }
  return rows
}

/**
 * Merge MSP "today" tasks with workshop sub-branches from technical office (nested under schedule rows).
 */
export function buildSupervisorTodayActivities(
  tasks: ProjectTask[],
  treeNodes: ScheduleTreeNode[],
  todayAssignments: TodayAssignmentRow[],
  cumulativeActual: Record<string, number>,
  asOf: string,
  inventory: InventoryItemRow[] = []
): TodayActivity[] {
  const scheduleRows: TodayActivity[] = tasksToTodayActivities(tasks, asOf, inventory).map((row) => ({
    ...row,
    kind: 'schedule' as const,
    depth: 0,
    parentId: null,
  }))

  const scheduleIds = new Set(scheduleRows.map((r) => r.id))
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const treeByTask = new Map(collectScheduleTaskNodes(treeNodes).map((n) => [n.id, n]))

  const assignmentByPackage = new Map<string, { id: string; planned_qty: number }>()
  for (const item of todayAssignments) {
    const pkgId = item.workshop_packages?.id
    if (pkgId) {
      assignmentByPackage.set(String(pkgId), {
        id: String(item.id),
        planned_qty: Number(item.planned_qty),
      })
    }
  }

  for (const item of todayAssignments) {
    const taskId = item.workshop_packages?.project_task_id
    if (!taskId || scheduleIds.has(taskId)) continue
    const task = taskMap.get(taskId)
    if (!task) continue
    const finish = taskEffectiveFinish(task)
    if (finish && finish < asOf && Number(task.percent_complete) >= 100) continue
    scheduleRows.push(taskRowFromTask(task, asOf, inventory))
    scheduleIds.add(taskId)
  }

  scheduleRows.sort((a, b) => compareWbs(a.wbs_code, b.wbs_code))

  const result: TodayActivity[] = []
  for (const row of scheduleRows) {
    result.push(row)
    const node = treeByTask.get(row.id)
    if (node?.packages.length) {
      result.push(
        ...walkPackages(
          node.packages,
          row.id,
          row.wbs_code,
          1,
          assignmentByPackage,
          cumulativeActual
        )
      )
    }
  }

  return result
}
