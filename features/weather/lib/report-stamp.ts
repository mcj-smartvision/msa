import { faNumber } from '@/features/manager/lib/format'
import type { WeatherAirAnalysis } from '@/shared/types'
import type { DailyWeatherSnapshot, WeatherPayload } from '@/features/weather/lib/types'

export const WEATHER_NOTE_PREFIX = 'وضعیت هوا:'

export function formatWeatherReportLine(payload: WeatherPayload): string {
  const current = payload.current
  const temp = `${faNumber(Math.round(current.temp))}°`
  const humidity = `${faNumber(Math.round(current.humidity))}٪`
  const wind = `${faNumber(Math.round(current.windMs * 3.6))} کیلومتر/ساعت`
  const risk = current.risk.level !== 'ok' ? ` — ${current.risk.message}` : ''
  return `${WEATHER_NOTE_PREFIX} ${payload.location.name} · ${current.description} · ${temp} · رطوبت ${humidity} · باد ${wind}${risk}`
}

export function extractWeatherLine(note: string): string | null {
  const line = note
    .split('\n')
    .map((row) => row.trim())
    .find((row) => row.startsWith(WEATHER_NOTE_PREFIX))
  return line || null
}

export function stripWeatherLine(note: string): string {
  return note
    .split('\n')
    .filter((row) => !row.trim().startsWith(WEATHER_NOTE_PREFIX))
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

export function weatherAirFromPayload(payload: WeatherPayload): WeatherAirAnalysis {
  const current = payload.current
  return {
    weather_apparent: weatherApparentFromId(current.weatherId),
    weather_fa: `${current.description}، ${faNumber(Math.round(current.temp))} درجه`,
    visibility:
      current.humidity >= 90 || (current.weatherId >= 700 && current.weatherId < 800) ? 'fair' : 'good',
    wind_signs_fa: `باد ${faNumber(Math.round(current.windMs * 3.6))} کیلومتر بر ساعت`,
    notes_fa: formatWeatherReportLine(payload),
  }
}

/** Live station data wins over a photo guess; air-quality from the photo is kept. */
export function overlayWeatherAir(
  guessed: WeatherAirAnalysis | undefined,
  payload: WeatherPayload
): WeatherAirAnalysis {
  const live = weatherAirFromPayload(payload)
  return {
    ...live,
    air_quality_apparent: guessed?.air_quality_apparent,
    air_quality_fa: guessed?.air_quality_fa,
  }
}

export function weatherSnapshotFromPayload(
  payload: WeatherPayload,
  reportDate: string
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
    lineFa: formatWeatherReportLine(payload),
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
