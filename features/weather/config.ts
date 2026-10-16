/**
 * @file features/weather/config.ts
 * @purpose برچسب‌های فارسی هوای کارگاه
 * @safe-to-edit YES
 * @affects هدر هوا و هشدار فضای باز
 * @depends-on nothing
 */

export const WEATHER_COPY = {
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
} as const
