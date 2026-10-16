/**
 * @file features/weather/lib/types.ts
 * @purpose تعاریف نوع — هوای کارگاه (types)
 * @safe-to-edit YES
 * @affects هوای کارگاه
 * @depends-on nothing
 */

export type OutdoorRiskLevel = 'ok' | 'caution' | 'severe'

export interface OutdoorAlert {
  level: OutdoorRiskLevel
  title: string
  message: string
  reasons: string[]
}

export interface WeatherLocation {
  name: string
  lat: number
  lon: number
}

export interface CurrentWeather {
  temp: number
  feelsLike: number
  humidity: number
  windMs: number
  rainMm: number
  weatherId: number
  condition: string
  description: string
  icon: string
  risk: OutdoorAlert
}

export interface WeatherDay {
  iso: string
  kind: 'past' | 'today' | 'future'
  temp: number | null
  tempMin: number | null
  tempMax: number | null
  humidity: number | null
  windMs: number | null
  rainMm: number
  weatherId: number
  condition: string
  icon: string
  risk: OutdoorAlert
}

export interface WeatherPayload {
  location: WeatherLocation
  current: CurrentWeather
  days: WeatherDay[]
  fetchedAt: string
}

/**
 * Immutable weather snapshot stored on the daily report for later documents.
 * Numbers stay numeric so PDFs / weekly packs do not parse a Persian sentence.
 */
export interface DailyWeatherSnapshot {
  version: 1
  capturedAt: string
  reportDate: string
  locationName: string
  lat: number
  lon: number
  tempC: number
  feelsLikeC: number
  humidityPct: number
  windMs: number
  windKmh: number
  rainMm: number
  weatherId: number
  condition: string
  description: string
  riskLevel: OutdoorRiskLevel
  riskTitle: string
  riskMessage: string
  lineFa: string
}
