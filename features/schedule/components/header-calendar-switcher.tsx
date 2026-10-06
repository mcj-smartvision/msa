'use client'

import { Calendar } from 'lucide-react'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import type { ScheduleCalendar } from '@/features/schedule/lib/calendar-preference'
import { HEADER_CHIP } from '@/shared/components/layout/header-chip'
import { cn } from '@/shared/lib/utils'

const CALENDAR_OPTIONS: { value: ScheduleCalendar; labelEn: string; labelFa: string; short: string }[] = [
  { value: 'gregorian', labelEn: 'Gregorian', labelFa: 'میلادی', short: 'G' },
  { value: 'jalali', labelEn: 'Shamsi (Jalali)', labelFa: 'هجری شمسی', short: 'J' },
]

/** Global calendar switcher — same placement pattern as language switcher. */
export function HeaderCalendarSwitcher({ className }: { className?: string }) {
  const { locale, app } = useLocale()
  const fa = locale === 'fa'
  const { calendar, setCalendar } = useScheduleCalendar()
  const current = CALENDAR_OPTIONS.find((o) => o.value === calendar)

  return (
    <div className={className}>
      <Select value={calendar} onValueChange={(v) => setCalendar(v as ScheduleCalendar)}>
        <SelectTrigger
          className={cn(HEADER_CHIP, 'w-auto min-w-0')}
          aria-label={app.calendar}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <SelectValue placeholder={app.calendar}>
            <span className="truncate">
              {current ? (fa ? current.labelFa : current.labelEn) : calendar}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {CALENDAR_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="font-medium">{opt.short}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span>{fa ? opt.labelFa : opt.labelEn}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
