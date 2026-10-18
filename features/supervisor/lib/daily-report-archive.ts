/**
 * @file features/supervisor/lib/daily-report-archive.ts
 * @purpose فهرست گزارش‌های آرشیو شده (ارسال‌شده / تأییدشده)
 * @safe-to-edit YES
 * @affects صفحه آرشیو گزارش روزانه
 * @depends-on features/supervisor/lib/daily-report-workflow, features/supervisor/lib/daily-report-photos, features/weather/lib/report-stamp
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDailyReportNo } from '@/features/supervisor/lib/daily-report-photos'
import { normalizeReportDate } from '@/features/supervisor/lib/normalize-report-date'
import { parseWorkflowStatus } from '@/features/supervisor/lib/daily-report-workflow'
import { parseWeatherSnapshot } from '@/features/weather/lib/report-stamp'
import type { DailyWeatherSnapshot } from '@/features/weather/lib/types'

export type ArchivedDailyReportRow = {
  id: string
  reportNo: string
  reportDate: string
  note: string
  /** Always archived for UI — manager approval is not required. */
  status: 'archived'
  submittedAt: string | null
  weather: DailyWeatherSnapshot | null
  structuredJson: unknown | null
}

const COLUMN_MISSING = /schema cache|column|does not exist/i

function isArchivedRow(row: {
  workflow_status?: unknown
  approved_by_manager?: unknown
  submitted_to_manager_at?: unknown
  finalized_at?: unknown
}): boolean {
  if (row.approved_by_manager === true) return true
  const status = parseWorkflowStatus(row.workflow_status)
  if (status === 'approved' || status === 'submitted' || status === 'finalized') return true
  if (typeof row.submitted_to_manager_at === 'string' && row.submitted_to_manager_at.trim()) return true
  return false
}

/** Submitted/approved daily reports for archive UI (one card per report row). */
export async function listArchivedDailyReports(
  supabase: SupabaseClient,
  projectId: string,
  supervisorId?: string
): Promise<ArchivedDailyReportRow[]> {
  const attempts = [
    'id, report_no, report_date, raw_text, workflow_status, approved_by_manager, submitted_to_manager_at, finalized_at, weather_json, structured_json, site_supervisor_id',
    'id, report_no, report_date, raw_text, workflow_status, approved_by_manager, submitted_to_manager_at, finalized_at, weather_json, site_supervisor_id',
    'id, report_no, report_date, raw_text, approved_by_manager, submitted_to_manager_at, finalized_at, weather_json, site_supervisor_id',
    'id, report_no, report_date, raw_text, site_supervisor_id',
  ]

  let data: Record<string, unknown>[] | null = null
  let lastError: { message: string } | null = null

  for (const select of attempts) {
    let q = supabase.from('daily_reports').select(select).eq('project_id', projectId)
    if (supervisorId) q = q.eq('site_supervisor_id', supervisorId)
    const res = await q.order('report_date', { ascending: false })
    if (!res.error) {
      data = (res.data ?? []) as unknown as Record<string, unknown>[]
      lastError = null
      break
    }
    lastError = res.error
    if (!COLUMN_MISSING.test(res.error.message)) break
  }

  if (lastError) {
    throw new Error(lastError.message)
  }

  const out: ArchivedDailyReportRow[] = []
  for (const row of data ?? []) {
    const hasWorkflowCols = 'workflow_status' in row || 'submitted_to_manager_at' in row
    const reportDate = normalizeReportDate(row.report_date)
    if (!reportDate) continue
    const id = String(row.id ?? '')
    if (!id) continue
    const note = typeof row.raw_text === 'string' ? row.raw_text.trim() : ''

    const archived = hasWorkflowCols ? isArchivedRow(row) : Boolean(note)
    if (!archived) continue

    const reportNo =
      typeof row.report_no === 'string' && row.report_no.trim()
        ? row.report_no.trim()
        : buildDailyReportNo(reportDate, id)
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
      status: 'archived',
      submittedAt,
      weather: parseWeatherSnapshot(row.weather_json),
      structuredJson: row.structured_json ?? null,
    })
  }

  out.sort((a, b) => {
    const ta = a.submittedAt ? Date.parse(a.submittedAt) : 0
    const tb = b.submittedAt ? Date.parse(b.submittedAt) : 0
    if (tb !== ta) return tb - ta
    return b.reportDate.localeCompare(a.reportDate) || b.reportNo.localeCompare(a.reportNo)
  })
  return out
}
