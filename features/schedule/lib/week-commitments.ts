import type { SupabaseClient } from '@supabase/supabase-js'
import { loadForecastInputs } from '@/features/schedule/lib/persist-progress-forecast'
import { fetchProgressHistory } from '@/features/schedule/lib/progress-history'
import { replayWindows } from '@/features/schedule/lib/replay-week-windows'
import { compressWindows, type WindowChange } from '@/features/schedule/lib/week-commitment-windows'
import { buildDailyReportActivitiesFromTree } from '@/features/supervisor/lib/daily-report-activities'
import { loadScheduleTree } from '@/features/workshop/lib/service'
import { todayTehranIso } from '@/shared/lib/time/tehran'

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/**
 * The commitment window of every daily-report activity day by day (replayWindows), on the site work
 * calendar, from the first planned start until tomorrow; tomorrow's window holds for every later day.
 * Only the days a window changes are returned.
 */
export async function computeCommitmentWindows(
  supabase: SupabaseClient,
  projectId: string,
  today: string = todayTehranIso()
): Promise<WindowChange[]> {
  const [{ tasks, links, isWorkday }, tree, entries] = await Promise.all([
    loadForecastInputs(supabase, projectId),
    loadScheduleTree(supabase, projectId),
    fetchProgressHistory(supabase, projectId),
  ])
  const starts = tasks.map((t) => t.plannedStart).filter((d): d is string => !!d).sort()
  if (starts.length === 0) return []
  const dates: string[] = []
  for (let d = starts[0]!; d <= addDays(today, 1); d = addDays(d, 1)) dates.push(d)

  const activities = buildDailyReportActivitiesFromTree(tree.nodes, tree.orphanPackages).map((a) => ({
    id: a.id,
    taskId: a.parentTaskId ?? null,
    weight: a.progressWeight,
  }))
  return compressWindows(replayWindows({ tasks, links, activities, entries, dates, isWorkday }))
}
