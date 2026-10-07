/** An activity's commitment window from `from` on (until its next change). */
export interface WindowChange {
  from: string
  activityId: string
  start: string
  finish: string | null
}

export interface ActivityWindow {
  start: string | null
  finish: string | null
}

/** Window changes per activity, oldest first. */
export type ActivityWindows = Map<string, WindowChange[]>

export function groupWindows(rows: WindowChange[]): ActivityWindows {
  const out: ActivityWindows = new Map()
  for (const row of rows) {
    const list = out.get(row.activityId) ?? []
    list.push(row)
    out.set(row.activityId, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.from.localeCompare(b.from))
  return out
}

/** Keeps only the rows where an activity's window differs from its previous day's. */
export function compressWindows(rows: WindowChange[]): WindowChange[] {
  const last = new Map<string, WindowChange>()
  const out: WindowChange[] = []
  for (const row of [...rows].sort((a, b) => a.from.localeCompare(b.from))) {
    const prev = last.get(row.activityId)
    if (prev && prev.start === row.start && prev.finish === row.finish) continue
    last.set(row.activityId, row)
    out.push(row)
  }
  return out
}

/** The window in force on `date`: the latest change on or before it, else `fallback` (the approved plan). */
export function windowOn(windows: ActivityWindows, activityId: string, date: string, fallback: ActivityWindow): ActivityWindow {
  let found: WindowChange | null = null
  for (const row of windows.get(activityId) ?? []) {
    if (row.from > date) break
    found = row
  }
  return found ? { start: found.start, finish: found.finish } : fallback
}

/** Dates at which an activity's window changes, with the window used from then on. */
export function windowSegments(
  windows: ActivityWindows,
  activityId: string,
  fallback: ActivityWindow
): { from: string | null; window: ActivityWindow }[] {
  return [
    { from: null, window: fallback },
    ...(windows.get(activityId) ?? []).map((r) => ({ from: r.from, window: { start: r.start, finish: r.finish } })),
  ]
}
