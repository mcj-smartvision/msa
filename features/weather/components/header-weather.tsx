/**
 * @file features/weather/components/header-weather.tsx
 * @purpose کامپوننت UI — هوای کارگاه (header-weather)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on features/weather/components/weather-icon, features/weather/hooks/use-weather, features/weather/lib/types, features/manager/lib/format, shared/components/layout/header-chip, shared/lib/time/jalali-month, shared/hooks/use-synced-project-id, shared/lib/utils, features/weather/config
 */

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloudOff, Droplets, Wind } from 'lucide-react'
import { WeatherIcon } from '@/features/weather/components/weather-icon'
import { useWeather } from '@/features/weather/hooks/use-weather'
import type { OutdoorRiskLevel, WeatherDay } from '@/features/weather/lib/types'
import { faNumber } from '@/features/manager/lib/format'
import { HEADER_CHIP } from '@/shared/components/layout/header-chip'
import { PERSIAN_MONTHS, isoToJalali } from '@/shared/lib/time/jalali-month'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import { cn } from '@/shared/lib/utils'
import { WEATHER_COPY } from '@/features/weather/config'

function tempLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${faNumber(Math.round(value))}°`
}

function windLabel(ms: number | null | undefined): string {
  if (ms == null) return '—'
  return WEATHER_COPY.windKmh(faNumber(Math.round(ms * 3.6)))
}

function humidityLabel(value: number | null | undefined): string {
  if (value == null) return '—'
  return WEATHER_COPY.humidityPct(faNumber(Math.round(value)))
}

function riskDot(level: OutdoorRiskLevel) {
  if (level === 'severe') return 'bg-red-500'
  if (level === 'caution') return 'bg-amber-400'
  return null
}

function dayLabel(day: WeatherDay): string {
  if (day.kind === 'today') return WEATHER_COPY.today
  const { jm, jd } = isoToJalali(day.iso)
  return `${jd} ${PERSIAN_MONTHS[jm - 1]}`
}

function DayRow({ day }: { day: WeatherDay }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[4.75rem_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
        day.kind === 'today' && 'bg-sky-50 ring-1 ring-sky-100'
      )}
    >
      <span className="tabular-nums text-slate-500">{dayLabel(day)}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-slate-800">
        <WeatherIcon weatherId={day.weatherId} />
        <span className="truncate">{day.condition}</span>
      </span>
      <span className="tabular-nums text-slate-700">
        {day.tempMin != null && day.tempMax != null
          ? `${tempLabel(day.tempMin)} / ${tempLabel(day.tempMax)}`
          : tempLabel(day.temp)}
      </span>
    </li>
  )
}

export function HeaderWeather({ className }: { className?: string }) {
  const projectId = useSyncedProjectId(null)
  const { data, error, loading } = useWeather(projectId)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 56, left: 16 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return
    const box = wrapRef.current.getBoundingClientRect()
    const width = Math.min(352, window.innerWidth - 24)
    const left = Math.min(Math.max(12, box.left), window.innerWidth - width - 12)
    setPos({ top: box.bottom + 8, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (wrapRef.current?.contains(target) || dialogRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = data?.current
  const past = data?.days.filter((d) => d.kind === 'past') ?? []
  const today = data?.days.find((d) => d.kind === 'today')
  const future = data?.days.filter((d) => d.kind === 'future') ?? []
  const chipRisk = current?.risk.level ?? 'ok'
  const dot = riskDot(chipRisk)

  const panel = open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label={WEATHER_COPY.ariaLabel}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[80] max-h-[min(32rem,calc(100vh-4.5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          {error && !data ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : !data ? (
            <p className="text-xs text-slate-500">{WEATHER_COPY.loading}</p>
          ) : (
            <div className="space-y-3 text-right">
              <div>
                <p className="text-[11px] font-medium text-slate-500">{data.location.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <WeatherIcon weatherId={current!.weatherId} className="h-4 w-4" />
                  {current!.description}
                  <span className="tabular-nums">{tempLabel(current!.temp)}</span>
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="h-3 w-3 text-sky-500" aria-hidden />
                    {WEATHER_COPY.humidity} {humidityLabel(current!.humidity)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wind className="h-3 w-3 text-slate-500" aria-hidden />
                    {WEATHER_COPY.wind} {windLabel(current!.windMs)}
                  </span>
                </p>
              </div>

              {current!.risk.level !== 'ok' ? (
                <p
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-[11px] leading-5',
                    current!.risk.level === 'severe'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-amber-50 text-amber-900'
                  )}
                >
                  {current!.risk.message}
                </p>
              ) : null}

              <section>
                <h3 className="mb-1 text-[11px] font-semibold text-slate-500">{WEATHER_COPY.past7}</h3>
                <ul className="space-y-0.5">{past.map((day) => <DayRow key={day.iso} day={day} />)}</ul>
              </section>
              {today ? (
                <section>
                  <h3 className="mb-1 text-[11px] font-semibold text-slate-500">{WEATHER_COPY.today}</h3>
                  <ul>
                    <DayRow day={today} />
                  </ul>
                </section>
              ) : null}
              <section>
                <h3 className="mb-1 text-[11px] font-semibold text-slate-500">{WEATHER_COPY.next7}</h3>
                <ul className="space-y-0.5">{future.map((day) => <DayRow key={day.iso} day={day} />)}</ul>
              </section>
            </div>
          )}
        </div>
      ) : null

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(HEADER_CHIP, 'inline-flex max-w-[220px] items-center whitespace-nowrap font-medium')}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={
          current
            ? WEATHER_COPY.chipTitle(
                data?.location.name,
                current.description,
                humidityLabel(current.humidity),
                windLabel(current.windMs)
              )
            : WEATHER_COPY.status
        }
      >
        {current ? (
          <WeatherIcon weatherId={current.weatherId} />
        ) : error ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <WeatherIcon weatherId={800} className={loading ? 'animate-pulse' : undefined} />
        )}
        <span className="tabular-nums">{current ? tempLabel(current.temp) : loading ? '…' : WEATHER_COPY.weather}</span>
        <span className="hidden max-w-[7rem] truncate sm:inline">{current?.condition ?? ''}</span>
        {dot ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden /> : null}
      </button>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
