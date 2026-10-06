/**
 * Project-wide progress rollup (پیشرفت کل پروژه)
 *
 * Rules:
 * 1. If an activity was not updated on a given day, use its latest historical progress (not zero).
 * 2. Overall = Σ(weight × progress) / Σ(weight)  → result in 0–100.
 * 3. Weights are normalized by their actual sum (need not equal exactly 100).
 * 4. Parent WBS rows roll up from weighted average of children.
 * 5. Each user entry appends { date, progress } to history for S-curve charts.
 */

import { weightedProgressPercent } from '@/features/schedule/lib/weighted-progress'

/** Single activity input with resolved latest progress (0–100) and weight (percent points or any positive unit). */
export type ActivityProgressInput = {
  id: string
  /** Weight share — e.g. 6 means 6% of project when weights sum to 100 (normalization handles other totals). */
  weight: number
  /** Latest registered progress 0–100 for this activity. */
  progress: number
}

/** One historical snapshot — append-only for S-curve / time-series. */
export type ActivityProgressHistoryRecord = {
  activityId: string
  /** Calendar day YYYY-MM-DD */
  date: string
  /** Progress 0–100 on that day */
  progress: number
}

/** WBS node for hierarchical rollup (parent progress derived from children). */
export type WbsProgressNode = {
  id: string
  parentId: string | null
  weight: number
  /** When true, progress comes from history; when false/absent with children, progress is rolled up. */
  isLeaf?: boolean
}

const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(Number(value) || 0)))

/**
 * Rule 1 — Latest progress for an activity on or before `asOfDate`.
 * Returns 0 only when no history exists before that date.
 */
export function latestProgressFromHistory(
  activityId: string,
  history: ActivityProgressHistoryRecord[],
  asOfDate: string
): number {
  const pool = history.filter(
    (row) => row.activityId === activityId && row.date <= asOfDate
  )
  if (pool.length === 0) return 0

  const latest = pool.sort((a, b) => a.date.localeCompare(b.date)).at(-1)!
  return clampPercent(latest.progress)
}

/**
 * Build activity list with progress resolved from history (Rule 1).
 */
export function buildActivityProgressInputs(
  activities: Array<Pick<WbsProgressNode, 'id' | 'weight'>>,
  history: ActivityProgressHistoryRecord[],
  asOfDate: string
): ActivityProgressInput[] {
  return activities.map((activity) => ({
    id: activity.id,
    weight: activity.weight,
    progress: latestProgressFromHistory(activity.id, history, asOfDate),
  }))
}

/**
 * Rules 2 & 3 — Weighted overall project progress (0–100).
 *
 * Formula:  overall = Σ(weightᵢ × progressᵢ) / Σ(weightᵢ)
 * Weights are normalized automatically when they do not sum to 100.
 */
export function computeOverallProjectProgress(
  activities: ActivityProgressInput[]
): number {
  if (activities.length === 0) return 0

  return weightedProgressPercent(
    activities.map((a) => ({
      weight: a.weight,
      progress: a.progress,
    }))
  )
}

/**
 * Rule 5 — Append an immutable history row (date + percent) for S-curve tracking.
 * Same calendar day for the same activity is upserted (one value per activity per day).
 */
export function appendProgressHistoryEntry(
  history: ActivityProgressHistoryRecord[],
  entry: ActivityProgressHistoryRecord
): ActivityProgressHistoryRecord[] {
  const progress = clampPercent(entry.progress)
  const key = `${entry.activityId}@${entry.date}`
  const map = new Map<string, ActivityProgressHistoryRecord>()

  for (const row of history) {
    map.set(`${row.activityId}@${row.date}`, {
      activityId: row.activityId,
      date: row.date,
      progress: clampPercent(row.progress),
    })
  }

  map.set(key, {
    activityId: entry.activityId,
    date: entry.date,
    progress,
  })

  return [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.activityId.localeCompare(b.activityId)
  )
}

/**
 * Rule 4 — Roll up parent progress from weighted average of direct children (bottom-up).
 * Leaf progress is taken from `leafProgressById`; parents without explicit progress are computed.
 */
export function rollupHierarchicalProgress(
  nodes: WbsProgressNode[],
  leafProgressById: Readonly<Record<string, number>>
): Map<string, number> {
  const childrenByParent = new Map<string, WbsProgressNode[]>()
  const progressById = new Map<string, number>()

  for (const node of nodes) {
    if (node.parentId) {
      const siblings = childrenByParent.get(node.parentId) ?? []
      siblings.push(node)
      childrenByParent.set(node.parentId, siblings)
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  function resolveProgress(nodeId: string, stack: Set<string> = new Set()): number {
    if (progressById.has(nodeId)) return progressById.get(nodeId)!

    if (stack.has(nodeId)) return 0
    stack.add(nodeId)

    const node = nodeById.get(nodeId)
    if (!node) return 0

    const children = childrenByParent.get(nodeId) ?? []

    if (children.length === 0 || node.isLeaf) {
      const value = clampPercent(leafProgressById[nodeId] ?? 0)
      progressById.set(nodeId, value)
      stack.delete(nodeId)
      return value
    }

    const childInputs: ActivityProgressInput[] = children.map((child) => ({
      id: child.id,
      weight: child.weight,
      progress: resolveProgress(child.id, stack),
    }))

    const rolled = computeOverallProjectProgress(childInputs)
    progressById.set(nodeId, rolled)
    stack.delete(nodeId)
    return rolled
  }

  for (const node of nodes) {
    resolveProgress(node.id)
  }

  return progressById
}

/**
 * End-to-end: history → leaf latest progress → optional WBS rollup → overall project %.
 *
 * @param nodes  All WBS nodes (leaves + parents). Only leaves should receive user updates in history.
 * @param history  Append-only progress history (Rule 5).
 * @param asOfDate  Calculate as-of this calendar day (YYYY-MM-DD).
 * @param scope  `'leaves'` = project progress from leaf weights only (recommended);
 *               `'roots'` = after full rollup, average root-level nodes.
 */
export function computeOverallProjectProgressFromHistory(
  nodes: WbsProgressNode[],
  history: ActivityProgressHistoryRecord[],
  asOfDate: string,
  scope: 'leaves' | 'roots' = 'leaves'
): number {
  const leaves = nodes.filter((n) => n.isLeaf ?? !nodes.some((c) => c.parentId === n.id))

  if (scope === 'leaves') {
    const inputs = buildActivityProgressInputs(leaves, history, asOfDate)
    return computeOverallProjectProgress(inputs)
  }

  const leafProgress: Record<string, number> = {}
  for (const leaf of leaves) {
    leafProgress[leaf.id] = latestProgressFromHistory(leaf.id, history, asOfDate)
  }

  const rolled = rollupHierarchicalProgress(nodes, leafProgress)
  const roots = nodes.filter((n) => !n.parentId)

  if (roots.length === 0) {
    return computeOverallProjectProgress(
      leaves.map((leaf) => ({
        id: leaf.id,
        weight: leaf.weight,
        progress: leafProgress[leaf.id] ?? 0,
      }))
    )
  }

  return computeOverallProjectProgress(
    roots.map((root) => ({
      id: root.id,
      weight: root.weight,
      progress: rolled.get(root.id) ?? 0,
    }))
  )
}

/** Build daily overall progress series for S-curve (startDate → endDate). */
export function buildProjectProgressCurve(
  nodes: WbsProgressNode[],
  history: ActivityProgressHistoryRecord[],
  endDate: string,
  startDate?: string,
  scope: 'leaves' | 'roots' = 'leaves'
): Array<{ date: string; overallProgress: number }> {
  const start =
    startDate ??
    history.map((h) => h.date).sort()[0] ??
    endDate
  const from = start > endDate ? endDate : start
  const points: Array<{ date: string; overallProgress: number }> = []
  const startMs = new Date(`${from}T12:00:00`).getTime()
  const endMs = new Date(`${endDate}T12:00:00`).getTime()
  const totalDays = Math.max(0, Math.round((endMs - startMs) / 86_400_000))
  const maxPoints = 120
  const step = totalDays + 1 <= maxPoints ? 1 : Math.ceil((totalDays + 1) / maxPoints)

  for (let i = 0; i <= totalDays; i += step) {
    const d = new Date(startMs)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    points.push({
      date: iso,
      overallProgress: computeOverallProjectProgressFromHistory(nodes, history, iso, scope),
    })
  }

  const lastIso = endDate
  if (points.at(-1)?.date !== lastIso) {
    points.push({
      date: lastIso,
      overallProgress: computeOverallProjectProgressFromHistory(nodes, history, lastIso, scope),
    })
  }

  return points
}
