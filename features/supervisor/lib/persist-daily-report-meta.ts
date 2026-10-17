/**
 * @file features/supervisor/lib/persist-daily-report-meta.ts
 * @purpose منطق دامنه — سرپرست کارگاه و گزارش روزانه (persist-daily-report-meta)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on features/weather/lib/report-stamp, features/weather/lib/types, features/supervisor/lib/daily-report-photos
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDailyReportNo } from '@/features/supervisor/lib/daily-report-photos'
import { normalizeReportDate } from '@/features/supervisor/lib/normalize-report-date'
import { parseWorkflowStatus } from '@/features/supervisor/lib/daily-report-workflow'
import { parseWeatherSnapshot } from '@/features/weather/lib/report-stamp'
import type { DailyWeatherSnapshot } from '@/features/weather/lib/types'

const WEATHER_COLUMN_MISSING = /weather_json|schema cache|column/i
const REPORT_NO_COLUMN_MISSING = /report_no|schema cache|column/i
const WORKFLOW_MISSING = /workflow_status|schema cache|column/i
const STRUCTURED_MISSING = /structured_json|schema cache|column/i
const SELECT_COLUMN_MISSING = /schema cache|column|does not exist/i

export type DailyReportHeader = {
  id: string
  reportNo: string
  reportDate: string
}

export type OpenDraftReport = DailyReportHeader & {
  note: string
  workflowStatus: 'draft' | 'finalized'
  structuredJson: unknown | null
}

function asParsed(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
}

function headerOf(id: string, reportDate: string, reportNo: string | null | undefined): DailyReportHeader {
  return {
    id,
    reportDate,
    reportNo:
      typeof reportNo === 'string' && reportNo.trim()
        ? reportNo.trim()
        : buildDailyReportNo(reportDate, id),
  }
}

/** Open editable draft for this supervisor on the project (at most one). */
export async function findOpenDraftReport(
  supabase: SupabaseClient,
  projectId: string,
  supervisorId: string
): Promise<OpenDraftReport | null> {
  const withWorkflow = await supabase
    .from('daily_reports')
    .select('id, report_no, report_date, raw_text, workflow_status, approved_by_manager, structured_json')
    .eq('project_id', projectId)
    .eq('site_supervisor_id', supervisorId)
    .in('workflow_status', ['draft', 'finalized'])
    .eq('approved_by_manager', false)
    .order('report_date', { ascending: false })
    .limit(1)

  if (withWorkflow.error && WORKFLOW_MISSING.test(withWorkflow.error.message)) {
    return null
  }
  let row = withWorkflow.data?.[0]
  if (withWorkflow.error && STRUCTURED_MISSING.test(withWorkflow.error.message)) {
    const fallback = await supabase
      .from('daily_reports')
      .select('id, report_no, report_date, raw_text, workflow_status, approved_by_manager')
      .eq('project_id', projectId)
      .eq('site_supervisor_id', supervisorId)
      .in('workflow_status', ['draft', 'finalized'])
      .eq('approved_by_manager', false)
      .order('report_date', { ascending: false })
      .limit(1)
    if (fallback.error) throw new Error(fallback.error.message)
    row = fallback.data?.[0] as typeof row
  } else if (withWorkflow.error) {
    throw new Error(withWorkflow.error.message)
  }
  if (!row?.id) return null
  if (row.approved_by_manager) return null
  const status = parseWorkflowStatus(row.workflow_status)
  if (status !== 'draft' && status !== 'finalized') return null
  const reportDate = normalizeReportDate(row.report_date)
  if (!reportDate) return null
  return {
    ...headerOf(String(row.id), reportDate, row.report_no as string | null),
    note: typeof row.raw_text === 'string' ? row.raw_text : '',
    workflowStatus: status,
    structuredJson: (row as { structured_json?: unknown }).structured_json ?? null,
  }
}

/**
 * Ensures one open draft for project+supervisor and returns id / report_no.
 * `reportDate` is the working date until send-to-manager sets the final archive date.
 */
export async function ensureOpenDraftReport(
  supabase: SupabaseClient,
  params: {
    projectId: string
    supervisorId: string
    reportDate: string
    note?: string | null
    weather?: DailyWeatherSnapshot | null
    structuredJson?: unknown | null
  }
): Promise<DailyReportHeader> {
  const note = params.note?.trim() || ''
  const weather = params.weather ? parseWeatherSnapshot(params.weather) : null
  const structured =
    params.structuredJson && typeof params.structuredJson === 'object' ? params.structuredJson : null

  const existing = await findOpenDraftReport(supabase, params.projectId, params.supervisorId)
  if (existing) {
    const rawText = note || existing.note.trim() || weather?.lineFa || '—'
    const { data: full } = await supabase
      .from('daily_reports')
      .select('ai_parsed')
      .eq('id', existing.id)
      .maybeSingle()
    await patchDailyReport(supabase, existing.id, {
      raw_text: rawText,
      weather,
      aiParsed: { ...asParsed(full?.ai_parsed), ...(weather ? { weather } : {}) },
      structuredJson: structured,
    })
    return headerOf(existing.id, existing.reportDate, existing.reportNo)
  }

  return insertDraft(
    supabase,
    params.projectId,
    params.supervisorId,
    params.reportDate,
    note,
    weather,
    structured
  )
}

/** @deprecated prefer ensureOpenDraftReport — kept for progress/photo call sites */
export async function ensureDailyReportForDay(
  supabase: SupabaseClient,
  params: {
    projectId: string
    supervisorId: string
    reportDate: string
    note?: string | null
    weather?: DailyWeatherSnapshot | null
  }
): Promise<DailyReportHeader> {
  try {
    return await ensureOpenDraftReport(supabase, params)
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    if (!WORKFLOW_MISSING.test(message)) throw e
    return ensureLegacyByDate(supabase, params)
  }
}

async function insertDraft(
  supabase: SupabaseClient,
  projectId: string,
  supervisorId: string,
  reportDate: string,
  note: string,
  weather: DailyWeatherSnapshot | null,
  structuredJson: unknown | null = null
): Promise<DailyReportHeader> {
  const tempId = crypto.randomUUID()
  const reportNo = buildDailyReportNo(reportDate, tempId)
  const rawText = note || weather?.lineFa || '—'
  const aiParsed = weather ? { weather } : {}
  const insertBase = {
    id: tempId,
    project_id: projectId,
    report_date: reportDate,
    site_supervisor_id: supervisorId,
    raw_text: rawText,
    ai_parsed: aiParsed,
    report_no: reportNo,
    workflow_status: 'draft',
    ...(structuredJson ? { structured_json: structuredJson } : {}),
  }
  const insertRow = weather ? { ...insertBase, weather_json: weather } : insertBase
  const { data: inserted, error: insertError } = await supabase
    .from('daily_reports')
    .insert(insertRow as never)
    .select('id, report_no, report_date')
    .single()

  if (!insertError && inserted?.id) {
    return headerOf(String(inserted.id), String(inserted.report_date ?? reportDate), inserted.report_no as string | null)
  }

  if (insertError && structuredJson && STRUCTURED_MISSING.test(insertError.message)) {
    const { structured_json: _s, ...withoutStructured } = insertRow as typeof insertBase & {
      structured_json?: unknown
      weather_json?: unknown
    }
    const { data: noStruct, error: noStructErr } = await supabase
      .from('daily_reports')
      .insert(withoutStructured as never)
      .select('id, report_no, report_date')
      .single()
    if (!noStructErr && noStruct?.id) {
      return headerOf(
        String(noStruct.id),
        String(noStruct.report_date ?? reportDate),
        noStruct.report_no as string | null
      )
    }
    if (noStructErr && noStructErr.code !== '23505') throw new Error(noStructErr.message)
  }

  if (insertError && WORKFLOW_MISSING.test(insertError.message)) {
    const { workflow_status: _w, ...withoutWf } = insertBase
    const row = weather ? { ...withoutWf, weather_json: weather } : withoutWf
    const { data: legacy, error: legacyErr } = await supabase
      .from('daily_reports')
      .insert(row as never)
      .select('id, report_no, report_date')
      .single()
    if (legacyErr && legacyErr.code !== '23505') throw new Error(legacyErr.message)
    if (legacy?.id) {
      return headerOf(String(legacy.id), String(legacy.report_date ?? reportDate), legacy.report_no as string | null)
    }
  }

  if (insertError && REPORT_NO_COLUMN_MISSING.test(insertError.message)) {
    const { report_no: _no, ...withoutNo } = insertBase
    const row = weather ? { ...withoutNo, weather_json: weather } : withoutNo
    const { data: legacyIns, error: legacyErr } = await supabase
      .from('daily_reports')
      .insert(row as never)
      .select('id, report_date')
      .single()
    if (legacyErr && legacyErr.code !== '23505') throw new Error(legacyErr.message)
    if (legacyIns?.id) {
      return headerOf(String(legacyIns.id), String(legacyIns.report_date ?? reportDate), null)
    }
  }

  if (insertError && weather && WEATHER_COLUMN_MISSING.test(insertError.message)) {
    const { weather_json: _w, ...withoutWeather } = insertRow as typeof insertBase & {
      weather_json?: unknown
    }
    const { data: noWeather, error: noWeatherErr } = await supabase
      .from('daily_reports')
      .insert(withoutWeather as never)
      .select('id, report_no, report_date')
      .single()
    if (noWeatherErr && noWeatherErr.code !== '23505') throw new Error(noWeatherErr.message)
    if (noWeather?.id) {
      return headerOf(String(noWeather.id), String(noWeather.report_date ?? reportDate), noWeather.report_no as string | null)
    }
  }

  if (insertError && insertError.code === '23505') {
    const again = await findOpenDraftReport(supabase, projectId, supervisorId)
    if (again) return headerOf(again.id, again.reportDate, again.reportNo)
  }

  if (insertError) throw new Error(insertError.message)
  throw new Error('daily_reports insert failed')
}

async function ensureLegacyByDate(
  supabase: SupabaseClient,
  params: {
    projectId: string
    supervisorId: string
    reportDate: string
    note?: string | null
    weather?: DailyWeatherSnapshot | null
  }
): Promise<DailyReportHeader> {
  const note = params.note?.trim() || ''
  const weather = params.weather ? parseWeatherSnapshot(params.weather) : null
  const { data: existing, error } = await supabase
    .from('daily_reports')
    .select('id, report_no, raw_text, ai_parsed')
    .eq('project_id', params.projectId)
    .eq('report_date', params.reportDate)
    .eq('site_supervisor_id', params.supervisorId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  if (existing?.id) {
    const rawText = note || String(existing.raw_text ?? '').trim() || weather?.lineFa || '—'
    await patchDailyReport(supabase, existing.id, {
      raw_text: rawText,
      weather,
      aiParsed: { ...asParsed(existing.ai_parsed), ...(weather ? { weather } : {}) },
    })
    return headerOf(String(existing.id), params.reportDate, existing.report_no as string | null)
  }
  return insertDraft(supabase, params.projectId, params.supervisorId, params.reportDate, note, weather)
}

/**
 * Submits the open draft to the manager and stamps the archive date as the send date.
 * Photos on that report get the same report_date.
 */
export async function submitOpenDraftToManager(
  supabase: SupabaseClient,
  params: {
    projectId: string
    supervisorId: string
    sendDate: string
    note?: string | null
    weather?: DailyWeatherSnapshot | null
    structuredJson?: unknown | null
  }
): Promise<DailyReportHeader> {
  const header = await ensureOpenDraftReport(supabase, {
    projectId: params.projectId,
    supervisorId: params.supervisorId,
    reportDate: params.sendDate,
    note: params.note,
    weather: params.weather,
    structuredJson: params.structuredJson,
  })

  const { data: current, error: curErr } = await supabase
    .from('daily_reports')
    .select('id, raw_text, report_no')
    .eq('id', header.id)
    .single()
  if (curErr) throw new Error(curErr.message)

  const raw = (params.note?.trim() || String(current.raw_text ?? '').trim())
  if (!raw) throw new Error('قبل از آرشیو، فرم یا یادداشت را پر کنید')

  const now = new Date().toISOString()
  const reportNo = buildDailyReportNo(params.sendDate, header.id)
  // Manager approval temporarily skipped — archive as approved on send.
  const updatePayload: Record<string, unknown> = {
    raw_text: raw,
    report_date: params.sendDate,
    report_no: reportNo,
    workflow_status: 'approved',
    finalized_at: now,
    submitted_to_manager_at: now,
    approved_by_manager: true,
    approved_at: now,
  }
  if (params.structuredJson && typeof params.structuredJson === 'object') {
    updatePayload.structured_json = params.structuredJson
  }

  async function applyUpdate(payload: Record<string, unknown>) {
    return supabase.from('daily_reports').update(payload as never).eq('id', header.id)
  }

  let { error } = await applyUpdate(updatePayload)

  if (error && STRUCTURED_MISSING.test(error.message) && updatePayload.structured_json) {
    const { structured_json: _s, ...withoutStructured } = updatePayload
    ;({ error } = await applyUpdate(withoutStructured))
  }
  // Older DBs may lack approved_at / approved_by_manager together with workflow
  if (error && /approved_by_manager|approved_at/i.test(error.message)) {
    const {
      approved_by_manager: _a,
      approved_at: _b,
      ...withoutApproveCols
    } = updatePayload
    withoutApproveCols.workflow_status = 'approved'
    ;({ error } = await applyUpdate(withoutApproveCols))
  }
  // Unique (project, date, supervisor) still present if migration 113 not run
  if (error && (error as { code?: string }).code === '23505') {
    throw new Error(
      'migration_required: محدودیت یک‌گزارش‌درروز هنوز فعال است — فایل database/113-daily-report-open-draft.sql را در Supabase اجرا کنید تا هر ارسال شمارهٔ جدا بگیرد'
    )
  }

  if (error) {
    if (WORKFLOW_MISSING.test(error.message)) {
      throw new Error('migration_required: database/112-daily-report-workflow.sql و 113 را اجرا کنید')
    }
    throw new Error(error.message)
  }

  const verifySelects = [
    'id, workflow_status, report_date, approved_by_manager, submitted_to_manager_at',
    'id, workflow_status, report_date, submitted_to_manager_at',
    'id, workflow_status, report_date',
    'id, report_date',
  ]
  let verified: Record<string, unknown> | null = null
  for (const select of verifySelects) {
    const res = await supabase.from('daily_reports').select(select).eq('id', header.id).maybeSingle()
    if (!res.error) {
      verified = (res.data as Record<string, unknown> | null) ?? null
      break
    }
    if (!SELECT_COLUMN_MISSING.test(res.error.message)) {
      throw new Error(res.error.message)
    }
  }

  if (!verified?.id) {
    throw new Error('ارسال ثبت نشد — ردیف گزارش به‌روز نشد (دسترسی یا migration را بررسی کنید)')
  }

  const hasWorkflowCol = 'workflow_status' in verified
  const st = parseWorkflowStatus(verified.workflow_status)
  const markedApproved = verified.approved_by_manager === true
  const hasSubmittedAt =
    typeof verified.submitted_to_manager_at === 'string' &&
    Boolean(String(verified.submitted_to_manager_at).trim())
  if (
    hasWorkflowCol &&
    st !== 'submitted' &&
    st !== 'approved' &&
    !markedApproved &&
    !hasSubmittedAt
  ) {
    throw new Error(
      'ارسال ثبت نشد — احتمالاً migrationهای database/112 و database/113 اجرا نشده‌اند'
    )
  }

  const archivedDate =
    normalizeReportDate(verified.report_date) ??
    normalizeReportDate(params.sendDate) ??
    params.sendDate
  await supabase
    .from('daily_report_photos')
    .update({ report_date: archivedDate } as never)
    .eq('daily_report_id', header.id)

  return headerOf(header.id, archivedDate, reportNo)
}

export async function upsertDailyReportMeta(
  supabase: SupabaseClient,
  params: {
    projectId: string
    supervisorId: string
    reportDate: string
    note?: string | null
    weather?: DailyWeatherSnapshot | null
  }
): Promise<void> {
  const note = params.note?.trim() || ''
  const weather = params.weather ? parseWeatherSnapshot(params.weather) : null
  if (!note && !weather) return
  await ensureDailyReportForDay(supabase, params)
}

async function patchDailyReport(
  supabase: SupabaseClient,
  id: string,
  patch: {
    raw_text: string
    weather: DailyWeatherSnapshot | null
    aiParsed: Record<string, unknown>
    structuredJson?: unknown | null
  }
) {
  const withWeather = {
    raw_text: patch.raw_text,
    ai_parsed: patch.aiParsed,
    ...(patch.weather ? { weather_json: patch.weather } : {}),
    ...(patch.structuredJson && typeof patch.structuredJson === 'object'
      ? { structured_json: patch.structuredJson }
      : {}),
  }
  const { error } = await supabase.from('daily_reports').update(withWeather as never).eq('id', id)
  if (!error) return
  if (patch.structuredJson && STRUCTURED_MISSING.test(error.message)) {
    const { structured_json: _s, ...withoutStructured } = withWeather as typeof withWeather & {
      structured_json?: unknown
    }
    const { error: noStruct } = await supabase
      .from('daily_reports')
      .update(withoutStructured as never)
      .eq('id', id)
    if (!noStruct) return
    if (patch.weather && WEATHER_COLUMN_MISSING.test(noStruct.message)) {
      const { error: fallback } = await supabase
        .from('daily_reports')
        .update({ raw_text: patch.raw_text, ai_parsed: patch.aiParsed })
        .eq('id', id)
      if (fallback) throw new Error(fallback.message)
      return
    }
    throw new Error(noStruct.message)
  }
  if (patch.weather && WEATHER_COLUMN_MISSING.test(error.message)) {
    const { error: fallback } = await supabase
      .from('daily_reports')
      .update({
        raw_text: patch.raw_text,
        ai_parsed: patch.aiParsed,
        ...(patch.structuredJson && typeof patch.structuredJson === 'object'
          ? { structured_json: patch.structuredJson }
          : {}),
      })
      .eq('id', id)
    if (fallback) throw new Error(fallback.message)
    return
  }
  throw new Error(error.message)
}

export async function fetchDailyReportMeta(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  notes: Record<string, string>
  weather: Record<string, DailyWeatherSnapshot>
  statusByDate: Record<string, 'submitted' | 'approved'>
}> {
  const notes: Record<string, string> = {}
  const weather: Record<string, DailyWeatherSnapshot> = {}
  const statusByDate: Record<string, 'submitted' | 'approved'> = {}

  const withWeather = await supabase
    .from('daily_reports')
    .select('report_date, raw_text, weather_json, workflow_status, approved_by_manager, submitted_to_manager_at')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })

  const rows =
    withWeather.error && WEATHER_COLUMN_MISSING.test(withWeather.error.message)
      ? await supabase
          .from('daily_reports')
          .select('report_date, raw_text, ai_parsed, workflow_status, approved_by_manager, submitted_to_manager_at')
          .eq('project_id', projectId)
          .order('report_date', { ascending: false })
      : withWeather

  if (rows.error) {
    if (/daily_reports|schema cache|does not exist/i.test(rows.error.message)) {
      return { notes, weather, statusByDate }
    }
    throw new Error(rows.error.message)
  }

  for (const row of rows.data ?? []) {
    let status = parseWorkflowStatus((row as { workflow_status?: unknown }).workflow_status)
    if ((row as { approved_by_manager?: boolean }).approved_by_manager) status = 'approved'
    // Archive shows submitted/approved; skip open drafts so the compose page stays the source of truth
    if (status === 'draft' || status === 'finalized') continue
    const date = normalizeReportDate(row.report_date)
    if (!date) continue
    const raw = typeof row.raw_text === 'string' ? row.raw_text.trim() : ''
    if (raw && !notes[date]) notes[date] = raw
    if (!statusByDate[date] && (status === 'submitted' || status === 'approved')) {
      statusByDate[date] = status
    }
    const snap =
      parseWeatherSnapshot((row as { weather_json?: unknown }).weather_json) ??
      parseWeatherSnapshot((row as { ai_parsed?: { weather?: unknown } }).ai_parsed?.weather)
    if (snap && !weather[date]) weather[date] = snap
  }

  return { notes, weather, statusByDate }
}
