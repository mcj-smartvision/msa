import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchProgressHistory } from '@/features/schedule/lib/progress-history'
import { groupWindows } from '@/features/schedule/lib/week-commitment-windows'
import { computeCommitmentWindows } from '@/features/schedule/lib/week-commitments'
import { buildDailyReportActivitiesFromTree } from '@/features/supervisor/lib/daily-report-activities'
import { getScheduleTree } from '@/features/workshop/lib/service'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { buildScheduleCommitments } from './schedule-commitments'
import type { WeeklyCommitmentsResult } from './weekly-commitments'

/** Schedule-based PPC: the same activities and progress history as the supervisor's daily report. */
export async function loadScheduleCommitments(
  supabase: SupabaseClient,
  service: SupabaseClient,
  projectId: string
): Promise<WeeklyCommitmentsResult> {
  const today = todayTehranIso()
  const [tree, entries, windowRows] = await Promise.all([
    getScheduleTree(supabase, projectId),
    fetchProgressHistory(service, projectId),
    computeCommitmentWindows(service, projectId, today),
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
  })
  if (!data) {
    return { status: 'missing', reason_fa: 'هیچ فعالیتی با تاریخ برنامه‌ریزی‌شده در برنامهٔ زمان‌بندی نیست' }
  }
  return { status: 'ok', data }
}
