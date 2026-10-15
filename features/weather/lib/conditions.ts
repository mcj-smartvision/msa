import type { OutdoorAlert, OutdoorRiskLevel } from '@/features/weather/lib/types'

/** OWM ids: 2xx thunder, 3xx drizzle, 5xx rain, 6xx snow, 7xx atmosphere, 800 clear, 80x clouds. */
export function conditionLabelFa(weatherId: number): string {
  if (weatherId >= 200 && weatherId < 300) return 'رعدوبرق'
  if (weatherId >= 300 && weatherId < 400) return 'نم‌نم باران'
  if (weatherId >= 500 && weatherId < 600) return 'بارانی'
  if (weatherId >= 600 && weatherId < 700) return 'برفی'
  if (weatherId >= 700 && weatherId < 800) return 'مه‌آلود'
  if (weatherId === 800) return 'آفتابی'
  if (weatherId > 800 && weatherId < 900) return 'ابری'
  return 'نامشخص'
}

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
export function classifyOutdoorRisk(input: {
  weatherId: number
  windMs: number
  rainMm?: number
}): OutdoorAlert {
  const reasons: string[] = []
  const id = input.weatherId
  const rainMm = input.rainMm ?? 0
  const thunder = id >= 200 && id < 300
  const heavyRain = HEAVY_RAIN_IDS.has(id) || rainMm >= 10
  const strongWind = input.windMs >= 12
  const heavySnow = HEAVY_SNOW_IDS.has(id)
  const anyPrecip = (id >= 300 && id < 700) || rainMm >= 1
  const windy = input.windMs >= 8

  if (heavyRain) reasons.push('بارندگی شدید')
  if (thunder) reasons.push('رعدوبرق')
  if (strongWind) reasons.push('باد خیلی تند')
  if (heavySnow) reasons.push('برف سنگین')

  let level: OutdoorRiskLevel = 'ok'
  if (reasons.length > 0) {
    level = 'severe'
  } else {
    if (anyPrecip) reasons.push(id >= 600 && id < 700 ? 'برف' : 'بارندگی')
    if (windy) reasons.push('باد نسبتاً تند')
    if (reasons.length > 0) level = 'caution'
  }

  if (level === 'severe') {
    return {
      level,
      title: 'هشدار کارهای فضای باز',
      message: 'شرایط جوی نامساعد است. بتن‌ریزی، نما و سایر کارهای فضای باز را متوقف کنید.',
      reasons,
    }
  }
  if (level === 'caution') {
    return {
      level,
      title: 'احتیاط کارهای فضای باز',
      message: 'هوا برای بتن‌ریزی و کارهای فضای باز مساعد نیست؛ با احتیاط ادامه دهید یا برنامه را جابه‌جا کنید.',
      reasons,
    }
  }
  return { level: 'ok', title: '', message: '', reasons: [] }
}
