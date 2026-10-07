import type { SupabaseClient } from '@supabase/supabase-js'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { historyFromServer, type ServerProgressRow } from '@/features/supervisor/lib/weekly-activity-progress'

async function fetchAll(supabase: SupabaseClient, table: string, idColumn: string, projectId: string): Promise<ServerProgressRow[]> {
  const rows: ServerProgressRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(`${idColumn}, progress_date, percent_complete, created_at`)
      .eq('project_id', projectId)
      .order('progress_date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) {
      if (/does not exist|schema cache|Could not find/i.test(error.message)) return rows
      throw new Error(error.message)
    }
    rows.push(...((data ?? []) as unknown as ServerProgressRow[]))
    if ((data ?? []).length < pageSize) return rows
  }
}

/** Every daily-report percent of the project (tasks and workshop packages) as daily entries. */
export async function fetchProgressHistory(supabase: SupabaseClient, projectId: string): Promise<DailyProgressEntry[]> {
  const [taskRows, packageRows] = await Promise.all([
    fetchAll(supabase, 'task_progress_updates', 'task_id', projectId),
    fetchAll(supabase, 'package_progress_updates', 'package_id', projectId),
  ])
  return historyFromServer(taskRows, packageRows)
}
