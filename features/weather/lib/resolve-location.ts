/**
 * @file features/weather/lib/resolve-location.ts
 * @purpose منطق دامنه — هوای کارگاه (resolve-location)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on features/weather/lib/api-key, features/weather/lib/types
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { weatherApiKey } from '@/features/weather/lib/api-key'
import { getWeatherUi } from '@/features/weather/lib/i18n/copy'
import type { WeatherLocation } from '@/features/weather/lib/types'

export { weatherApiKey }

export const TEHRAN_WEATHER: WeatherLocation = {
  lat: 35.6892,
  lon: 51.389,
  name: 'تهران',
}

function tehranLocation(locale: FormLocale): WeatherLocation {
  return { ...TEHRAN_WEATHER, name: getWeatherUi(locale).tehran }
}

const geoCache = new Map<string, WeatherLocation>()

function parseLatLon(text: string): { lat: number; lon: number } | null {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number(match[1])
  const lon = Number(match[2])
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
}

async function geocodeOpenWeather(
  query: string,
  apiKey: string,
  locale: FormLocale
): Promise<WeatherLocation | null> {
  const cacheKey = `${locale}:${query.toLowerCase()}`
  const cached = geoCache.get(cacheKey)
  if (cached) return cached
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const rows = (await res.json()) as {
    name?: string
    local_names?: { fa?: string; en?: string }
    lat: number
    lon: number
  }[]
  const hit = rows[0]
  if (!hit) return null
  const localized =
    locale === 'fa' ? hit.local_names?.fa || hit.name : hit.local_names?.en || hit.name
  const location: WeatherLocation = {
    lat: hit.lat,
    lon: hit.lon,
    name: localized || query,
  }
  geoCache.set(cacheKey, location)
  return location
}

export async function resolveProjectWeatherLocation(
  supabase: SupabaseClient,
  projectId: string | null,
  apiKey: string,
  locale: FormLocale = 'fa'
): Promise<WeatherLocation> {
  if (!projectId) return tehranLocation(locale)

  const { data } = await supabase
    .from('projects')
    .select('name, location, address')
    .eq('id', projectId)
    .maybeSingle()

  const locationText = typeof data?.location === 'string' ? data.location.trim() : ''
  const addressText = typeof data?.address === 'string' ? data.address.trim() : ''
  const query = locationText || addressText
  if (!query) return tehranLocation(locale)

  const coords = parseLatLon(query)
  if (coords) {
    return { ...coords, name: data?.name?.trim() || query }
  }

  if (apiKey) {
    const geo = await geocodeOpenWeather(query, apiKey, locale).catch(() => null)
    if (geo) return geo
  }

  return { ...tehranLocation(locale), name: query }
}
