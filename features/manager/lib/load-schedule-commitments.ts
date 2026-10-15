import type { SupabaseClient } from '@supabase/supabase-js'
import { loadHolidays } from '@/features/holidays/lib/load-holidays'
import { siteWorkCalendar } from '@/features/holidays/lib/work-calendar'
import { loadCommitmentRnc, rncMap } from '@/features/project-store/lib/load-rnc'
import { fetchProgressHistory } from '@/features/schedule/lib/progress-history'
import { groupWindows } from '@/features/schedule/lib/week-commitment-windows'
import { computeCommitmentWindows } from '@/features/schedule/lib/week-commitments'
import { buildDailyReportActivitiesFromTree } from '@/features/supervisor/lib/daily-report-activities'
import { getScheduleTree } from '@/features/workshop/lib/service'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { buildScheduleCommitments } from './schedule-commitments'
import type { WeeklyCommitmentsResult } from './weekly-commitments'

/** Schedule-based PPC: the same activities, progress history and weekly engine as the project store. */
export async function loadScheduleCommitments(
  supabase: SupabaseClient,
  service: SupabaseClient,
  projectId: string
): Promise<WeeklyCommitmentsResult> {
  const today = todayTehranIso()
  const [tree, entries, windowRows, holidays, rnc] = await Promise.all([
    getScheduleTree(supabase, projectId),
    fetchProgressHistory(service, projectId),
    computeCommitmentWindows(service, projectId, today),
    loadHolidays(service).catch(() => []),
    loadCommitmentRnc(service, projectId),
  ])

  const activities = buildDailyReportActivitiesFromTree(tree.nodes, tree.orphanPackages).map((a) => ({
    id: a.id,
    name: a.name,
    wbs: a.wbs,
    start: a.approvedStartDate || a.plannedStartDate || null,
    finish: a.approvedFinishDate || a.plannedFinishDate || null,
    baselinePercent: a.baselinePercentComplete ?? 0,
  }))

  const data = buildScheduleCommitments({
    activities,
    entries,
    today,
    windows: groupWindows(windowRows),
    isWorkday: siteWorkCalendar(holidays),
    rnc: rncMap(rnc.rows),
  })
  if (!data) {
    return { status: 'missing', reason_fa: 'هیچ فعالیتی با تاریخ برنامه‌ریزی‌شده در برنامهٔ زمان‌بندی نیست' }
  }
  return { status: 'ok', data }
}
