/**
 * @file features/weather/lib/conditions.ts
 * @purpose منطق دامنه — هوای کارگاه (conditions)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on features/weather/lib/types, features/weather/lib/i18n/copy
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { conditionLabel, getWeatherRiskCopy } from '@/features/weather/lib/i18n/copy'
import type { OutdoorAlert, OutdoorRiskLevel } from '@/features/weather/lib/types'

/** @deprecated Prefer conditionLabel(id, locale). Kept for existing FA call sites/tests. */
export function conditionLabelFa(weatherId: number): string {
  return conditionLabel(weatherId, 'fa')
}

export { conditionLabel }

export function wmoToOwmId(code: number): number {
  if (code === 0) return 800
  if (code === 1) return 801
  if (code === 2) return 802
  if (code === 3) return 804
  if (code === 45 || code === 48) return 741
  if (code >= 51 && code <= 57) return 300
  if (code === 61 || code === 80) return 500
  if (code === 63 || code === 81) return 501
  if (code === 65 || code === 82) return 502
  if (code === 66 || code === 67) return 511
  if (code >= 71 && code <= 77) return 600
  if (code === 85) return 600
  if (code === 86) return 602
  if (code === 95) return 200
  if (code === 96 || code === 99) return 202
  return 801
}

export function owmIconFor(weatherId: number): string {
  if (weatherId >= 200 && weatherId < 300) return '11d'
  if (weatherId >= 300 && weatherId < 400) return '09d'
  if (weatherId >= 500 && weatherId < 505) return '10d'
  if (weatherId >= 520 && weatherId < 600) return '09d'
  if (weatherId >= 600 && weatherId < 700) return '13d'
  if (weatherId >= 700 && weatherId < 800) return '50d'
  if (weatherId === 800) return '01d'
  if (weatherId === 801) return '02d'
  if (weatherId === 802) return '03d'
  return '04d'
}

const HEAVY_RAIN_IDS = new Set([502, 503, 504, 522, 531])
const HEAVY_SNOW_IDS = new Set([602, 622])

/** Strong wind ≈ 12 m/s (43 km/h). Caution from 8 m/s (29 km/h). */
export function classifyOutdoorRisk(
  input: {
    weatherId: number
    windMs: number
    rainMm?: number
  },
  locale: FormLocale = 'fa'
): OutdoorAlert {
  const t = getWeatherRiskCopy(locale)
  const reasons: string[] = []
  const id = input.weatherId
  const rainMm = input.rainMm ?? 0
  const thunder = id >= 200 && id < 300
  const heavyRain = HEAVY_RAIN_IDS.has(id) || rainMm >= 10
  const strongWind = input.windMs >= 12
  const heavySnow = HEAVY_SNOW_IDS.has(id)
  const anyPrecip = (id >= 300 && id < 700) || rainMm >= 1
  const windy = input.windMs >= 8

  if (heavyRain) reasons.push(t.heavyRain)
  if (thunder) reasons.push(t.thunder)
  if (strongWind) reasons.push(t.veryStrongWind)
  if (heavySnow) reasons.push(t.heavySnow)

  let level: OutdoorRiskLevel = 'ok'
  if (reasons.length > 0) {
    level = 'severe'
  } else {
    if (anyPrecip) reasons.push(id >= 600 && id < 700 ? t.snow : t.rain)
    if (windy) reasons.push(t.moderateWind)
    if (reasons.length > 0) level = 'caution'
  }

  if (level === 'severe') {
    return {
      level,
      title: t.severeTitle,
      message: t.severeMessage,
      reasons,
    }
  }
  if (level === 'caution') {
    return {
      level,
      title: t.cautionTitle,
      message: t.cautionMessage,
      reasons,
    }
  }
  return { level: 'ok', title: '', message: '', reasons: [] }
}
