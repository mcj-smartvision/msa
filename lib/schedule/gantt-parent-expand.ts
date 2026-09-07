import { addDaysIso, diffDaysIso, toIsoDateOnly } from '@/lib/schedule/dates'

export interface GanttDateNode {
  id: string
  parentId: string | null
  start: string
  finish: string
  wbs?: string | null
}

/** Fill missing parentId from WBS outline (e.g. 1.18.2 → 1.18). */
export function linkParentsFromWbs(tasks: GanttDateNode[]): void {
  const byWbs = new Map<string, GanttDateNode>()
  for (const t of tasks) {
    const wbs = t.wbs?.trim()
    if (wbs) byWbs.set(wbs, t)
  }
  for (const t of tasks) {
    if (t.parentId) continue
    const wbs = t.wbs?.trim()
    if (!wbs || !wbs.includes('.')) continue
    const parentWbs = wbs.slice(0, wbs.lastIndexOf('.'))
    const parent = byWbs.get(parentWbs)
    if (parent && parent.id !== t.id) t.parentId = parent.id
  }
}

function directChildren(
  tasksById: Map<string, GanttDateNode>,
  parentId: string
): GanttDateNode[] {
  const out: GanttDateNode[] = []
  for (const t of tasksById.values()) {
    if (t.parentId === parentId) out.push(t)
  }
  return out
}

/**
 * Set each ancestor to exactly cover all of its direct children
 * (expand OR shrink). Walks up the WBS tree so every header bar
 * always spans its full subcategory.
 */
export function rollupAncestorsToChildren(
  tasksById: Map<string, GanttDateNode>,
  fromTaskId: string
): GanttDateNode[] {
  const updates: GanttDateNode[] = []
  let parentId = tasksById.get(fromTaskId)?.parentId ?? null

  while (parentId) {
    const parent = tasksById.get(parentId)
    if (!parent) break

    const children = directChildren(tasksById, parentId)
    if (children.length === 0) break

    let coverStart: string | null = null
    let coverFinish: string | null = null
    for (const child of children) {
      const s = toIsoDateOnly(child.start)
      const f = toIsoDateOnly(child.finish)
      if (!s || !f) continue
      if (!coverStart || s < coverStart) coverStart = s
      if (!coverFinish || f > coverFinish) coverFinish = f
    }
    if (!coverStart || !coverFinish) break

    const pStart = toIsoDateOnly(parent.start)
    const pFinish = toIsoDateOnly(parent.finish)
    if (pStart === coverStart && pFinish === coverFinish) {
      parentId = parent.parentId
      continue
    }

    const updated: GanttDateNode = {
      ...parent,
      start: coverStart,
      finish: coverFinish,
    }
    updates.push(updated)
    tasksById.set(parent.id, updated)
    parentId = parent.parentId
  }

  return updates
}

/**
 * @deprecated Use rollupAncestorsToChildren — kept for expand-only callers.
 * Expand-only: never shrinks.
 */
export function expandAncestorsForChild(
  tasksById: Map<string, GanttDateNode>,
  childId: string,
  childStart: string,
  childFinish: string
): GanttDateNode[] {
  const start = toIsoDateOnly(childStart)
  const finish = toIsoDateOnly(childFinish)
  if (!start || !finish) return []

  const child = tasksById.get(childId)
  if (child) {
    child.start = start
    child.finish = finish
    tasksById.set(childId, child)
  }
  // Prefer full rollup so shrink works too
  return rollupAncestorsToChildren(tasksById, childId)
}

/** Apply a drag/resize on one task and roll up parent/header bars. */
export function applyGanttDateChange(
  tasks: GanttDateNode[],
  taskId: string,
  nextStart: string,
  nextFinish: string
): GanttDateNode[] {
  const start = toIsoDateOnly(nextStart)
  const finish = toIsoDateOnly(nextFinish)
  if (!start || !finish) return []
  if (finish < start) return []

  const cloned = tasks.map((t) => ({ ...t }))
  linkParentsFromWbs(cloned)
  const map = new Map(cloned.map((t) => [t.id, t]))
  const current = map.get(taskId)
  if (!current) return []

  current.start = start
  current.finish = finish
  map.set(taskId, current)

  const ancestors = rollupAncestorsToChildren(map, taskId)
  return [current, ...ancestors]
}

export function durationDaysFromRange(start: string, finish: string): number {
  const s = toIsoDateOnly(start)
  const f = toIsoDateOnly(finish)
  if (!s || !f) return 0
  return Math.max(0, diffDaysIso(s, f))
}

export function shiftRangeByDays(
  start: string,
  finish: string,
  deltaDays: number
): { start: string; finish: string } | null {
  const s = toIsoDateOnly(start)
  const f = toIsoDateOnly(finish)
  if (!s || !f) return null
  return {
    start: addDaysIso(s, deltaDays),
    finish: addDaysIso(f, deltaDays),
  }
}

export function resizeRangeEdge(
  start: string,
  finish: string,
  edge: 'start' | 'finish',
  deltaDays: number
): { start: string; finish: string } | null {
  const s = toIsoDateOnly(start)
  const f = toIsoDateOnly(finish)
  if (!s || !f) return null
  if (edge === 'start') {
    const nextStart = addDaysIso(s, deltaDays)
    if (nextStart > f) return { start: f, finish: f }
    return { start: nextStart, finish: f }
  }
  const nextFinish = addDaysIso(f, deltaDays)
  if (nextFinish < s) return { start: s, finish: s }
  return { start: s, finish: nextFinish }
}
