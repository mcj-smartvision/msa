import type { SupabaseClient } from '@supabase/supabase-js'
import { loadReportedForecastInputs } from '@/features/schedule/lib/persist-progress-forecast'
import { replayWindows } from '@/features/schedule/lib/replay-week-windows'
import { compressWindows, type WindowChange } from '@/features/schedule/lib/week-commitment-windows'
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
  const { tasks, links, isWorkday, activities, entries } = await loadReportedForecastInputs(supabase, projectId)
  const starts = tasks.map((t) => t.plannedStart).filter((d): d is string => !!d).sort()
  if (starts.length === 0) return []
  const dates: string[] = []
  for (let d = starts[0]!; d <= addDays(today, 1); d = addDays(d, 1)) dates.push(d)
  return compressWindows(replayWindows({ tasks, links, activities, entries, dates, isWorkday }))
}
