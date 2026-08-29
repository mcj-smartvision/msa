import type {
  CpmResult,
  NormalizedSchedule,
  ScheduleAnalysisConfig,
  ScheduleWarning,
  ScheduleTask,
} from '@/types/schedule-intelligence'
import {
  backwardLfConstraintMinutes,
  buildScheduleGraph,
  forwardConstraintMinutes,
  freeFloatFromSuccessor,
} from '@/lib/schedule-intelligence/graph'
import { durationDaysFromMinutes } from '@/lib/schedule-intelligence/durationUtils'

/**
 * Deterministic CPM (Activity-on-Node).
 *
 * Forward:
 *   EF = ES + duration
 *   ES_j = max(predecessor constraints)
 *
 * Backward:
 *   LS = LF - duration
 *   LF from successor constraints (min)
 *
 * Float:
 *   Total = LS - ES
 *   Free = min over FS-like outgoing edges
 */
export function runCpmEngine(
  schedule: NormalizedSchedule,
  config: ScheduleAnalysisConfig
): CpmResult {
  const graph = buildScheduleGraph(schedule.tasks)
  const errors: ScheduleWarning[] = []

  if (graph.hasCycle) {
    errors.push({
      code: 'CYCLE_DETECTED',
      severity: 'error',
      message: 'شبکه وابستگی حلقه دارد — CPM معتبر نیست',
      details: graph.cycleNodes.join(', '),
    })
    return {
      success: false,
      projectDurationMinutes: 0,
      projectDurationDays: 0,
      projectEarlyFinishMinutes: 0,
      criticalUids: [],
      criticalChains: [],
      nearCriticalUids: [],
      errors,
      sourceMismatchCount: 0,
    }
  }

  const { taskMap, topologicalOrder, leafUids } = graph
  const epsilon = config.criticalFloatEpsilonMinutes
  const nearCriticalMinutes = config.nearCriticalFloatDays * schedule.minutesPerDay

  // Forward pass
  for (const uid of topologicalOrder) {
    const task = taskMap.get(uid)!
    let es = 0
    if (task.predecessors.length === 0) {
      es = 0
    } else {
      let maxEs = 0
      for (const dep of task.predecessors) {
        const pred = taskMap.get(dep.predecessorUid)
        if (!pred || pred.isSummary) continue
        const constraint = forwardConstraintMinutes(pred, task, dep)
        maxEs = Math.max(maxEs, constraint)
      }
      es = maxEs
    }
    task.earlyStartMinutes = es
    task.earlyFinishMinutes = es + task.durationMinutes
  }

  const terminalUids = leafUids.filter((uid) => (taskMap.get(uid)?.outdegree ?? 0) === 0)
  const projectEarlyFinish = Math.max(
    0,
    ...terminalUids.map((uid) => taskMap.get(uid)!.earlyFinishMinutes ?? 0)
  )

  // Backward pass
  const reverseOrder = [...topologicalOrder].reverse()
  for (const uid of reverseOrder) {
    const task = taskMap.get(uid)!
    let lf: number
    if (terminalUids.includes(uid)) {
      lf = projectEarlyFinish
    } else {
      lf = projectEarlyFinish
      for (const dep of task.successors) {
        const succ = taskMap.get(dep.successorUid)
        if (!succ || succ.isSummary) continue
        const constraintLf = backwardLfConstraintMinutes(task, succ, dep)
        lf = Math.min(lf, constraintLf)
      }
    }
    task.lateFinishMinutes = lf
    task.lateStartMinutes = lf - task.durationMinutes
  }

  let sourceMismatchCount = 0
  const criticalUids: string[] = []
  const nearCriticalUids: string[] = []

  for (const uid of leafUids) {
    const task = taskMap.get(uid)!
    const tf = (task.lateStartMinutes ?? 0) - (task.earlyStartMinutes ?? 0)
    task.totalFloatMinutes = tf

    let ff = tf
    for (const dep of task.successors) {
      const succ = taskMap.get(dep.successorUid)
      if (!succ || succ.isSummary) continue
      ff = Math.min(ff, freeFloatFromSuccessor(task, succ, dep))
    }
    task.freeFloatMinutes = Math.max(0, ff)

    task.calculatedCritical = tf <= epsilon
    task.nearCritical = tf > epsilon && tf <= nearCriticalMinutes

    if (task.calculatedCritical) criticalUids.push(uid)
    else if (task.nearCritical) nearCriticalUids.push(uid)

    if (
      task.isCriticalFromSource != null &&
      task.isCriticalFromSource !== task.calculatedCritical
    ) {
      sourceMismatchCount++
    }
  }

  const criticalChains = extractCriticalChains(taskMap, criticalUids)

  return {
    success: true,
    projectDurationMinutes: projectEarlyFinish,
    projectDurationDays: durationDaysFromMinutes(projectEarlyFinish, schedule.minutesPerDay),
    projectEarlyFinishMinutes: projectEarlyFinish,
    criticalUids,
    criticalChains,
    nearCriticalUids,
    errors,
    sourceMismatchCount,
  }
}

function extractCriticalChains(
  taskMap: Map<string, ScheduleTask>,
  criticalUids: string[]
): string[][] {
  const criticalSet = new Set(criticalUids)
  const chains: string[][] = []
  const starts = criticalUids.filter((uid) => {
    const t = taskMap.get(uid)!
    return t.predecessors.every(
      (d) => !criticalSet.has(d.predecessorUid)
    )
  })

  for (const start of starts.slice(0, 5)) {
    const chain: string[] = []
    let current: string | null = start
    const visited = new Set<string>()
    while (current && criticalSet.has(current) && !visited.has(current)) {
      visited.add(current)
      chain.push(current)
      const next = taskMap
        .get(current)!
        .successors.find((d) => criticalSet.has(d.successorUid))
      current = next?.successorUid ?? null
    }
    if (chain.length > 0) chains.push(chain)
  }
  return chains
}
