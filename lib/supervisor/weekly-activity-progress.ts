import { dailyReportActivityLookupIds, type DailyProgressEntry } from '@/lib/supervisor/daily-report-activities'

/** Saturday → Thursday; Friday is the weekly day off. */
export const SITE_WEEK_DAY_LABELS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه'] as const

export interface WeekDayProgress {
  date: string
  label: string
  /** Progress gained that day (today's cumulative − the previous cumulative); null when nothing was reported. */
  daily: number | null
  /** Cumulative percent at the end of that day (carried over from the last report); null for future days. */
  cumulative: number | null
  future: boolean
}

export interface ActivityWeekProgress {
  weekStart: string
  weekEnd: string
  days: WeekDayProgress[]
  /** Cumulative at the week's last day (Thursday), or up to `reportDate` while the week is running. */
  endCumulative: number | null
  weekComplete: boolean
}

/** Rows of GET /api/supervisor/daily-progress (`task_progress_updates` / `package_progress_updates`). */
export interface ServerProgressRow {
  task_id?: string
  package_id?: string
  progress_date: string
  percent_complete: number | string
  created_at?: string | null
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Saturday that starts the week containing `iso`. */
export function siteWeekStart(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return addDays(iso, -((dow + 1) % 7))
}

/** Server progress history as daily entries; the latest saved row of each activity and day wins. */
export function historyFromServer(updates: ServerProgressRow[], packageUpdates: ServerProgressRow[] = []): DailyProgressEntry[] {
  const latest = new Map<string, DailyProgressEntry>()
  const add = (row: ServerProgressRow, activityId: string) => {
    const reportDate = String(row.progress_date).slice(0, 10)
    const key = `${activityId}@${reportDate}`
    const prev = latest.get(key)
    const savedAt = row.created_at ?? undefined
    if (prev && (prev.savedAt ?? '') > (savedAt ?? '')) return
    latest.set(key, { activityId, reportDate, percentComplete: Number(row.percent_complete) || 0, savedAt })
  }
  for (const row of updates) if (row.task_id) add(row, `schedule:${row.task_id}`)
  for (const row of packageUpdates) if (row.package_id) add(row, `package:${row.package_id}`)
  return Array.from(latest.values())
}

/** One entry per activity and day from both sources; the more recently saved one wins. */
export function mergeProgressHistory(server: DailyProgressEntry[], local: DailyProgressEntry[]): DailyProgressEntry[] {
  const keyOf = (e: DailyProgressEntry) => `${e.activityId.replace(/^(schedule|package):/, '')}@${e.reportDate}`
  const merged = new Map<string, DailyProgressEntry>()
  for (const e of server) merged.set(keyOf(e), e)
  for (const e of local) {
    const key = keyOf(e)
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, e)
      continue
    }
    const localWins = (e.savedAt ?? '') >= (prev.savedAt ?? '')
    const winner = localWins ? e : prev
    const loser = localWins ? prev : e
    const increment = winner.dailyIncrement ?? (loser.percentComplete === winner.percentComplete ? loser.dailyIncrement : undefined)
    merged.set(key, increment == null ? winner : { ...winner, dailyIncrement: increment })
  }
  return Array.from(merged.values())
}

function activityEntries(activityId: string, entries: DailyProgressEntry[]): DailyProgressEntry[] {
  const keys = new Set(dailyReportActivityLookupIds(activityId))
  const byDate = new Map<string, DailyProgressEntry>()
  for (const e of entries) {
    if (!keys.has(e.activityId)) continue
    const prev = byDate.get(e.reportDate)
    if (!prev || (e.savedAt ?? '') >= (prev.savedAt ?? '')) byDate.set(e.reportDate, e)
  }
  return Array.from(byDate.values()).sort((a, b) => a.reportDate.localeCompare(b.reportDate))
}

/**
 * Cumulative percent of an activity before `date`: the last report before that day; else, when the
 * first report recorded its daily increment, what it started from; else zero, so the supervisor's first
 * report counts in full as that day's progress. The schedule percent only for a never-reported activity.
 */
export function cumulativeBefore(activityId: string, entries: DailyProgressEntry[], date: string, baselinePercent = 0): number | null {
  const pool = activityEntries(activityId, entries)
  if (pool.length === 0) return baselinePercent
  const before = pool.filter((e) => e.reportDate < date).at(-1)
  if (before) return before.percentComplete
  const first = pool[0]!
  if (first.dailyIncrement != null) return Math.max(0, round2(first.percentComplete - first.dailyIncrement))
  return 0
}

export interface ReportedDayProgress {
  date: string
  /** Progress gained that day; null when it cannot be known. */
  daily: number | null
  cumulative: number
}

/** Every reported day of one activity, oldest first, with the progress gained that day. */
export function reportedDays(activityId: string, entries: DailyProgressEntry[], baselinePercent = 0): ReportedDayProgress[] {
  const pool = activityEntries(activityId, entries)
  if (pool.length === 0) return []
  let running = cumulativeBefore(activityId, entries, pool[0]!.reportDate, baselinePercent)
  return pool.map((e) => {
    const daily = running == null ? e.dailyIncrement ?? null : round2(e.percentComplete - running)
    running = e.percentComplete
    return { date: e.reportDate, daily, cumulative: e.percentComplete }
  })
}

/** Calendar days from `from` to `to`, inclusive. */
export function calendarDays(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** The entry of one activity on one day, if any. */
export function entryOn(activityId: string, entries: DailyProgressEntry[], date: string): DailyProgressEntry | null {
  return activityEntries(activityId, entries).find((e) => e.reportDate === date) ?? null
}

/**
 * The entry that sets an activity's cumulative percent on `date` (0–100). Other days keep their own
 * cumulative; the daily progress is the rise over the last report before that day (in full for the first).
 */
export function cumulativeEntry(
  activityId: string,
  entries: DailyProgressEntry[],
  date: string,
  percent: number
): DailyProgressEntry {
  const percentComplete = round2(Math.min(100, Math.max(0, percent)))
  const before = activityEntries(activityId, entries).filter((e) => e.reportDate < date).at(-1)
  return { activityId, reportDate: date, percentComplete, dailyIncrement: round2(percentComplete - (before?.percentComplete ?? 0)) }
}

/** `entries` without the reports of `activityId` (under any of its id forms) on `date`. */
export function withoutDay(activityId: string, entries: DailyProgressEntry[], date: string): DailyProgressEntry[] {
  const keys = new Set(dailyReportActivityLookupIds(activityId))
  return entries.filter((e) => e.reportDate !== date || !keys.has(e.activityId))
}

/** The latest report of an activity, if any. */
export function latestReport(activityId: string, entries: DailyProgressEntry[]): DailyProgressEntry | null {
  return activityEntries(activityId, entries).at(-1) ?? null
}

/**
 * `changed` plus, per activity, its latest report after the changed days (taken from `entries`), so that
 * posting them oldest first leaves the schedule on each activity's latest percent.
 */
export function withLatestReports(changed: DailyProgressEntry[], entries: DailyProgressEntry[]): DailyProgressEntry[] {
  const lastChanged = new Map<string, string>()
  for (const e of changed) {
    if ((lastChanged.get(e.activityId) ?? '') < e.reportDate) lastChanged.set(e.activityId, e.reportDate)
  }
  const out = [...changed]
  for (const [activityId, date] of lastChanged) {
    const latest = activityEntries(activityId, entries).at(-1)
    if (latest && latest.reportDate > date) out.push({ ...latest, activityId })
  }
  return out
}

/**
 * Daily progress of one activity over the Saturday–Thursday week containing `reportDate`.
 * Each day's point is the increase reported that day; the week closes with Thursday's cumulative.
 */
export function buildActivityWeekProgress(
  activityId: string,
  entries: DailyProgressEntry[],
  reportDate: string,
  baselinePercent = 0
): ActivityWeekProgress {
  const weekStart = siteWeekStart(reportDate)
  const weekEnd = addDays(weekStart, SITE_WEEK_DAY_LABELS.length - 1)
  const byDate = new Map(activityEntries(activityId, entries).map((e) => [e.reportDate, e]))

  let running = cumulativeBefore(activityId, entries, weekStart, baselinePercent)
  let endCumulative: number | null = null
  const days = SITE_WEEK_DAY_LABELS.map<WeekDayProgress>((label, i) => {
    const date = addDays(weekStart, i)
    if (date > reportDate) return { date, label, daily: null, cumulative: null, future: true }
    const entry = byDate.get(date)
    let daily: number | null = null
    if (entry) {
      daily = running == null ? entry.dailyIncrement ?? null : round2(entry.percentComplete - running)
      running = entry.percentComplete
    }
    endCumulative = running
    return { date, label, daily, cumulative: running, future: false }
  })

  return { weekStart, weekEnd, days, endCumulative, weekComplete: reportDate >= weekEnd }
}

export interface ActivityProgressWeek extends ActivityWeekProgress {
  /** 1 for the week of the first report. */
  index: number
  /** Progress gained over the week's reported days; null when nothing was reported. */
  gain: number | null
}

/**
 * Saturday–Thursday weeks from the first day the activity was reported with progress up to the week of
 * `reportDate`; the first week starts on that day. Only the current week before any progress.
 */
export function buildActivityProgressTimeline(
  activityId: string,
  entries: DailyProgressEntry[],
  reportDate: string,
  baselinePercent = 0
): ActivityProgressWeek[] {
  const current = siteWeekStart(reportDate)
  const first = activityEntries(activityId, entries).find(
    (e) => e.reportDate <= reportDate && (e.percentComplete > 0 || (e.dailyIncrement ?? 0) > 0)
  )
  const firstDay = first?.reportDate ?? current
  const weeks: ActivityProgressWeek[] = []
  for (let ws = siteWeekStart(firstDay), index = 1; ws <= current; ws = addDays(ws, 7), index++) {
    const we = addDays(ws, SITE_WEEK_DAY_LABELS.length - 1)
    const full = buildActivityWeekProgress(activityId, entries, reportDate < we ? reportDate : we, baselinePercent)
    const week = { ...full, days: full.days.filter((d) => d.date >= firstDay) }
    const dailies = week.days.map((d) => d.daily).filter((v): v is number => v != null)
    weeks.push({ ...week, index, gain: dailies.length ? round2(dailies.reduce((a, b) => a + b, 0)) : null })
  }
  return weeks
}
