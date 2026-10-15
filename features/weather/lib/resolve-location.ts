import type { SupabaseClient } from '@supabase/supabase-js'
import { weatherApiKey } from '@/features/weather/lib/api-key'
import type { WeatherLocation } from '@/features/weather/lib/types'

export { weatherApiKey }

export const TEHRAN_WEATHER: WeatherLocation = {
  lat: 35.6892,
  lon: 51.389,
  name: 'تهران',
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

async function geocodeOpenWeather(query: string, apiKey: string): Promise<WeatherLocation | null> {
  const cached = geoCache.get(query.toLowerCase())
  if (cached) return cached
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const rows = (await res.json()) as { name?: string; local_names?: { fa?: string }; lat: number; lon: number }[]
  const hit = rows[0]
  if (!hit) return null
  const location: WeatherLocation = {
    lat: hit.lat,
    lon: hit.lon,
    name: hit.local_names?.fa || hit.name || query,
  }
  geoCache.set(query.toLowerCase(), location)
  return location
}

export async function resolveProjectWeatherLocation(
  supabase: SupabaseClient,
  projectId: string | null,
  apiKey: string
): Promise<WeatherLocation> {
  if (!projectId) return TEHRAN_WEATHER

  const { data } = await supabase
    .from('projects')
    .select('name, location, address')
    .eq('id', projectId)
    .maybeSingle()

  const locationText = typeof data?.location === 'string' ? data.location.trim() : ''
  const addressText = typeof data?.address === 'string' ? data.address.trim() : ''
  const query = locationText || addressText
  if (!query) return TEHRAN_WEATHER

  const coords = parseLatLon(query)
  if (coords) {
    return { ...coords, name: data?.name?.trim() || query }
  }

  if (apiKey) {
    const geo = await geocodeOpenWeather(query, apiKey).catch(() => null)
    if (geo) return geo
  }

  return { ...TEHRAN_WEATHER, name: query }
}
