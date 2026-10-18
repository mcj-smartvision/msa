/**
 * @file features/weather/lib/report-stamp.ts
 * @purpose منطق دامنه — هوای کارگاه (report-stamp)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on features/manager/lib/format, shared/types, features/weather/lib/types, features/weather/lib/i18n/copy
 */

import { faNumber } from '@/features/manager/lib/format'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { getActiveLocale } from '@/shared/lib/i18n/active-locale'
import type { WeatherAirAnalysis } from '@/shared/types'
import { getWeatherStampCopy, getWeatherUi } from '@/features/weather/lib/i18n/copy'
import type { DailyWeatherSnapshot, WeatherPayload } from '@/features/weather/lib/types'

const NOTE_PREFIXES = ['وضعیت هوا:', 'Weather:'] as const

export const WEATHER_NOTE_PREFIX = 'وضعیت هوا:'

export function formatWeatherReportLine(
  payload: WeatherPayload,
  locale: FormLocale = getActiveLocale()
): string {
  const t = getWeatherStampCopy(locale)
  const ui = getWeatherUi(locale)
  const current = payload.current
  const temp = `${faNumber(Math.round(current.temp))}°`
  const humidity = ui.humidityPct(faNumber(Math.round(current.humidity)))
  const wind = t.windKmh(faNumber(Math.round(current.windMs * 3.6)))
  const risk = current.risk.level !== 'ok' ? ` — ${current.risk.message}` : ''
  return `${t.prefix} ${payload.location.name} · ${current.description} · ${temp} · ${t.humidity(humidity)} · ${t.wind(wind)}${risk}`
}

function startsWithWeatherPrefix(row: string): boolean {
  return NOTE_PREFIXES.some((prefix) => row.startsWith(prefix))
}

export function extractWeatherLine(note: string): string | null {
  const line = note
    .split('\n')
    .map((row) => row.trim())
    .find((row) => startsWithWeatherPrefix(row))
  return line || null
}

export function stripWeatherLine(note: string): string {
  return note
    .split('\n')
    .filter((row) => !startsWithWeatherPrefix(row.trim()))
    .join('\n')
    .trim()
}

/** Puts the live weather line at the top of the daily note without duplicating it. */
export function ensureWeatherLine(note: string, line: string): string {
  const without = stripWeatherLine(note)
  return without ? `${line}\n${without}` : line
}

export function weatherApparentFromId(weatherId: number): string {
  if (weatherId >= 600 && weatherId < 700) return 'snowy'
  if (weatherId >= 500 && weatherId < 600) return 'rainy'
  if (weatherId >= 300 && weatherId < 400) return 'rainy'
  if (weatherId >= 200 && weatherId < 300) return 'rainy'
  if (weatherId === 751 || weatherId === 761 || weatherId === 762) return 'dusty'
  if (weatherId >= 700 && weatherId < 800) return 'foggy'
  if (weatherId === 800) return 'clear'
  if (weatherId > 800) return 'cloudy'
  return 'unknown'
}

export function weatherAirFromPayload(
  payload: WeatherPayload,
  locale: FormLocale = getActiveLocale()
): WeatherAirAnalysis {
  const t = getWeatherStampCopy(locale)
  const current = payload.current
  return {
    weather_apparent: weatherApparentFromId(current.weatherId),
    weather_fa: t.weatherDeg(current.description, faNumber(Math.round(current.temp))),
    visibility:
      current.humidity >= 90 || (current.weatherId >= 700 && current.weatherId < 800) ? 'fair' : 'good',
    wind_signs_fa: t.windSigns(faNumber(Math.round(current.windMs * 3.6))),
    notes_fa: formatWeatherReportLine(payload, locale),
  }
}

/** Live station data wins over a photo guess; air-quality from the photo is kept. */
export function overlayWeatherAir(
  guessed: WeatherAirAnalysis | undefined,
  payload: WeatherPayload,
  locale: FormLocale = getActiveLocale()
): WeatherAirAnalysis {
  const live = weatherAirFromPayload(payload, locale)
  return {
    ...live,
    air_quality_apparent: guessed?.air_quality_apparent,
    air_quality_fa: guessed?.air_quality_fa,
  }
}

export function weatherSnapshotFromPayload(
  payload: WeatherPayload,
  reportDate: string,
  locale: FormLocale = getActiveLocale()
): DailyWeatherSnapshot {
  const current = payload.current
  return {
    version: 1,
    capturedAt: payload.fetchedAt || new Date().toISOString(),
    reportDate,
    locationName: payload.location.name,
    lat: payload.location.lat,
    lon: payload.location.lon,
    tempC: Math.round(current.temp * 10) / 10,
    feelsLikeC: Math.round(current.feelsLike * 10) / 10,
    humidityPct: Math.round(current.humidity),
    windMs: Math.round(current.windMs * 10) / 10,
    windKmh: Math.round(current.windMs * 3.6),
    rainMm: Math.round(current.rainMm * 10) / 10,
    weatherId: current.weatherId,
    condition: current.condition,
    description: current.description,
    riskLevel: current.risk.level,
    riskTitle: current.risk.title,
    riskMessage: current.risk.message,
    lineFa: formatWeatherReportLine(payload, locale),
  }
}

export function parseWeatherSnapshot(value: unknown): DailyWeatherSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.version !== 1) return null
  if (typeof row.reportDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.reportDate)) return null
  if (typeof row.tempC !== 'number' || !Number.isFinite(row.tempC)) return null
  if (typeof row.lineFa !== 'string' || !row.lineFa.trim()) return null
  const riskLevel = row.riskLevel === 'caution' || row.riskLevel === 'severe' ? row.riskLevel : 'ok'
  return {
    version: 1,
    capturedAt: typeof row.capturedAt === 'string' ? row.capturedAt : new Date().toISOString(),
    reportDate: row.reportDate,
    locationName: typeof row.locationName === 'string' ? row.locationName : '',
    lat: typeof row.lat === 'number' ? row.lat : 0,
    lon: typeof row.lon === 'number' ? row.lon : 0,
    tempC: row.tempC,
    feelsLikeC: typeof row.feelsLikeC === 'number' ? row.feelsLikeC : row.tempC,
    humidityPct: typeof row.humidityPct === 'number' ? row.humidityPct : 0,
    windMs: typeof row.windMs === 'number' ? row.windMs : 0,
    windKmh: typeof row.windKmh === 'number' ? row.windKmh : 0,
    rainMm: typeof row.rainMm === 'number' ? row.rainMm : 0,
    weatherId: typeof row.weatherId === 'number' ? row.weatherId : 800,
    condition: typeof row.condition === 'string' ? row.condition : '',
    description: typeof row.description === 'string' ? row.description : '',
    riskLevel,
    riskTitle: typeof row.riskTitle === 'string' ? row.riskTitle : '',
    riskMessage: typeof row.riskMessage === 'string' ? row.riskMessage : '',
    lineFa: row.lineFa.trim(),
  }
}
