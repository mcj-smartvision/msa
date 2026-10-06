import type { SupabaseClient } from '@supabase/supabase-js';
import type { WeeklyPlanCounts } from '@/shared/types/project-controls';

export type WeeklyPlanLoad =
  | { status: 'ok'; counts: WeeklyPlanCounts; wwpId: string; weekNumber: number }
  | { status: 'missing'; reason_fa: string }

function isMissingRelation(message: string | undefined): boolean {
  return /does not exist|schema cache|Could not find/i.test(message ?? '')
}

/** Latest CLOSED week of the committed weekly work plan: the only source PPC may use. */
export async function loadLatestClosedWeeklyPlan(service: SupabaseClient, projectId: string): Promise<WeeklyPlanLoad> {
  const { data, error } = await service
    .from('wwp_weekly_ppc')
    .select('wwp_id, week_number, start_date, end_date, planned_count, completed_count')
    .eq('project_id', projectId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingRelation(error.message)) {
      return {
        status: 'missing',
        reason_fa: 'جدول‌های برنامهٔ هفتگی متعهد (WWP) هنوز روی پایگاه داده اجرا نشده‌اند (database/100-weekly-work-plans.sql)',
      }
    }
    throw new Error(error.message)
  }
  if (!data) {
    return { status: 'missing', reason_fa: 'هنوز هیچ هفته‌ای از برنامهٔ هفتگی متعهد (WWP) بسته نشده است' }
  }

  const row = data as Record<string, unknown>
  return {
    status: 'ok',
    wwpId: String(row.wwp_id),
    weekNumber: Number(row.week_number),
    counts: {
      planned: Number(row.planned_count) || 0,
      completed: Number(row.completed_count) || 0,
      weekStart: String(row.start_date),
      weekEnd: String(row.end_date),
    },
  }
}
