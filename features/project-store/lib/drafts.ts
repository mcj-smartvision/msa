/**
 * @file features/project-store/lib/drafts.ts
 * @purpose منطق دامنه — ذخیره پیشرفت و overlay اعداد داشبورد (drafts)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on features/supervisor/lib/daily-report-activities, features/supervisor/lib/daily-progress-storage, features/supervisor/lib/weekly-activity-progress
 */

import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { upsertDailyEntries } from '@/features/supervisor/lib/daily-progress-storage'
import { cumulativeEntry, withoutDay } from '@/features/supervisor/lib/weekly-activity-progress'

/** Unsaved cumulative percents by `activityId@date`; null removes that day's report. */
export type ProgressDrafts = Record<string, number | null>

export const draftKey = (activityId: string, date: string) => `${activityId}@${date}`

export function parseDraftKey(key: string): { activityId: string; date: string } {
  const at = key.lastIndexOf('@')
  return { activityId: key.slice(0, at), date: key.slice(at + 1) }
}

/** Saved history with the drafts applied day by day, the entries they set and the days they remove. */
export function applyDrafts(
  history: DailyProgressEntry[],
  drafts: ProgressDrafts
): { preview: DailyProgressEntry[]; changed: DailyProgressEntry[]; removed: { activityId: string; reportDate: string }[] } {
  let working = history
  const changed: DailyProgressEntry[] = []
  const removed: { activityId: string; reportDate: string }[] = []
  for (const [key, value] of Object.entries(drafts).sort(([a], [b]) => a.localeCompare(b))) {
    const { activityId, date } = parseDraftKey(key)
    if (value == null) {
      working = withoutDay(activityId, working, date)
      removed.push({ activityId, reportDate: date })
      continue
    }
    const entry = cumulativeEntry(activityId, working, date, value)
    working = upsertDailyEntries(working, [entry])
    changed.push(entry)
  }
  return { preview: working, changed, removed }
}
