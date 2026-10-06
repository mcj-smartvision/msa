'use client'

import { formatScheduleDate, formatScheduleDateTime } from '@/features/schedule/lib/dates'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'

interface FormattedDateProps {
  value: string | null | undefined
  /** Include time portion (default: date only). */
  dateTime?: boolean
  className?: string
}

/** Renders a date using the global calendar preference (Gregorian / Shamsi). */
export function FormattedDate({ value, dateTime = false, className }: FormattedDateProps) {
  const { calendar } = useScheduleCalendar()
  const text = dateTime ? formatScheduleDateTime(value, calendar) : formatScheduleDate(value, calendar)
  return <span className={className}>{text}</span>
}
