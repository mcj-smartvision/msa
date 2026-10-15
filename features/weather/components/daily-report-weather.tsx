'use client'

import { WeatherIcon } from '@/features/weather/components/weather-icon'
import { useWeather } from '@/features/weather/hooks/use-weather'
import { formatWeatherReportLine } from '@/features/weather/lib/report-stamp'
import type { WeatherPayload } from '@/features/weather/lib/types'
import { faNumber } from '@/features/manager/lib/format'
import { cn } from '@/shared/lib/utils'

export function DailyReportWeatherBanner({
  projectId,
  compact = false,
}: {
  projectId: string | null
  compact?: boolean
}) {
  const { data, loading } = useWeather(projectId)
  if (!data && loading) {
    return (
      <p className="text-xs text-slate-500" aria-busy="true">
        در حال درج وضعیت هوا…
      </p>
    )
  }
  if (!data) return null
  const current = data.current
  const risk = current.risk.level
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        risk === 'severe'
          ? 'border-red-200 bg-red-50 text-red-900'
          : risk === 'caution'
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-sky-100 bg-sky-50 text-slate-800'
      )}
    >
      <WeatherIcon weatherId={current.weatherId} className="mt-0.5 h-4 w-4" />
      <div className="min-w-0">
        <p className="font-semibold">
          وضعیت هوا · {data.location.name} · {current.description} · {faNumber(Math.round(current.temp))}°
        </p>
        {compact ? null : (
          <p className="mt-0.5 text-xs leading-5 text-current/80">{formatWeatherReportLine(data)}</p>
        )}
      </div>
    </div>
  )
}

export function weatherStampFrom(data: WeatherPayload | null): string {
  return data ? formatWeatherReportLine(data) : ''
}
