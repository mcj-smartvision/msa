import { describe, expect, it } from 'vitest'
import { classifyOutdoorRisk, conditionLabelFa, wmoToOwmId } from '@/features/weather/lib/conditions'
import { aggregateOwmForecast } from '@/features/weather/lib/fetch-weather'
import { weatherDateWindow } from '@/features/weather/lib/window'

describe('classifyOutdoorRisk', () => {
  it('flags heavy rain and thunderstorm as severe for outdoor work', () => {
    const rain = classifyOutdoorRisk({ weatherId: 502, windMs: 2, rainMm: 12 })
    expect(rain.level).toBe('severe')
    expect(rain.reasons).toContain('بارندگی شدید')

    const storm = classifyOutdoorRisk({ weatherId: 211, windMs: 4 })
    expect(storm.level).toBe('severe')
    expect(storm.reasons).toContain('رعدوبرق')
  })

  it('flags very strong wind as severe and moderate wind as caution', () => {
    expect(classifyOutdoorRisk({ weatherId: 800, windMs: 13 }).level).toBe('severe')
    expect(classifyOutdoorRisk({ weatherId: 800, windMs: 9 }).level).toBe('caution')
    expect(classifyOutdoorRisk({ weatherId: 800, windMs: 3 }).level).toBe('ok')
  })

  it('treats light rain as caution for concrete pouring', () => {
    const drizzle = classifyOutdoorRisk({ weatherId: 300, windMs: 2, rainMm: 1 })
    expect(drizzle.level).toBe('caution')
    expect(drizzle.message).toMatch(/بتن/)
  })
})

describe('condition labels', () => {
  it('maps clear / rain / cloud ids to Persian labels', () => {
    expect(conditionLabelFa(800)).toBe('آفتابی')
    expect(conditionLabelFa(501)).toBe('بارانی')
    expect(conditionLabelFa(804)).toBe('ابری')
  })

  it('maps WMO codes used by the 14-day series onto OWM ids', () => {
    expect(wmoToOwmId(0)).toBe(800)
    expect(wmoToOwmId(65)).toBe(502)
    expect(wmoToOwmId(95)).toBe(200)
  })
})

describe('weatherDateWindow', () => {
  it('returns 7 past days, today, and 7 future days', () => {
    const days = weatherDateWindow('2026-10-15')
    expect(days).toHaveLength(15)
    expect(days[0]).toBe('2026-10-08')
    expect(days[7]).toBe('2026-10-15')
    expect(days[14]).toBe('2026-10-22')
  })
})

describe('aggregateOwmForecast', () => {
  it('rolls 3-hour slots into one Tehran day', () => {
    const byDay = aggregateOwmForecast([
      {
        dt: Date.parse('2026-10-15T08:30:00+03:30') / 1000,
        main: { temp: 18, humidity: 40 },
        wind: { speed: 3 },
        rain: { '3h': 1 },
        weather: [{ id: 500, main: 'Rain', description: 'باران', icon: '10d' }],
      },
      {
        dt: Date.parse('2026-10-15T12:30:00+03:30') / 1000,
        main: { temp: 24, humidity: 35 },
        wind: { speed: 5 },
        rain: { '3h': 2 },
        weather: [{ id: 501, main: 'Rain', description: 'باران متوسط', icon: '10d' }],
      },
    ])
    const day = byDay.get('2026-10-15')
    expect(day?.tempMin).toBe(18)
    expect(day?.tempMax).toBe(24)
    expect(day?.rainMm).toBe(3)
    expect(day?.weatherId).toBe(501)
    expect(day?.windMs).toBe(5)
  })
})
