import type { SupabaseClient } from '@supabase/supabase-js'
import { parseWeatherSnapshot } from '@/features/weather/lib/report-stamp'
import type { DailyWeatherSnapshot } from '@/features/weather/lib/types'

const WEATHER_COLUMN_MISSING = /weather_json|schema cache|column/i

function asParsed(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
}

/**
 * Writes the day's field note and weather snapshot onto daily_reports so later
 * documents can read structured weather instead of a browser-only sentence.
 */
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

  const { data: existing, error: existingError } = await supabase
    .from('daily_reports')
    .select('id, raw_text, ai_parsed')
    .eq('project_id', params.projectId)
    .eq('report_date', params.reportDate)
    .eq('site_supervisor_id', params.supervisorId)
    .maybeSingle()

  if (existingError && existingError.code !== 'PGRST116') {
    throw new Error(existingError.message)
  }

  const rawText = note || String(existing?.raw_text ?? '').trim() || weather?.lineFa || '—'
  const aiParsed = {
    ...asParsed(existing?.ai_parsed),
    ...(weather ? { weather } : {}),
  }

  if (existing?.id) {
    await patchDailyReport(supabase, existing.id, { raw_text: rawText, weather, aiParsed })
    return
  }

  const insertBase = {
    project_id: params.projectId,
    report_date: params.reportDate,
    site_supervisor_id: params.supervisorId,
    raw_text: rawText,
    ai_parsed: aiParsed,
  }

  const { error: insertError } = await supabase.from('daily_reports').insert(
    weather ? { ...insertBase, weather_json: weather } : insertBase
  )

  if (!insertError) return

  if (weather && WEATHER_COLUMN_MISSING.test(insertError.message)) {
    const { error: fallback } = await supabase.from('daily_reports').insert(insertBase)
    if (fallback && fallback.code !== '23505') throw new Error(fallback.message)
    return
  }

  if (insertError.code === '23505' || /daily_reports_unique_day/i.test(insertError.message)) {
    const { data: raced } = await supabase
      .from('daily_reports')
      .select('id, raw_text, ai_parsed')
      .eq('project_id', params.projectId)
      .eq('report_date', params.reportDate)
      .eq('site_supervisor_id', params.supervisorId)
      .maybeSingle()
    if (!raced?.id) throw new Error(insertError.message)
    const racedRaw = note || String(raced.raw_text ?? '').trim() || weather?.lineFa || '—'
    await patchDailyReport(supabase, raced.id, {
      raw_text: racedRaw,
      weather,
      aiParsed: { ...asParsed(raced.ai_parsed), ...(weather ? { weather } : {}) },
    })
    return
  }

  throw new Error(insertError.message)
}

async function patchDailyReport(
  supabase: SupabaseClient,
  id: string,
  patch: { raw_text: string; weather: DailyWeatherSnapshot | null; aiParsed: Record<string, unknown> }
) {
  const withWeather = {
    raw_text: patch.raw_text,
    ai_parsed: patch.aiParsed,
    ...(patch.weather ? { weather_json: patch.weather } : {}),
  }
  const { error } = await supabase.from('daily_reports').update(withWeather).eq('id', id)
  if (!error) return
  if (patch.weather && WEATHER_COLUMN_MISSING.test(error.message)) {
    const { error: fallback } = await supabase
      .from('daily_reports')
      .update({ raw_text: patch.raw_text, ai_parsed: patch.aiParsed })
      .eq('id', id)
    if (fallback) throw new Error(fallback.message)
    return
  }
  throw new Error(error.message)
}

export async function fetchDailyReportMeta(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ notes: Record<string, string>; weather: Record<string, DailyWeatherSnapshot> }> {
  const notes: Record<string, string> = {}
  const weather: Record<string, DailyWeatherSnapshot> = {}

  const withWeather = await supabase
    .from('daily_reports')
    .select('report_date, raw_text, weather_json')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })

  const rows =
    withWeather.error && WEATHER_COLUMN_MISSING.test(withWeather.error.message)
      ? await supabase
          .from('daily_reports')
          .select('report_date, raw_text, ai_parsed')
          .eq('project_id', projectId)
          .order('report_date', { ascending: false })
      : withWeather

  if (rows.error) {
    if (/daily_reports|schema cache|does not exist/i.test(rows.error.message)) return { notes, weather }
    throw new Error(rows.error.message)
  }

  for (const row of rows.data ?? []) {
    const date = String(row.report_date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const raw = typeof row.raw_text === 'string' ? row.raw_text.trim() : ''
    if (raw) notes[date] = raw
    const snap =
      parseWeatherSnapshot((row as { weather_json?: unknown }).weather_json) ??
      parseWeatherSnapshot((row as { ai_parsed?: { weather?: unknown } }).ai_parsed?.weather)
    if (snap) weather[date] = snap
  }

  return { notes, weather }
}
