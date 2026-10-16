/**
 * @file features/schedule/components/schedule-date-input.tsx
 * @purpose کامپوننت UI — زمان‌بندی، WBS و گانت (schedule-date-input)
 * @safe-to-edit CAREFUL
 * @affects زمان‌بندی، WBS و گانت
 * @depends-on shared/components/ui/input, shared/components/ui/label, features/schedule/hooks/use-schedule-calendar, shared/components/i18n/locale-provider, features/schedule/lib/dates, features/schedule/config
 */

'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { isoToCalendarInput, parseScheduleDateInput } from '@/features/schedule/lib/dates'
import { SCHEDULE_DATE_COPY } from '@/features/schedule/config'

interface ScheduleDateInputProps {
  id?: string
  label?: string
  /** Normalized Gregorian ISO date (YYYY-MM-DD). */
  valueIso: string
  onChangeIso: (iso: string) => void
  className?: string
  disabled?: boolean
  required?: boolean
}

/** Date input that follows the global calendar mode (Gregorian or Shamsi). */
export function ScheduleDateInput({
  id,
  label,
  valueIso,
  onChangeIso,
  className,
  disabled,
  required,
}: ScheduleDateInputProps) {
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const { calendar } = useScheduleCalendar()
  const [textValue, setTextValue] = useState(() => isoToCalendarInput(valueIso, calendar))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setTextValue(isoToCalendarInput(valueIso, calendar))
    setInvalid(false)
  }, [valueIso, calendar])

  function commitInput(raw: string) {
    const parsed = parseScheduleDateInput(raw, calendar)
    if (!parsed) {
      setInvalid(raw.trim().length > 0)
      return
    }
    setInvalid(false)
    onChangeIso(parsed)
    setTextValue(isoToCalendarInput(parsed, calendar))
  }

  const calendarLabel =
    calendar === 'jalali'
      ? fa
        ? SCHEDULE_DATE_COPY.jalali
        : 'Date (Solar Hijri)'
      : fa
        ? SCHEDULE_DATE_COPY.gregorian
        : 'Date (Gregorian)'

  if (calendar === 'gregorian') {
    return (
      <div className={className}>
        {label ? (
          <Label htmlFor={id} className="text-xs mb-1.5 block">
            {label ?? calendarLabel}
          </Label>
        ) : null}
        <Input
          id={id}
          type="date"
          value={valueIso}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            onChangeIso(e.target.value)
            setInvalid(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={id} className="text-xs mb-1.5 block">
          {label ?? calendarLabel}
        </Label>
      ) : null}
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="1403/07/14"
        value={textValue}
        disabled={disabled}
        required={required}
        className={invalid ? 'border-destructive' : undefined}
        dir="ltr"
        onChange={(e) => setTextValue(e.target.value)}
        onBlur={(e) => commitInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitInput(textValue)
        }}
      />
      <p className="text-[10px] text-muted-foreground mt-1">
        {calendarLabel}
        {fa ? SCHEDULE_DATE_COPY.jalaliExample : ' — e.g. 1403/07/14'}
      </p>
      {invalid ? (
        <p className="text-xs text-destructive mt-1">
          {fa ? SCHEDULE_DATE_COPY.jalaliFormat : 'Format: 1403/07/14'}
        </p>
      ) : null}
    </div>
  )
}
