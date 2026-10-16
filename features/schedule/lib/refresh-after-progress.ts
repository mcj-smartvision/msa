/**
 * @file features/schedule/lib/refresh-after-progress.ts
 * @purpose منطق دامنه — زمان‌بندی، WBS و گانت (refresh-after-progress)
 * @safe-to-edit CAREFUL
 * @affects زمان‌بندی، WBS و گانت
 * @depends-on features/schedule/lib/persist-parent-progress, features/schedule/lib/persist-progress-forecast
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { persistParentProgressRollup } from '@/features/schedule/lib/persist-parent-progress'
import { persistProgressForecast } from '@/features/schedule/lib/persist-progress-forecast'

/**
 * After progress is reported or removed: re-forecast the current dates and sync the reported tasks'
 * percent and actual dates, then roll the heading percents up from them. Each step logs and continues
 * on failure so a saved report is never rejected because of them.
 */
export async function refreshScheduleAfterProgress(supabase: SupabaseClient, projectId: string): Promise<void> {
  const steps: [string, () => Promise<unknown>][] = [
    ['forecast', () => persistProgressForecast(supabase, projectId)],
    ['parent rollup', () => persistParentProgressRollup(supabase, projectId)],
  ]
  for (const [label, run] of steps) {
    try {
      await run()
    } catch (e) {
      console.error(`[refresh-after-progress] ${label}:`, e)
    }
  }
}
