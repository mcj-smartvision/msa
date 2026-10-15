import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { publishScheduleViewSync } from '@/features/schedule/lib/schedule-view-sync'
import type { DailyWeatherSnapshot } from '@/features/weather/lib/types'

export type DailyProgressMeta = {
  notesByDate?: Record<string, string>
  weatherByDate?: Record<string, DailyWeatherSnapshot>
}

/**
 * Sends the cumulative percents of `dates` to POST /api/supervisor/daily-progress, which writes the
 * schedule rows and the progress history. Dates go oldest first so the schedule ends on the latest value.
 * Optional note + weather snapshot land on daily_reports for later documents.
 */
export async function postDailyProgress(
  projectId: string,
  entries: DailyProgressEntry[],
  dates: string[],
  meta?: DailyProgressMeta
): Promise<void> {
  let synced = false
  const dateSet = new Set([...dates, ...Object.keys(meta?.notesByDate ?? {}), ...Object.keys(meta?.weatherByDate ?? {})])
  for (const date of [...dateSet].sort()) {
    const byActivity = new Map<string, number>()
    for (const entry of entries) {
      if (entry.reportDate === date) byActivity.set(entry.activityId, entry.percentComplete)
    }
    const updates = [...byActivity.entries()].map(([activityId, percentComplete]) => ({ activityId, percentComplete }))
    const note = meta?.notesByDate?.[date]
    const weather = meta?.weatherByDate?.[date]
    if (updates.length === 0 && !note && !weather) continue

    const res = await fetch('/api/supervisor/daily-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, reportDate: date, updates, note: note ?? null, weather: weather ?? null }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'ذخیره پیشرفت در برنامه ناموفق بود')
    }
    synced = true
  }
  if (synced) publishScheduleViewSync(projectId)
}

/** Removes the progress history of activities on given days via DELETE /api/supervisor/daily-progress. */
export async function deleteDailyProgress(
  projectId: string,
  deletions: { activityId: string; reportDate: string }[]
): Promise<void> {
  if (deletions.length === 0) return
  const res = await fetch('/api/supervisor/daily-progress', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, deletions }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'حذف گزارش ناموفق بود')
  publishScheduleViewSync(projectId)
}
