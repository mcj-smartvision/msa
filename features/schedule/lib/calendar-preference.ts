export type ScheduleCalendar = 'gregorian' | 'jalali'

export const SCHEDULE_CALENDAR_KEY = 'sitepilot_schedule_calendar'

export function readScheduleCalendar(): ScheduleCalendar {
  if (typeof window === 'undefined') return 'jalali'
  const v = localStorage.getItem(SCHEDULE_CALENDAR_KEY)
  if (v === 'gregorian') return 'gregorian'
  if (v === 'jalali') return 'jalali'
  return 'jalali'
}

export function writeScheduleCalendar(calendar: ScheduleCalendar) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SCHEDULE_CALENDAR_KEY, calendar)
}
