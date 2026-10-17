/**
 * @file features/site-report/lib/weather-from-site.ts
 * @purpose پر کردن آب‌وهوای گزارش از وضعیت زندهٔ کارگاه (قابل ویرایش بعدی)
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/weather/lib/types, features/site-report/lib/types
 */

import type { WeatherPayload } from '@/features/weather/lib/types'
import type { SiteReportWeather, WeatherImpactFa } from '@/features/site-report/lib/types'

function impactFromRisk(level: string): WeatherImpactFa {
  if (level === 'severe') return 'توقف کامل'
  if (level === 'caution') return 'کاهش بازده'
  return 'بدون اثر'
}

/** Map live site weather into the report weather block (single condition — no morning/noon/evening). */
export function siteReportWeatherFromPayload(payload: WeatherPayload): SiteReportWeather {
  const c = payload.current
  const today = payload.days.find((d) => d.kind === 'today')
  return {
    location_name: payload.location.name,
    condition: c.description,
    morning_condition: null,
    noon_condition: null,
    evening_condition: null,
    min_temp_c: today?.tempMin ?? Math.round(c.temp),
    max_temp_c: today?.tempMax ?? Math.round(c.temp),
    impact_level: impactFromRisk(c.risk.level),
    lost_hours: null,
    notes: c.risk.level === 'ok' ? null : c.risk.message,
  }
}
