'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Holiday } from '@/features/holidays/lib/types'
import { holidaysOn } from '@/features/holidays/lib/work-calendar'
import {
  gregorianSpanLabel,
  jalaliMonthWeeks,
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS,
  shiftJalaliMonth,
  toPersianDigits,
} from '@/shared/lib/time/jalali-month'
import { cn } from '@/shared/lib/utils'

const WEEKDAY_INITIALS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

interface JalaliMonthGridProps {
  year: number
  month: number
  onMonthChange: (next: { jy: number; jm: number }) => void
  todayIso: string
  holidays: Holiday[]
  /** Highlighted with a ring (a picked date); today is always filled blue. */
  selectedIso?: string | null
  onSelect?: (iso: string) => void
}

/** A Jalali month, Saturday first, with the Gregorian day under each number; Fridays and holidays in red. */
export function JalaliMonthGrid({ year, month, onMonthChange, todayIso, holidays, selectedIso, onSelect }: JalaliMonthGridProps) {
  const weeks = jalaliMonthWeeks(year, month)

  return (
    <div className="w-[300px] select-none" dir="rtl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(shiftJalaliMonth(year, month, -1))}
          className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          aria-label="ماه قبل"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          ماه قبل
        </button>
        <div className="text-center leading-tight">
          <div className="text-sm font-bold text-slate-800">
            {PERSIAN_MONTHS[month - 1]} {toPersianDigits(year)}
          </div>
          <div className="text-[10px] text-slate-400" dir="ltr">
            {gregorianSpanLabel(year, month)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(shiftJalaliMonth(year, month, 1))}
          className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          aria-label="ماه بعد"
        >
          ماه بعد
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <table className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            {PERSIAN_WEEKDAYS.map((name, i) => (
              <th
                key={name}
                title={name}
                className={cn('pb-1 text-[11px] font-medium', i === 6 ? 'text-red-500' : 'text-slate-500')}
              >
                {WEEKDAY_INITIALS[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, i) => {
                if (!day) return <td key={i} />
                const dayHolidays = holidaysOn(holidays, day.iso)
                const isHoliday = dayHolidays.length > 0
                const isFriday = day.weekday === 6
                const isToday = day.iso === todayIso
                const isSelected = selectedIso === day.iso
                const title = dayHolidays.map((h) => h.title).join('، ') || undefined
                return (
                  <td key={i} className="p-0.5">
                    <button
                      type="button"
                      title={title}
                      disabled={!onSelect}
                      onClick={() => onSelect?.(day.iso)}
                      className={cn(
                        'flex h-10 w-full flex-col items-center justify-center rounded-lg leading-none transition-colors',
                        onSelect ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default',
                        isHoliday && !isToday && 'bg-red-500 text-white hover:bg-red-600',
                        !isHoliday && isFriday && !isToday && 'text-red-500',
                        !isHoliday && !isFriday && !isToday && 'text-slate-700',
                        isToday && 'bg-sky-600 text-white hover:bg-sky-700',
                        isToday && isHoliday && 'ring-2 ring-red-500 ring-offset-1',
                        isSelected && !isToday && 'ring-2 ring-sky-600 ring-offset-1'
                      )}
                    >
                      <span className="text-sm font-semibold">{toPersianDigits(day.jd)}</span>
                      <span
                        className={cn(
                          'mt-0.5 text-[9px]',
                          isToday || isHoliday ? 'text-white/80' : 'text-slate-400'
                        )}
                        dir="ltr"
                      >
                        {day.gMonth ? `${day.gMonth} ${day.gd}` : day.gd}
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" /> امروز
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> تعطیل ثبت‌شده
        </span>
        <span className="inline-flex items-center gap-1 text-red-500">جمعه</span>
      </div>
    </div>
  )
}
