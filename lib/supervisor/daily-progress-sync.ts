import type { DailyProgressEntry } from '@/lib/supervisor/daily-report-activities'
import { publishScheduleViewSync } from '@/lib/schedule/schedule-view-sync'

/**
 * Sends the cumulative percents of `dates` to POST /api/supervisor/daily-progress, which writes the
 * schedule rows and the progress history. Dates go oldest first so the schedule ends on the latest value.
 */
export async function postDailyProgress(
  projectId: string,
  entries: DailyProgressEntry[],
  dates: string[]
): Promise<void> {
  let synced = false
  for (const date of [...new Set(dates)].sort()) {
    const byActivity = new Map<string, number>()
    for (const entry of entries) {
      if (entry.reportDate === date) byActivity.set(entry.activityId, entry.percentComplete)
    }
    const updates = [...byActivity.entries()].map(([activityId, percentComplete]) => ({ activityId, percentComplete }))
    if (updates.length === 0) continue

    const res = await fetch('/api/supervisor/daily-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, reportDate: date, updates }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'ذخیره پیشرفت در برنامه ناموفق بود')
    }
    synced = true
  }
  if (synced) publishScheduleViewSync(projectId)
}
