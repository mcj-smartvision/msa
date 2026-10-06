import type { TaskRelationType } from '@/shared/types/schedule'

export interface CpmActivityInput {
  id: string
  durationDays: number
  /** Summary / parent WBS rows are excluded from the CPM network. */
  isSummary?: boolean
}

export interface CpmDependencyInput {
  predecessorId: string
  successorId: string
  type: TaskRelationType
  lagDays?: number
}

export interface CpmActivityResult {
  id: string
  durationDays: number
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number
  isCritical: boolean
}

export type CpmCalculateSuccess = {
  success: true
  projectDurationDays: number
  activities: CpmActivityResult[]
  criticalIds: string[]
}

export type CpmCalculateFailure = {
  success: false
  error: 'CYCLE_DETECTED' | 'NO_ACTIVITIES'
  message: string
  cycleIds?: string[]
}

export type CpmCalculateResult = CpmCalculateSuccess | CpmCalculateFailure

const FLOAT_EPS = 1e-9

function forwardEsConstraint(
  predEs: number,
  predEf: number,
  succDuration: number,
  type: TaskRelationType,
  lag: number
): number {
  switch (type) {
    case 'FS':
      return predEf + lag
    case 'SS':
      return predEs + lag
    case 'FF':
      return predEf + lag - succDuration
    case 'SF':
      return predEs + lag - succDuration
    default:
      return predEf + lag
  }
}

function backwardLfConstraint(
  succLs: number,
  succLf: number,
  predDuration: number,
  type: TaskRelationType,
  lag: number
): number {
  switch (type) {
    case 'FS':
      return succLs - lag
    case 'SS':
      return succLs - lag + predDuration
    case 'FF':
      return succLf - lag
    case 'SF':
      return succLf - lag + predDuration
    default:
      return succLs - lag
  }
}

/**
 * Day-based Activity-on-Node CPM (forward + backward + total float).
 * Durations and lags are in calendar/working days (same unit).
 */
export function calculateCpm(
  activities: CpmActivityInput[],
  dependencies: CpmDependencyInput[]
): CpmCalculateResult {
  const nodes = activities.filter((a) => !a.isSummary)
  if (nodes.length === 0) {
    return {
      success: false,
      error: 'NO_ACTIVITIES',
      message: 'هیچ فعالیتی برای محاسبه CPM یافت نشد',
    }
  }

  const duration = new Map<string, number>()
  const nodeIds: string[] = []
  for (const a of nodes) {
    nodeIds.push(a.id)
    duration.set(a.id, Math.max(0, Number(a.durationDays) || 0))
  }
  const nodeSet = new Set(nodeIds)

  type Edge = { pred: string; succ: string; type: TaskRelationType; lag: number }
  const edges: Edge[] = []
  const predsOf = new Map<string, Edge[]>()
  const succsOf = new Map<string, Edge[]>()
  const indegree = new Map<string, number>()

  for (const id of nodeIds) {
    predsOf.set(id, [])
    succsOf.set(id, [])
    indegree.set(id, 0)
  }

  for (const d of dependencies) {
    if (!nodeSet.has(d.predecessorId) || !nodeSet.has(d.successorId)) continue
    if (d.predecessorId === d.successorId) continue
    const edge: Edge = {
      pred: d.predecessorId,
      succ: d.successorId,
      type: d.type,
      lag: Number(d.lagDays) || 0,
    }
    edges.push(edge)
    predsOf.get(edge.succ)!.push(edge)
    succsOf.get(edge.pred)!.push(edge)
    indegree.set(edge.succ, (indegree.get(edge.succ) ?? 0) + 1)
  }

  // Kahn topological sort
  const queue = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0)
  const topo: string[] = []
  const indegreeWork = new Map(indegree)
  while (queue.length > 0) {
    const id = queue.shift()!
    topo.push(id)
    for (const edge of succsOf.get(id) ?? []) {
      const next = (indegreeWork.get(edge.succ) ?? 0) - 1
      indegreeWork.set(edge.succ, next)
      if (next === 0) queue.push(edge.succ)
    }
  }

  if (topo.length < nodeIds.length) {
    const cycleIds = nodeIds.filter((id) => !topo.includes(id))
    return {
      success: false,
      error: 'CYCLE_DETECTED',
      message: `حلقه در وابستگی‌ها یافت شد — محاسبه CPM متوقف شد (${cycleIds.length} فعالیت در حلقه)`,
      cycleIds,
    }
  }

  const earlyStart = new Map<string, number>()
  const earlyFinish = new Map<string, number>()

  for (const id of topo) {
    const dur = duration.get(id)!
    let es = 0
    const preds = predsOf.get(id) ?? []
    if (preds.length > 0) {
      es = Math.max(
        ...preds.map((e) =>
          forwardEsConstraint(
            earlyStart.get(e.pred)!,
            earlyFinish.get(e.pred)!,
            dur,
            e.type,
            e.lag
          )
        )
      )
    }
    earlyStart.set(id, es)
    earlyFinish.set(id, es + dur)
  }

  const projectDurationDays = Math.max(0, ...nodeIds.map((id) => earlyFinish.get(id)!))

  const lateStart = new Map<string, number>()
  const lateFinish = new Map<string, number>()
  const reverse = [...topo].reverse()

  for (const id of reverse) {
    const dur = duration.get(id)!
    const succs = succsOf.get(id) ?? []
    let lf = projectDurationDays
    if (succs.length > 0) {
      lf = Math.min(
        ...succs.map((e) =>
          backwardLfConstraint(
            lateStart.get(e.succ)!,
            lateFinish.get(e.succ)!,
            dur,
            e.type,
            e.lag
          )
        )
      )
    }
    lateFinish.set(id, lf)
    lateStart.set(id, lf - dur)
  }

  const results: CpmActivityResult[] = nodeIds.map((id) => {
    const es = earlyStart.get(id)!
    const ef = earlyFinish.get(id)!
    const ls = lateStart.get(id)!
    const lf = lateFinish.get(id)!
    const totalFloat = ls - es
    const isCritical = Math.abs(totalFloat) <= FLOAT_EPS
    return {
      id,
      durationDays: duration.get(id)!,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      totalFloat: isCritical ? 0 : totalFloat,
      isCritical,
    }
  })

  return {
    success: true,
    projectDurationDays,
    activities: results,
    criticalIds: results.filter((r) => r.isCritical).map((r) => r.id),
  }
}
