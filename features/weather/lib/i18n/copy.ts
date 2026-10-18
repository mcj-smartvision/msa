/**
 * @file features/weather/lib/i18n/copy.ts
 * @purpose Localized weather UI, condition labels, and outdoor-risk messages
 * @safe-to-edit YES
 * @affects header weather, outdoor alert, daily-report weather, fetch-weather
 * @depends-on features/project-init/lib/i18n/types, shared/lib/i18n/pick-messages, shared/lib/i18n/make-live-copy
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { makeLiveCopy } from '@/shared/lib/i18n/make-live-copy'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

const UI_EN = {
  windKmh: (label: string) => `${label} km/h`,
  humidityPct: (label: string) => `${label}%`,
  today: 'Today',
  ariaLabel: 'Weather',
  loading: 'Loading weather…',
  humidity: 'Humidity',
  wind: 'Wind',
  past7: 'Past 7 days',
  next7: 'Next 7 days',
  chipTitle: (name: string | undefined, description: string, humidity: string, wind: string) =>
    `${name} · ${description} · humidity ${humidity} · wind ${wind}`,
  status: 'Weather',
  weather: 'Weather',
  reasonsSuffix: (joined: string) => ` (${joined})`,
  listSep: ', ',
  inserting: 'Inserting weather…',
  bannerLine: (name: string, description: string, temp: string) =>
    `Weather · ${name} · ${description} · ${temp}°`,
  loadFailed: 'Failed to load weather.',
  tehran: 'Tehran',
}

const UI_FA: typeof UI_EN = {
  windKmh: (label: string) => `${label} کیلومتر/ساعت`,
  humidityPct: (label: string) => `${label}٪`,
  today: 'امروز',
  ariaLabel: 'وضعیت هوا',
  loading: 'در حال خواندن وضعیت هوا…',
  humidity: 'رطوبت',
  wind: 'باد',
  past7: 'هفت روز گذشته',
  next7: 'هفت روز آینده',
  chipTitle: (name: string | undefined, description: string, humidity: string, wind: string) =>
    `${name} · ${description} · رطوبت ${humidity} · باد ${wind}`,
  status: 'وضعیت هوا',
  weather: 'هوا',
  reasonsSuffix: (joined: string) => ` (${joined})`,
  listSep: '، ',
  inserting: 'در حال درج وضعیت هوا…',
  bannerLine: (name: string, description: string, temp: string) =>
    `وضعیت هوا · ${name} · ${description} · ${temp}°`,
  loadFailed: 'خواندن وضعیت هوا ناموفق بود.',
  tehran: 'تهران',
}

export const WEATHER_COPY = makeLiveCopy({
  fa: UI_FA,
  en: UI_EN as unknown as typeof UI_FA,
})

export function getWeatherUi(locale: FormLocale): typeof UI_EN {
  return pickMessages(locale, { fa: UI_FA, en: UI_EN, de: UI_EN })
}

type ConditionKey =
  | 'thunder'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'clear'
  | 'clouds'
  | 'unknown'

const CONDITION_EN: Record<ConditionKey, string> = {
  thunder: 'Thunderstorm',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  fog: 'Fog',
  clear: 'Clear',
  clouds: 'Cloudy',
  unknown: 'Unknown',
}

const CONDITION_FA: Record<ConditionKey, string> = {
  thunder: 'رعدوبرق',
  drizzle: 'نم‌نم باران',
  rain: 'بارانی',
  snow: 'برفی',
  fog: 'مه‌آلود',
  clear: 'آفتابی',
  clouds: 'ابری',
  unknown: 'نامشخص',
}

export function conditionKeyFor(weatherId: number): ConditionKey {
  if (weatherId >= 200 && weatherId < 300) return 'thunder'
  if (weatherId >= 300 && weatherId < 400) return 'drizzle'
  if (weatherId >= 500 && weatherId < 600) return 'rain'
  if (weatherId >= 600 && weatherId < 700) return 'snow'
  if (weatherId >= 700 && weatherId < 800) return 'fog'
  if (weatherId === 800) return 'clear'
  if (weatherId > 800 && weatherId < 900) return 'clouds'
  return 'unknown'
}

export function conditionLabel(weatherId: number, locale: FormLocale): string {
  const key = conditionKeyFor(weatherId)
  return pickMessages(locale, { fa: CONDITION_FA, en: CONDITION_EN, de: CONDITION_EN })[key]
}

const RISK_EN = {
  heavyRain: 'Heavy rain',
  thunder: 'Thunderstorm',
  veryStrongWind: 'Very strong wind',
  heavySnow: 'Heavy snow',
  snow: 'Snow',
  rain: 'Rain',
  moderateWind: 'Moderate wind',
  severeTitle: 'Outdoor work warning',
  severeMessage:
    'Weather is unsuitable. Stop concrete pouring, façade work and other outdoor activities.',
  cautionTitle: 'Outdoor work caution',
  cautionMessage:
    'Conditions are not ideal for concrete pouring and outdoor work; proceed carefully or reschedule.',
}

const RISK_FA: typeof RISK_EN = {
  heavyRain: 'بارندگی شدید',
  thunder: 'رعدوبرق',
  veryStrongWind: 'باد خیلی تند',
  heavySnow: 'برف سنگین',
  snow: 'برف',
  rain: 'بارندگی',
  moderateWind: 'باد نسبتاً تند',
  severeTitle: 'هشدار کارهای فضای باز',
  severeMessage: 'شرایط جوی نامساعد است. بتن‌ریزی، نما و سایر کارهای فضای باز را متوقف کنید.',
  cautionTitle: 'احتیاط کارهای فضای باز',
  cautionMessage:
    'هوا برای بتن‌ریزی و کارهای فضای باز مساعد نیست؛ با احتیاط ادامه دهید یا برنامه را جابه‌جا کنید.',
}

export function getWeatherRiskCopy(locale: FormLocale): typeof RISK_EN {
  return pickMessages(locale, { fa: RISK_FA, en: RISK_EN, de: RISK_EN })
}

const STAMP_EN = {
  prefix: 'Weather:',
  humidity: (v: string) => `humidity ${v}`,
  wind: (v: string) => `wind ${v}`,
  windKmh: (v: string) => `${v} km/h`,
  weatherDeg: (desc: string, temp: string) => `${desc}, ${temp}°`,
  windSigns: (v: string) => `Wind ${v} km/h`,
}

const STAMP_FA: typeof STAMP_EN = {
  prefix: 'وضعیت هوا:',
  humidity: (v: string) => `رطوبت ${v}`,
  wind: (v: string) => `باد ${v}`,
  windKmh: (v: string) => `${v} کیلومتر/ساعت`,
  weatherDeg: (desc: string, temp: string) => `${desc}، ${temp} درجه`,
  windSigns: (v: string) => `باد ${v} کیلومتر بر ساعت`,
}

export function getWeatherStampCopy(locale: FormLocale): typeof STAMP_EN {
  return pickMessages(locale, { fa: STAMP_FA, en: STAMP_EN, de: STAMP_EN })
}
