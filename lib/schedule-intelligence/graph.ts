import type { ScheduleDependency, ScheduleTask, RelationType } from '@/types/schedule-intelligence'

export interface ScheduleGraph {
  leafUids: string[]
  taskMap: Map<string, ScheduleTask>
  topologicalOrder: string[]
  hasCycle: boolean
  cycleNodes: string[]
}

function isLeafForCpm(task: ScheduleTask): boolean {
  return !task.isSummary
}

export function buildScheduleGraph(tasks: ScheduleTask[]): ScheduleGraph {
  const taskMap = new Map(tasks.map((t) => [t.uid, t]))
  const leafUids = tasks.filter(isLeafForCpm).map((t) => t.uid)
  const leafSet = new Set(leafUids)

  const indegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const uid of leafUids) {
    indegree.set(uid, 0)
    adj.set(uid, [])
  }

  for (const t of tasks) {
    if (!leafSet.has(t.uid)) continue
    for (const dep of t.predecessors) {
      if (!leafSet.has(dep.predecessorUid) || !leafSet.has(dep.successorUid)) continue
      adj.get(dep.predecessorUid)!.push(dep.successorUid)
      indegree.set(dep.successorUid, (indegree.get(dep.successorUid) ?? 0) + 1)
    }
  }

  for (const uid of leafUids) {
    const task = taskMap.get(uid)!
    task.indegree = indegree.get(uid) ?? 0
    task.outdegree = adj.get(uid)?.length ?? 0
  }

  const queue: string[] = []
  for (const uid of leafUids) {
    if ((indegree.get(uid) ?? 0) === 0) queue.push(uid)
  }

  const topologicalOrder: string[] = []
  const indegreeCopy = new Map(indegree)

  while (queue.length > 0) {
    const uid = queue.shift()!
    topologicalOrder.push(uid)
    for (const next of adj.get(uid) ?? []) {
      const d = (indegreeCopy.get(next) ?? 0) - 1
      indegreeCopy.set(next, d)
      if (d === 0) queue.push(next)
    }
  }

  const hasCycle = topologicalOrder.length < leafUids.length
  const cycleNodes = hasCycle
    ? leafUids.filter((uid) => !topologicalOrder.includes(uid))
    : []

  // Downstream reachability (transitive successors count)
  const reach = new Map<string, number>()
  for (const uid of leafUids) reach.set(uid, 0)
  for (let i = topologicalOrder.length - 1; i >= 0; i--) {
    const uid = topologicalOrder[i]
    let count = 0
    for (const next of adj.get(uid) ?? []) {
      count += 1 + (reach.get(next) ?? 0)
    }
    reach.set(uid, count)
    taskMap.get(uid)!.downstreamReach = count
  }

  return { leafUids, taskMap, topologicalOrder, hasCycle, cycleNodes }
}

/** Apply predecessor constraint for forward pass — returns minimum ES in minutes. */
export function forwardConstraintMinutes(
  pred: ScheduleTask,
  succ: ScheduleTask,
  dep: ScheduleDependency
): number {
  const lag = dep.lagMinutes
  const predEs = pred.earlyStartMinutes ?? 0
  const predEf = pred.earlyFinishMinutes ?? predEs + pred.durationMinutes
  const succDur = succ.durationMinutes

  switch (dep.type) {
    case 'FS':
      return predEf + lag
    case 'SS':
      return predEs + lag
    case 'FF':
      return predEf + lag - succDur
    case 'SF':
      return predEs + lag - succDur
    default:
      return predEf + lag
  }
}

/** Backward constraint — returns maximum LF for predecessor. */
export function backwardLfConstraintMinutes(
  pred: ScheduleTask,
  succ: ScheduleTask,
  dep: ScheduleDependency
): number {
  const lag = dep.lagMinutes
  const succLs = succ.lateStartMinutes ?? 0
  const succLf = succ.lateFinishMinutes ?? succLs + succ.durationMinutes
  const predDur = pred.durationMinutes

  switch (dep.type) {
    case 'FS':
      return succLs - lag
    case 'SS':
      return succLs - lag + predDur
    case 'FF':
      return succLf - lag
    case 'SF':
      return succLf - lag + predDur
    default:
      return succLs - lag
  }
}

export function freeFloatFromSuccessor(
  pred: ScheduleTask,
  succ: ScheduleTask,
  dep: ScheduleDependency
): number {
  const predEf = pred.earlyFinishMinutes ?? 0
  const succEs = succ.earlyStartMinutes ?? 0
  const lag = dep.lagMinutes
  switch (dep.type) {
    case 'FS':
      return succEs - lag - predEf
    case 'SS':
      return (succ.earlyStartMinutes ?? 0) - lag - (pred.earlyStartMinutes ?? 0)
    case 'FF':
      return (succ.earlyFinishMinutes ?? 0) - lag - predEf
    case 'SF':
      return (succ.earlyFinishMinutes ?? 0) - lag - (pred.earlyStartMinutes ?? 0)
    default:
      return succEs - lag - predEf
  }
}
