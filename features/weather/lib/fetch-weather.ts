/**
 * @file features/weather/lib/fetch-weather.ts
 * @purpose منطق دامنه — هوای کارگاه (fetch-weather)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on features/weather/lib/conditions, features/weather/lib/api-key, features/weather/lib/resolve-location, features/weather/lib/types, features/weather/lib/window, shared/lib/time/tehran, features/workshop/lib/domain
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  classifyOutdoorRisk,
  conditionLabelFa,
  owmIconFor,
  wmoToOwmId,
} from '@/features/weather/lib/conditions'
import { weatherApiKey } from '@/features/weather/lib/api-key'
import { resolveProjectWeatherLocation } from '@/features/weather/lib/resolve-location'
import type { CurrentWeather, WeatherDay, WeatherPayload } from '@/features/weather/lib/types'
import { dayKind, weatherDateWindow } from '@/features/weather/lib/window'
import { tehranDateIso, todayTehranIso } from '@/shared/lib/time/tehran'
import { WorkshopError } from '@/features/workshop/lib/domain'

const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; payload: WeatherPayload }>()

interface OwmWeatherBlob {
  id: number
  main: string
  description: string
  icon: string
}

interface OwmCurrent {
  name?: string
  weather?: OwmWeatherBlob[]
  main?: { temp?: number; feels_like?: number; humidity?: number }
  wind?: { speed?: number }
  rain?: { '1h'?: number; '3h'?: number }
}

interface OwmForecastSlot {
  dt: number
  main?: { temp?: number; humidity?: number }
  wind?: { speed?: number }
  rain?: { '3h'?: number }
  weather?: OwmWeatherBlob[]
}

interface OpenMeteoDaily {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_sum: number[]
  wind_speed_10m_max: number[]
  relative_humidity_2m_mean: (number | null)[]
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number
    relative_humidity_2m?: number
    weather_code?: number
    wind_speed_10m?: number
    precipitation?: number
  }
  daily?: OpenMeteoDaily
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function currentFromMeteo(json: OpenMeteoResponse): CurrentWeather | null {
  const row = json.current
  if (typeof row?.temperature_2m !== 'number') return null
  const weatherId = wmoToOwmId(num(row.weather_code, 0))
  const windMs = num(row.wind_speed_10m) / 3.6
  const rainMm = num(row.precipitation)
  return {
    temp: row.temperature_2m,
    feelsLike: row.temperature_2m,
    humidity: num(row.relative_humidity_2m),
    windMs,
    rainMm,
    weatherId,
    condition: conditionLabelFa(weatherId),
    description: conditionLabelFa(weatherId),
    icon: owmIconFor(weatherId),
    risk: classifyOutdoorRisk({ weatherId, windMs, rainMm }),
  }
}

function owmCurrentFrom(json: OwmCurrent): CurrentWeather {
  const blob = json.weather?.[0]
  const weatherId = blob?.id ?? 800
  const windMs = num(json.wind?.speed)
  const rainMm = num(json.rain?.['1h'] ?? json.rain?.['3h'])
  const description = blob?.description?.trim() || conditionLabelFa(weatherId)
  return {
    temp: num(json.main?.temp),
    feelsLike: num(json.main?.feels_like, num(json.main?.temp)),
    humidity: num(json.main?.humidity),
    windMs,
    rainMm,
    weatherId,
    condition: conditionLabelFa(weatherId),
    description,
    icon: blob?.icon || owmIconFor(weatherId),
    risk: classifyOutdoorRisk({ weatherId, windMs, rainMm }),
  }
}

function emptyDay(iso: string, today: string): WeatherDay {
  return {
    iso,
    kind: dayKind(iso, today),
    temp: null,
    tempMin: null,
    tempMax: null,
    humidity: null,
    windMs: null,
    rainMm: 0,
    weatherId: 800,
    condition: conditionLabelFa(800),
    icon: owmIconFor(800),
    risk: classifyOutdoorRisk({ weatherId: 800, windMs: 0, rainMm: 0 }),
  }
}

function finalizeDay(day: WeatherDay): WeatherDay {
  const windMs = day.windMs ?? 0
  return {
    ...day,
    condition: day.condition || conditionLabelFa(day.weatherId),
    icon: day.icon || owmIconFor(day.weatherId),
    risk: classifyOutdoorRisk({ weatherId: day.weatherId, windMs, rainMm: day.rainMm }),
  }
}

export function aggregateOwmForecast(slots: OwmForecastSlot[]): Map<string, Partial<WeatherDay>> {
  const byDay = new Map<
    string,
    { temps: number[]; humidity: number[]; wind: number[]; rain: number; noon: OwmForecastSlot | null; noonDelta: number }
  >()

  for (const slot of slots) {
    const iso = tehranDateIso(slot.dt * 1000)
    const hour = new Date(slot.dt * 1000 + 3.5 * 3_600_000).getUTCHours()
    const delta = Math.abs(hour - 12)
    let row = byDay.get(iso)
    if (!row) {
      row = { temps: [], humidity: [], wind: [], rain: 0, noon: null, noonDelta: 99 }
      byDay.set(iso, row)
    }
    if (typeof slot.main?.temp === 'number') row.temps.push(slot.main.temp)
    if (typeof slot.main?.humidity === 'number') row.humidity.push(slot.main.humidity)
    if (typeof slot.wind?.speed === 'number') row.wind.push(slot.wind.speed)
    row.rain += num(slot.rain?.['3h'])
    if (!row.noon || delta < row.noonDelta) {
      row.noon = slot
      row.noonDelta = delta
    }
  }

  const out = new Map<string, Partial<WeatherDay>>()
  for (const [iso, row] of byDay) {
    const blob = row.noon?.weather?.[0]
    const weatherId = blob?.id ?? 800
    const temp = row.temps.length ? row.temps.reduce((a, b) => a + b, 0) / row.temps.length : null
    out.set(iso, {
      iso,
      temp,
      tempMin: row.temps.length ? Math.min(...row.temps) : null,
      tempMax: row.temps.length ? Math.max(...row.temps) : null,
      humidity: row.humidity.length ? Math.round(row.humidity.reduce((a, b) => a + b, 0) / row.humidity.length) : null,
      windMs: row.wind.length ? Math.max(...row.wind) : null,
      rainMm: Math.round(row.rain * 10) / 10,
      weatherId,
      condition: blob?.description?.trim() || conditionLabelFa(weatherId),
      icon: blob?.icon || owmIconFor(weatherId),
    })
  }
  return out
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`weather HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function loadWeather(supabase: SupabaseClient, projectId: string | null): Promise<WeatherPayload> {
  const apiKey = weatherApiKey()
  const location = { ...(await resolveProjectWeatherLocation(supabase, projectId, apiKey)) }
  const cacheKey = `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.payload

  const today = todayTehranIso()
  const window = weatherDateWindow(today)
  const lat = location.lat
  const lon = location.lon
  const owm = (path: string) =>
    `https://api.openweathermap.org${path}${path.includes('?') ? '&' : '?'}appid=${apiKey}&units=metric&lang=fa`

  const [currentRes, forecastRes, meteoRes] = await Promise.allSettled([
    apiKey
      ? fetchJson<OwmCurrent>(owm(`/data/2.5/weather?lat=${lat}&lon=${lon}`))
      : Promise.resolve(null),
    apiKey
      ? fetchJson<{ list?: OwmForecastSlot[] }>(owm(`/data/2.5/forecast?lat=${lat}&lon=${lon}`))
      : Promise.resolve(null),
    fetchJson<OpenMeteoResponse>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean` +
        `&timezone=Asia%2FTehran&past_days=7&forecast_days=8`
    ),
  ])

  const current =
    (currentRes.status === 'fulfilled' && currentRes.value ? owmCurrentFrom(currentRes.value) : null) ??
    (meteoRes.status === 'fulfilled' ? currentFromMeteo(meteoRes.value) : null)
  if (!current) {
    throw new WorkshopError('VALIDATION', 'خواندن وضعیت هوا ناموفق بود.')
  }
  if (currentRes.status === 'fulfilled' && currentRes.value?.name && location.name === 'تهران') {
    location.name = currentRes.value.name
  }

  const days = new Map<string, WeatherDay>()
  for (const iso of window) days.set(iso, emptyDay(iso, today))

  if (meteoRes.status === 'fulfilled' && meteoRes.value.daily) {
    const daily = meteoRes.value.daily
    daily.time.forEach((iso, i) => {
      const existing = days.get(iso)
      if (!existing) return
      const weatherId = wmoToOwmId(num(daily.weather_code[i], 1))
      const tempMax = daily.temperature_2m_max[i] ?? null
      const tempMin = daily.temperature_2m_min[i] ?? null
      const windKmh = num(daily.wind_speed_10m_max[i])
      const windMs = windKmh / 3.6
      const rainMm = num(daily.precipitation_sum[i])
      const humidity = daily.relative_humidity_2m_mean[i]
      days.set(
        iso,
        finalizeDay({
          ...existing,
          temp: tempMax != null && tempMin != null ? (tempMax + tempMin) / 2 : tempMax ?? tempMin,
          tempMin,
          tempMax,
          humidity: typeof humidity === 'number' ? Math.round(humidity) : null,
          windMs,
          rainMm,
          weatherId,
          condition: conditionLabelFa(weatherId),
          icon: owmIconFor(weatherId),
        })
      )
    })
  }

  if (forecastRes.status === 'fulfilled' && forecastRes.value) {
    const overlay = aggregateOwmForecast(forecastRes.value.list ?? [])
    for (const [iso, patch] of overlay) {
      const existing = days.get(iso)
      if (!existing) continue
      days.set(iso, finalizeDay({ ...existing, ...patch, iso, kind: existing.kind }))
    }
  }

  const todayRow = days.get(today)
  if (todayRow) {
    days.set(
      today,
      finalizeDay({
        ...todayRow,
        temp: current.temp,
        tempMin: todayRow.tempMin != null ? Math.min(todayRow.tempMin, current.temp) : current.temp,
        tempMax: todayRow.tempMax != null ? Math.max(todayRow.tempMax, current.temp) : current.temp,
        humidity: current.humidity,
        windMs: current.windMs,
        rainMm: Math.max(todayRow.rainMm, current.rainMm),
        weatherId: current.weatherId,
        condition: current.description,
        icon: current.icon,
      })
    )
  }

  const payload: WeatherPayload = {
    location,
    current,
    days: window.map((iso) => days.get(iso)!),
    fetchedAt: new Date().toISOString(),
  }
  cache.set(cacheKey, { at: Date.now(), payload })
  return payload
}
