'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { isoToCalendarInput, parseScheduleDateInput } from '@/features/schedule/lib/dates'

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
        ? 'تاریخ (هجری شمسی)'
        : 'Date (Solar Hijri)'
      : fa
        ? 'تاریخ (میلادی)'
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
        {fa ? ' — مثال: ۱۴۰۳/۰۷/۱۴' : ' — e.g. 1403/07/14'}
      </p>
      {invalid ? (
        <p className="text-xs text-destructive mt-1">
          {fa ? 'فرمت: 1403/07/14' : 'Format: 1403/07/14'}
        </p>
      ) : null}
    </div>
  )
}
