import { describe, expect, it } from 'vitest'
import {
  ensureWeatherLine,
  extractWeatherLine,
  formatWeatherReportLine,
  overlayWeatherAir,
  parseWeatherSnapshot,
  stripWeatherLine,
  weatherApparentFromId,
  weatherAirFromPayload,
  weatherSnapshotFromPayload,
  WEATHER_NOTE_PREFIX,
} from '@/features/weather/lib/report-stamp'
import type { WeatherPayload } from '@/features/weather/lib/types'

const payload: WeatherPayload = {
  location: { name: 'تهران', lat: 35.68, lon: 51.38 },
  current: {
    temp: 25.4,
    feelsLike: 24,
    humidity: 19,
    windMs: 2,
    rainMm: 0,
    weatherId: 800,
    condition: 'آفتابی',
    description: 'آسمان صاف',
    icon: '01d',
    risk: { level: 'ok', title: '', message: '', reasons: [] },
  },
  days: [],
  fetchedAt: '2026-10-15T08:00:00Z',
}

describe('weather report stamp', () => {
  it('formats a Persian weather line for the daily report', () => {
    const line = formatWeatherReportLine(payload)
    expect(line.startsWith(WEATHER_NOTE_PREFIX)).toBe(true)
    expect(line).toMatch(/آسمان صاف/)
    expect(line).toMatch(/تهران/)
    expect(extractWeatherLine(line)).toBe(line)
  })

  it('keeps one weather line at the top of the note', () => {
    const first = `${WEATHER_NOTE_PREFIX} دیروز`
    const next = `${WEATHER_NOTE_PREFIX} امروز`
    expect(ensureWeatherLine('کمبود میلگرد', next)).toBe(`${next}\nکمبود میلگرد`)
    expect(ensureWeatherLine(`${first}\nکمبود میلگرد`, next)).toBe(`${next}\nکمبود میلگرد`)
  })

  it('maps live weather onto the photo-report weather_air field', () => {
    expect(weatherApparentFromId(800)).toBe('clear')
    expect(weatherApparentFromId(501)).toBe('rainy')
    const air = weatherAirFromPayload(payload)
    expect(air.weather_fa).toMatch(/آسمان صاف/)
    expect(air.notes_fa).toMatch(WEATHER_NOTE_PREFIX)
    const overlaid = overlayWeatherAir({ air_quality_fa: 'گرد و غبار خفیف' }, payload)
    expect(overlaid.air_quality_fa).toBe('گرد و غبار خفیف')
    expect(overlaid.weather_apparent).toBe('clear')
  })

  it('strips the auto weather line from a mixed note', () => {
    const mixed = `${formatWeatherReportLine(payload)}\nکمبود میلگرد`
    expect(stripWeatherLine(mixed)).toBe('کمبود میلگرد')
  })

  it('stores a numeric snapshot for later documents', () => {
    const snap = weatherSnapshotFromPayload(payload, '2026-10-15')
    expect(snap.version).toBe(1)
    expect(snap.tempC).toBe(25.4)
    expect(snap.humidityPct).toBe(19)
    expect(snap.windKmh).toBe(7)
    expect(snap.lineFa.startsWith(WEATHER_NOTE_PREFIX)).toBe(true)
    expect(parseWeatherSnapshot(snap)?.reportDate).toBe('2026-10-15')
    expect(parseWeatherSnapshot({ version: 1, tempC: 20 })).toBeNull()
  })
})
