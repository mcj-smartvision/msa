/**
 * @file features/site-report/lib/report-from-archive.ts
 * @purpose ساخت دادهٔ چاپ A4 از ردیف آرشیو
 * @safe-to-edit YES
 * @affects آرشیو گزارش روزانه
 * @depends-on features/site-report/lib/empty-report, features/site-report/lib/parse-structured
 */

import { emptyLipartaDailyReport } from '@/features/site-report/lib/empty-report'
import { parseLipartaDailyReport } from '@/features/site-report/lib/parse-structured'
import type { LipartaDailyReportData } from '@/features/site-report/lib/types'
import type { DailyWeatherSnapshot } from '@/features/weather/lib/types'

export function lipartaReportFromArchive(input: {
  projectName?: string
  reportNo: string
  reportDate: string
  note: string
  structuredJson?: unknown | null
  weather?: DailyWeatherSnapshot | null
  statusLabel?: string
}): LipartaDailyReportData {
  const header = {
    project_name: input.projectName ?? '',
    report_no: input.reportNo,
    date_shamsi: input.reportDate,
    status: 'آرشیو شده' as LipartaDailyReportData['header']['status'],
  }
  const fromJson = parseLipartaDailyReport(input.structuredJson, header)
  const base = fromJson ?? emptyLipartaDailyReport(header)
  const note = input.note?.trim() && input.note !== '—' ? input.note.trim() : null
  const weather = input.weather
  return {
    ...base,
    header: {
      ...base.header,
      ...header,
      supervisor_name: base.header.supervisor_name || '',
    },
    weather: {
      ...base.weather,
      ...(weather
        ? {
            location_name: base.weather.location_name ?? weather.locationName ?? null,
            condition: base.weather.condition ?? weather.condition ?? weather.description ?? null,
            notes: base.weather.notes ?? weather.lineFa ?? null,
          }
        : {}),
    },
    free_notes: base.free_notes?.trim() ? base.free_notes : note,
  }
}
