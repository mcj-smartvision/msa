/**
 * @file features/supervisor/lib/daily-report-archive.ts
 * @purpose فهرست گزارش‌های آرشیو شده (ارسال‌شده / تأییدشده)
 * @safe-to-edit YES
 * @affects صفحه آرشیو گزارش روزانه
 * @depends-on features/supervisor/lib/daily-report-workflow, features/supervisor/lib/daily-report-photos, features/weather/lib/report-stamp
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDailyReportNo } from '@/features/supervisor/lib/daily-report-photos'
import { parseWorkflowStatus } from '@/features/supervisor/lib/daily-report-workflow'
import { parseWeatherSnapshot } from '@/features/weather/lib/report-stamp'
import type { DailyWeatherSnapshot } from '@/features/weather/lib/types'

export type ArchivedDailyReportRow = {
  id: string
  reportNo: string
  reportDate: string
  note: string
  status: 'submitted' | 'approved'
  submittedAt: string | null
  weather: DailyWeatherSnapshot | null
}

const WORKFLOW_MISSING = /workflow_status|schema cache|column/i

function archivedStatusOf(row: {
  workflow_status?: unknown
  approved_by_manager?: unknown
  submitted_to_manager_at?: unknown
}): 'submitted' | 'approved' | null {
  if (row.approved_by_manager === true) return 'approved'
  const status = parseWorkflowStatus(row.workflow_status)
  if (status === 'approved') return 'approved'
  if (status === 'submitted') return 'submitted'
  if (typeof row.submitted_to_manager_at === 'string' && row.submitted_to_manager_at.trim()) {
    return 'submitted'
  }
  return null
}

/** Submitted/approved daily reports for archive UI (one card per report row). */
export async function listArchivedDailyReports(
  supabase: SupabaseClient,
  projectId: string,
  supervisorId?: string
): Promise<ArchivedDailyReportRow[]> {
  const selectFull =
    'id, report_no, report_date, raw_text, workflow_status, approved_by_manager, submitted_to_manager_at, finalized_at, weather_json, site_supervisor_id'
  const selectLegacy =
    'id, report_no, report_date, raw_text, approved_by_manager, submitted_to_manager_at, finalized_at, weather_json, site_supervisor_id'

  let built = supabase.from('daily_reports').select(selectFull).eq('project_id', projectId)
  if (supervisorId) built = built.eq('site_supervisor_id', supervisorId)
  let { data, error } = await built
    .order('report_date', { ascending: false })
    .order('submitted_to_manager_at', { ascending: false })

  if (error && WORKFLOW_MISSING.test(error.message)) {
    let legacy = supabase.from('daily_reports').select(selectLegacy).eq('project_id', projectId)
    if (supervisorId) legacy = legacy.eq('site_supervisor_id', supervisorId)
    ;({ data, error } = await legacy.order('report_date', { ascending: false }))
  }

  if (error) {
    if (/daily_reports|schema cache|does not exist/i.test(error.message)) return []
    throw new Error(error.message)
  }

  const out: ArchivedDailyReportRow[] = []
  for (const row of data ?? []) {
    const status = archivedStatusOf(row)
    if (!status) continue
    const reportDate = String(row.report_date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) continue
    const id = String(row.id)
    const reportNo =
      typeof row.report_no === 'string' && row.report_no.trim()
        ? row.report_no.trim()
        : buildDailyReportNo(reportDate, id)
    const note = typeof row.raw_text === 'string' ? row.raw_text.trim() : ''
    const submittedAt =
      typeof row.submitted_to_manager_at === 'string'
        ? row.submitted_to_manager_at
        : typeof row.finalized_at === 'string'
          ? row.finalized_at
          : null
    out.push({
      id,
      reportNo,
      reportDate,
      note: note || '—',
      status,
      submittedAt,
      weather: parseWeatherSnapshot(row.weather_json),
    })
  }
  return out
}
