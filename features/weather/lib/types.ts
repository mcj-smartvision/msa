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
