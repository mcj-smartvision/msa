/** @deprecated Use daily-report-activities.ts — mock data removed */
export type {
  DailyProgressEntry,
  DailyReportActivity,
} from '@/lib/supervisor/daily-report-activities'

export {
  activitiesEligibleForDailyReport,
  activityNeverReported,
  calculateProjectProgress,
  countRemainingForTodayReport,
  getLatestProgressForActivity,
  latestPercentOnOrBefore,
  latestPercentForActivity,
  hasEntryOnDate,
  buildDailyReportActivitiesFromTree,
} from '@/lib/supervisor/daily-report-activities'

/** @deprecated Use buildDailyReportActivitiesFromTree with schedule API */
export function getSchedulePlanActivities(): never {
  throw new Error('getSchedulePlanActivities is deprecated — load from workshop schedule tree')
}

/** @deprecated No longer seeded */
export function seedDailyProgressEntries(): never[] {
  return []
}

export type SchedulePlanActivity = import('@/lib/supervisor/daily-report-activities').DailyReportActivity
