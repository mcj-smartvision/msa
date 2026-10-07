'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { JalaliMonthGrid } from '@/features/holidays/components/jalali-month-grid'
import { useDismiss } from '@/features/holidays/hooks/use-dismiss'
import { useHolidays } from '@/features/holidays/hooks/use-holidays'
import { holidaysOn } from '@/features/holidays/lib/work-calendar'
import { HEADER_CHIP } from '@/shared/components/layout/header-chip'
import { formatJalaliLong, isoToJalali } from '@/shared/lib/time/jalali-month'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { cn } from '@/shared/lib/utils'

/** Today's Jalali date in the header; opens a month calendar with Fridays and registered holidays. */
export function PersianCalendar({ className }: { className?: string }) {
  const [today, setToday] = useState(todayTehranIso)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => isoToJalali(todayTehranIso()))
  const { holidays } = useHolidays()
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  useEffect(() => {
    const timer = setInterval(() => setToday(todayTehranIso()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const todayHolidays = holidaysOn(holidays, today)

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          if (!open) setView(isoToJalali(today))
          setOpen((v) => !v)
        }}
        className={cn(HEADER_CHIP, 'inline-flex items-center whitespace-nowrap font-medium')}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={todayHolidays.map((h) => h.title).join('، ') || 'تقویم'}
      >
        <CalendarDays className={cn('h-3.5 w-3.5 shrink-0', todayHolidays.length ? 'text-red-500' : 'text-slate-500')} aria-hidden />
        {formatJalaliLong(today)}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="تقویم"
          className="absolute left-0 top-full z-[60] mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <JalaliMonthGrid
            year={view.jy}
            month={view.jm}
            onMonthChange={(next) => setView({ ...next, jd: 1 })}
            todayIso={today}
            holidays={holidays}
          />
        </div>
      ) : null}
    </div>
  )
}
