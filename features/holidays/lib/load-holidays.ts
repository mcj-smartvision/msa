import type { SupabaseClient } from '@supabase/supabase-js'
import { holidayFromRow, type Holiday } from '@/features/holidays/lib/types'
import { siteWorkCalendar, type IsWorkday } from '@/features/holidays/lib/work-calendar'

export async function loadHolidays(supabase: SupabaseClient): Promise<Holiday[]> {
  const { data, error } = await supabase.from('holidays').select('*').order('start_date')
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(holidayFromRow)
}

/** The site work calendar (Friday and active holidays off). */
export async function loadSiteWorkCalendar(supabase: SupabaseClient): Promise<IsWorkday> {
  return siteWorkCalendar(await loadHolidays(supabase))
}
