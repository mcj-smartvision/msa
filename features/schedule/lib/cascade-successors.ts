import type { TaskRelationType } from '@/shared/types/schedule'
import { addDaysIso, diffDaysIso, toIsoDateOnly } from '@/features/schedule/lib/dates'
import {
linkParentsFromWbs,
rollupAncestorsToChildren,
type GanttDateNode,
} from '@/features/schedule/lib/gantt-parent-expand'

export interface CascadeDependency {
  predecessorId: string
  successorId: string
  type: TaskRelationType
  lagDays?: number
}

export interface CascadeTaskNode extends GanttDateNode {
  isSummary?: boolean
}

/**
 * Earliest successor start (ISO) implied by one predecessor link.
 * Finish dates use exclusive-end semantics (finish = start + durationDays),
 * matching day-index CPM: FS successor starts on predecessor finish day.
 */
export function successorStartFromLink(
  predStart: string,
  predFinish: string,
  succDurationDays: number,
  type: TaskRelationType,
  lagDays = 0
): string {
  const lag = Number(lagDays) || 0
  const dur = Math.max(0, succDurationDays)
  switch (type) {
    case 'SS':
      return addDaysIso(predStart, lag)
    case 'FF':
      return addDaysIso(predFinish, lag - dur)
    case 'SF':
      return addDaysIso(predStart, lag - dur)
    case 'FS':
    default:
      return addDaysIso(predFinish, lag)
  }
}

function buildTopoOrder(
  nodeIds: string[],
  deps: CascadeDependency[]
): { order: string[]; cycle: boolean } {
  const nodeSet = new Set(nodeIds)
  const indegree = new Map<string, number>()
  const succs = new Map<string, string[]>()
  for (const id of nodeIds) {
    indegree.set(id, 0)
    succs.set(id, [])
  }
  for (const d of deps) {
    if (!nodeSet.has(d.predecessorId) || !nodeSet.has(d.successorId)) continue
    if (d.predecessorId === d.successorId) continue
    succs.get(d.predecessorId)!.push(d.successorId)
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1)
  }
  const queue = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of succs.get(id) ?? []) {
      const next = (indegree.get(s) ?? 0) - 1
      indegree.set(s, next)
      if (next === 0) queue.push(s)
    }
  }
  return { order, cycle: order.length < nodeIds.length }
}

function transitiveSuccessors(
  rootId: string,
  deps: CascadeDependency[],
  nodeSet: Set<string>
): Set<string> {
  const outEdges = new Map<string, string[]>()
  for (const d of deps) {
    if (!nodeSet.has(d.predecessorId) || !nodeSet.has(d.successorId)) continue
    const list = outEdges.get(d.predecessorId) ?? []
    list.push(d.successorId)
    outEdges.set(d.predecessorId, list)
  }
  const reached = new Set<string>()
  const stack = [...(outEdges.get(rootId) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (reached.has(id)) continue
    reached.add(id)
    for (const s of outEdges.get(id) ?? []) stack.push(s)
  }
  return reached
}

/**
 * After editing one task's dates, push/pull all dependency successors so links stay valid.
 * Preserves each successor's duration. Then rolls up WBS parents for every changed row.
 */
export function applyDateChangeWithSuccessorCascade(
  tasks: CascadeTaskNode[],
  taskId: string,
  nextStart: string,
  nextFinish: string,
  dependencies: CascadeDependency[]
): CascadeTaskNode[] {
  const start = toIsoDateOnly(nextStart)
  const finish = toIsoDateOnly(nextFinish)
  if (!start || !finish || finish < start) return []

  const cloned: CascadeTaskNode[] = tasks.map((t) => ({ ...t }))
  linkParentsFromWbs(cloned)
  const map = new Map(cloned.map((t) => [t.id, t]))
  const current = map.get(taskId)
  if (!current) return []

  const oldStart = toIsoDateOnly(current.start)
  const oldFinish = toIsoDateOnly(current.finish)

  current.start = start
  current.finish = finish
  map.set(taskId, current)

  const leafIds = cloned.filter((t) => !t.isSummary).map((t) => t.id)
  const leafSet = new Set(leafIds)
  const reachable = transitiveSuccessors(taskId, dependencies, leafSet)

  const predsOf = new Map<string, CascadeDependency[]>()
  for (const d of dependencies) {
    if (!leafSet.has(d.predecessorId) || !leafSet.has(d.successorId)) continue
    const list = predsOf.get(d.successorId) ?? []
    list.push(d)
    predsOf.set(d.successorId, list)
  }

  const { order, cycle } = buildTopoOrder(leafIds, dependencies)
  const walkOrder = cycle ? leafIds : order

  const changedIds = new Set<string>([taskId])

  for (const id of walkOrder) {
    if (id === taskId) continue
    if (!reachable.has(id)) continue
    const node = map.get(id)
    if (!node || node.isSummary) continue

    const nodeStart = toIsoDateOnly(node.start)
    const nodeFinish = toIsoDateOnly(node.finish)
    if (!nodeStart || !nodeFinish) continue
    const durationDays = Math.max(0, diffDaysIso(nodeStart, nodeFinish))

    const preds = predsOf.get(id) ?? []
    if (preds.length === 0) continue

    let requiredStart: string | null = null
    for (const e of preds) {
      const pred = map.get(e.predecessorId)
      if (!pred) continue
      const ps = toIsoDateOnly(pred.start)
      const pf = toIsoDateOnly(pred.finish)
      if (!ps || !pf) continue
      const cand = successorStartFromLink(
        ps,
        pf,
        durationDays,
        e.type,
        Number(e.lagDays) || 0
      )
      if (!requiredStart || cand > requiredStart) requiredStart = cand
    }
    if (!requiredStart) continue

    const nextFin = addDaysIso(requiredStart, durationDays)
    if (requiredStart === nodeStart && nextFin === nodeFinish) continue

    node.start = requiredStart
    node.finish = nextFin
    map.set(id, node)
    changedIds.add(id)
  }

  // Fallback when MSP links are missing: shift later leaf tasks by finish delta.
  if (reachable.size === 0 && oldFinish && finish !== oldFinish) {
    const delta = diffDaysIso(oldFinish, finish)
    if (delta !== 0) {
      for (const node of map.values()) {
        if (node.id === taskId || node.isSummary) continue
        const s = toIsoDateOnly(node.start)
        const f = toIsoDateOnly(node.finish)
        if (!s || !f) continue
        // Tasks that started on/after the edited task's previous finish move with it.
        if (oldFinish && s >= oldFinish) {
          node.start = addDaysIso(s, delta)
          node.finish = addDaysIso(f, delta)
          map.set(node.id, node)
          changedIds.add(node.id)
        } else if (oldStart && s > oldStart) {
          // Overlapping "later" tasks that began after the edited start also shift.
          node.start = addDaysIso(s, delta)
          node.finish = addDaysIso(f, delta)
          map.set(node.id, node)
          changedIds.add(node.id)
        }
      }
    }
  }

  const updates: CascadeTaskNode[] = []
  for (const id of changedIds) {
    const n = map.get(id)
    if (n) updates.push(n)
  }

  const ancestorSeen = new Set<string>()
  for (const id of [...changedIds]) {
    const ancestors = rollupAncestorsToChildren(map, id)
    for (const a of ancestors) {
      if (ancestorSeen.has(a.id)) continue
      ancestorSeen.add(a.id)
      updates.push(a)
      changedIds.add(a.id)
    }
  }

  // Dedupe by id (last write wins)
  const byId = new Map<string, CascadeTaskNode>()
  for (const u of updates) byId.set(u.id, u)
  return [...byId.values()]
}
