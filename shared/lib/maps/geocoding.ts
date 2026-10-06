/** Default map centers by ISO country code (form `country` field values) */
export const COUNTRY_MAP_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  IR: { lat: 35.6892, lng: 51.389, zoom: 11 },
  AE: { lat: 25.2048, lng: 55.2708, zoom: 11 },
  TR: { lat: 41.0082, lng: 28.9784, zoom: 11 },
  US: { lat: 38.9072, lng: -77.0369, zoom: 10 },
  GB: { lat: 51.5074, lng: -0.1278, zoom: 11 },
  DE: { lat: 52.52, lng: 13.405, zoom: 11 },
}

export const DEFAULT_MAP_CENTER = { lat: 35.6892, lng: 51.389, zoom: 6 }

export function getCountryMapCenter(countryCode: string) {
  return COUNTRY_MAP_CENTERS[countryCode] ?? DEFAULT_MAP_CENTER
}

export function parseLatLng(latitude?: string, longitude?: string): { lat: number; lng: number } | null {
  const lat = parseFloat(latitude ?? '')
  const lng = parseFloat(longitude ?? '')
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return null
}

export function formatCoord(value: number): string {
  return value.toFixed(6)
}

export interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

export interface ParsedAddress {
  address: string
  city: string
  country: string
}

export function parseGeocoderResult(result: {
  address_components?: AddressComponent[]
  formatted_address?: string
}): ParsedAddress {
  const components = result.address_components ?? []
  let streetNumber = ''
  let route = ''
  let city = ''
  let country = ''

  for (const component of components) {
    const types = component.types
    if (types.includes('street_number')) streetNumber = component.long_name
    if (types.includes('route')) route = component.long_name
    if (types.includes('locality')) city = component.long_name
    if (!city && types.includes('administrative_area_level_2')) city = component.long_name
    if (!city && types.includes('administrative_area_level_1')) city = component.long_name
    if (types.includes('country')) country = component.short_name
  }

  const streetLine = [streetNumber, route].filter(Boolean).join(' ')
  const address = streetLine || result.formatted_address?.split(',')[0]?.trim() || result.formatted_address || ''

  return { address, city, country }
}

export function parsePlaceResult(place: {
  address_components?: AddressComponent[]
  formatted_address?: string
  name?: string
  geometry?: { location?: { lat: () => number; lng: () => number } }
}): ParsedAddress & { lat: number; lng: number } {
  const location = place.geometry?.location
  const lat = location?.lat() ?? 0
  const lng = location?.lng() ?? 0

  if (place.address_components?.length) {
    const parsed = parseGeocoderResult({
      address_components: place.address_components,
      formatted_address: place.formatted_address,
    })
    return { ...parsed, lat, lng }
  }

  return {
    address: place.formatted_address ?? place.name ?? '',
    city: '',
    country: '',
    lat,
    lng,
  }
}

export function buildGeocodeQuery(address: string, city: string, countryCode: string, countryLabel?: string): string {
  return [address, city, countryLabel ?? countryCode].filter(Boolean).join(', ')
}
