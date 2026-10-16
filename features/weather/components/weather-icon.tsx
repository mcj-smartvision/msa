/**
 * @file features/weather/components/weather-icon.tsx
 * @purpose کامپوننت UI — هوای کارگاه (weather-icon)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on shared/lib/utils
 */

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function weatherIconFor(weatherId: number): LucideIcon {
  if (weatherId >= 200 && weatherId < 300) return CloudLightning
  if (weatherId >= 300 && weatherId < 400) return CloudDrizzle
  if (weatherId >= 500 && weatherId < 600) return CloudRain
  if (weatherId >= 600 && weatherId < 700) return CloudSnow
  if (weatherId >= 700 && weatherId < 800) return CloudFog
  if (weatherId === 800) return Sun
  if (weatherId === 801 || weatherId === 802) return CloudSun
  return Cloud
}

export function WeatherIcon({
  weatherId,
  className,
}: {
  weatherId: number
  className?: string
}) {
  const Icon = weatherIconFor(weatherId)
  return <Icon className={cn('h-3.5 w-3.5 shrink-0 text-sky-600', className)} aria-hidden />
}
