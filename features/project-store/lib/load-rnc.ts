/**
 * @file features/project-store/lib/load-rnc.ts
 * @purpose منطق دامنه — ذخیره پیشرفت و overlay اعداد داشبورد (load-rnc)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on features/manager/lib/schedule-commitments
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { rncKey, type CommitmentRnc } from '@/features/manager/lib/schedule-commitments'

export interface RncRow {
  activityId: string
  weekStart: string
  category: string
  note: string | null
}

export const RNC_MISSING_TABLE = 'جدول علت عدم تحقق ساخته نشده (database/108-weekly-commitment-rnc.sql را اجرا کنید).'

const isMissingRelation = (message: string | undefined) => /does not exist|schema cache|Could not find/i.test(message ?? '')

/** Recorded RNCs of a project; empty (with `missing`) until migration 108 is applied. */
export async function loadCommitmentRnc(service: SupabaseClient, projectId: string): Promise<{ rows: RncRow[]; missing: boolean }> {
  const { data, error } = await service
    .from('weekly_commitment_rnc')
    .select('activity_id, week_start, category, note')
    .eq('project_id', projectId)
    .order('week_start', { ascending: false })
    .limit(2000)
  if (error) {
    if (isMissingRelation(error.message)) return { rows: [], missing: true }
    throw new Error(error.message)
  }
  return {
    rows: (data ?? []).map((r: Record<string, unknown>) => ({
      activityId: String(r.activity_id),
      weekStart: String(r.week_start).slice(0, 10),
      category: String(r.category),
      note: r.note == null ? null : String(r.note),
    })),
    missing: false,
  }
}

export function rncMap(rows: RncRow[]): Map<string, CommitmentRnc> {
  return new Map(rows.map((r) => [rncKey(r.activityId, r.weekStart), { category: r.category, note: r.note }]))
}
