/** OpenStreetMap tiles + Nominatim geocoding (no API key required) */

import type { Map as LeafletMapType, Marker as LeafletMarkerType } from 'leaflet'

export type LeafletMap = LeafletMapType
export type LeafletMarker = LeafletMarkerType

type LeafletModule = typeof import('leaflet')

let leafletPromise: Promise<LeafletModule> | null = null

/** Load Leaflet from npm bundle (works offline / without unpkg). */
export function loadLeaflet(): Promise<LeafletModule> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (leafletPromise) return leafletPromise

  leafletPromise = import('leaflet').then(async (L) => {
    await import('leaflet/dist/leaflet.css')

    // Webpack/Next.js breaks default marker asset paths.
    const iconRetinaUrl = (await import('leaflet/dist/images/marker-icon-2x.png')).default.src
    const iconUrl = (await import('leaflet/dist/images/marker-icon.png')).default.src
    const shadowUrl = (await import('leaflet/dist/images/marker-shadow.png')).default.src
    L.default.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

    return L
  })

  return leafletPromise
}

export async function nominatimSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = (await res.json()) as { lat: string; lon: string }[]
  if (!data[0]) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

export async function nominatimReverse(lat: number, lng: number): Promise<{
  address: string
  city: string
  country: string
} | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = (await res.json()) as {
    display_name?: string
    address?: Record<string, string>
  }
  const addr = data.address ?? {}
  const city = addr.city || addr.town || addr.village || addr.state || ''
  const country = addr.country_code?.toUpperCase() ?? ''
  const street = [addr.house_number, addr.road].filter(Boolean).join(' ')
  return {
    address: street || data.display_name?.split(',')[0]?.trim() || '',
    city,
    country,
  }
}
