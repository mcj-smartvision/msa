import type { SupabaseClient } from '@supabase/supabase-js'
import { persistParentProgressRollup } from '@/features/schedule/lib/persist-parent-progress'
import { persistProgressForecast } from '@/features/schedule/lib/persist-progress-forecast'

/**
 * After progress is reported or removed: roll the heading percents up and re-forecast the current
 * dates. Each step logs and continues on failure so a saved report is never rejected because of them.
 */
export async function refreshScheduleAfterProgress(supabase: SupabaseClient, projectId: string): Promise<void> {
  const steps: [string, () => Promise<unknown>][] = [
    ['parent rollup', () => persistParentProgressRollup(supabase, projectId)],
    ['forecast', () => persistProgressForecast(supabase, projectId)],
  ]
  for (const [label, run] of steps) {
    try {
      await run()
    } catch (e) {
      console.error(`[refresh-after-progress] ${label}:`, e)
    }
  }
}
