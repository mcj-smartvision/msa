import type { SupabaseClient } from '@supabase/supabase-js'
import {
buildWeeklyCommitments,
PPC_HISTORY_WEEKS,
RNC_WINDOW_WEEKS,
type WeeklyCommitmentsResult,
type WwpCommitmentRow,
type WwpWeekRow,
} from './weekly-commitments'

function isMissingRelation(message: string | undefined): boolean {
  return /does not exist|schema cache|Could not find/i.test(message ?? '')
}

const MISSING_TABLES =
  'جدول‌های برنامهٔ هفتگی متعهد (WWP) هنوز روی پایگاه داده اجرا نشده‌اند (database/100-weekly-work-plans.sql)'

const num = (value: unknown): number | null => {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Closed WWP weeks (PPC history), the latest week's commitments and the RNC window. Read-only. */
export async function loadWeeklyCommitments(service: SupabaseClient, projectId: string): Promise<WeeklyCommitmentsResult> {
  const weeksRes = await service
    .from('wwp_weekly_ppc')
    .select('wwp_id, week_number, start_date, end_date, planned_count, completed_count')
    .eq('project_id', projectId)
    .order('start_date', { ascending: false })
    .limit(PPC_HISTORY_WEEKS)
  if (weeksRes.error) {
    if (isMissingRelation(weeksRes.error.message)) return { status: 'missing', reason_fa: MISSING_TABLES }
    throw new Error(weeksRes.error.message)
  }

  const weeks: WwpWeekRow[] = (weeksRes.data ?? []).map((row: Record<string, unknown>) => ({
    wwpId: String(row.wwp_id),
    weekNumber: Number(row.week_number),
    start: String(row.start_date),
    end: String(row.end_date),
    planned: Number(row.planned_count) || 0,
    completed: Number(row.completed_count) || 0,
  }))
  if (weeks.length === 0) {
    return { status: 'missing', reason_fa: 'هنوز هیچ هفته‌ای از برنامهٔ هفتگی متعهد (WWP) بسته و ارزیابی نشده است' }
  }

  const windowIds = weeks.slice(0, RNC_WINDOW_WEEKS).map((w) => w.wwpId)
  const commitmentsRes = await service
    .from('wwp_commitments')
    .select('wwp_id, description, wbs_code, is_completed, root_cause_category, root_cause_note, planned_output, actual_output, sort_order')
    .in('wwp_id', windowIds)
  if (commitmentsRes.error) throw new Error(commitmentsRes.error.message)

  const commitments: WwpCommitmentRow[] = (commitmentsRes.data ?? []).map((row: Record<string, unknown>) => ({
    wwpId: String(row.wwp_id),
    description: String(row.description ?? ''),
    wbs: row.wbs_code == null ? null : String(row.wbs_code),
    isCompleted: typeof row.is_completed === 'boolean' ? row.is_completed : null,
    rootCause: row.root_cause_category == null ? null : String(row.root_cause_category),
    rootCauseNote: row.root_cause_note == null ? null : String(row.root_cause_note),
    plannedOutput: num(row.planned_output),
    actualOutput: num(row.actual_output),
    sortOrder: Number(row.sort_order) || 0,
  }))

  return { status: 'ok', data: buildWeeklyCommitments(weeks, commitments) }
}
