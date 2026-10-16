/**
 * @file features/weather/components/outdoor-weather-alert.tsx
 * @purpose کامپوننت UI — هوای کارگاه (outdoor-weather-alert)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on features/weather/hooks/use-weather, features/manager/lib/format, shared/lib/utils, features/weather/config
 */

'use client'

import { AlertTriangle, CloudSun } from 'lucide-react'
import { useWeather } from '@/features/weather/hooks/use-weather'
import { faNumber } from '@/features/manager/lib/format'
import { cn } from '@/shared/lib/utils'
import { WEATHER_COPY } from '@/features/weather/config'

export function OutdoorWeatherAlert({ projectId }: { projectId: string | null }) {
  const { data } = useWeather(projectId)
  if (!data) return null

  const watch = [data.current.risk, ...data.days.filter((d) => d.kind !== 'past').map((d) => d.risk)]
  const risk = watch.find((item) => item.level === 'severe') ?? watch.find((item) => item.level === 'caution')
  if (!risk) return null

  const severe = risk.level === 'severe'
  const temp = faNumber(Math.round(data.current.temp))

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm leading-6',
        severe ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-950'
      )}
    >
      {severe ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <div>
        <p className="font-semibold">{risk.title}</p>
        <p className="text-[13px]">
          {data.location.name} · {data.current.description} · {temp}° — {risk.message}
          {risk.reasons.length
            ? WEATHER_COPY.reasonsSuffix(risk.reasons.join(WEATHER_COPY.listSep))
            : ''}
        </p>
      </div>
    </div>
  )
}
