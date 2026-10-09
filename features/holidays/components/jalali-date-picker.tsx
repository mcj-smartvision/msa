'use client'

import { useCallback, useRef, useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { JalaliMonthGrid } from '@/features/holidays/components/jalali-month-grid'
import { useDismiss } from '@/features/holidays/hooks/use-dismiss'
import type { Holiday } from '@/features/holidays/lib/types'
import { formatJalaliShort, isoToJalali } from '@/shared/lib/time/jalali-month'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { cn } from '@/shared/lib/utils'

interface JalaliDatePickerProps {
  id?: string
  /** Gregorian YYYY-MM-DD, or '' when empty. */
  value: string
  onChange: (iso: string) => void
  holidays?: Holiday[]
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  /** Gregorian YYYY-MM-DD; days before it are disabled. */
  min?: string
}

export function JalaliDatePicker({
  id,
  value,
  onChange,
  holidays = [],
  placeholder = 'انتخاب تاریخ',
  clearable,
  disabled,
  min,
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => isoToJalali(value || min || todayTehranIso()))
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm',
          disabled && 'opacity-50'
        )}
      >
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!open) setView(isoToJalali(value || min || todayTehranIso()))
            setOpen((v) => !v)
          }}
          className="flex flex-1 items-center gap-2 text-start"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span className={value ? 'text-slate-800' : 'text-muted-foreground'}>{value ? formatJalaliShort(value) : placeholder}</span>
        </button>
        {clearable && value && !disabled ? (
          <button type="button" onClick={() => onChange('')} className="text-slate-400 hover:text-slate-700" aria-label="پاک کردن تاریخ">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {open ? (
        <div role="dialog" className="absolute right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <JalaliMonthGrid
            year={view.jy}
            month={view.jm}
            onMonthChange={(next) => setView({ ...next, jd: 1 })}
            todayIso={todayTehranIso()}
            holidays={holidays}
            selectedIso={value || null}
            minIso={min || null}
            onSelect={(iso) => {
              onChange(iso)
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
