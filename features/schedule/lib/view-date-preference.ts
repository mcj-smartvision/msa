export const SCHEDULE_VIEW_DATE_KEY = 'sitepilot_schedule_view_date'

export function readScheduleViewDate(): string {
  if (typeof window === 'undefined') return new Date().toISOString().slice(0, 10)
  const stored = localStorage.getItem(SCHEDULE_VIEW_DATE_KEY)
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored
  return new Date().toISOString().slice(0, 10)
}

export function writeScheduleViewDate(isoDate: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SCHEDULE_VIEW_DATE_KEY, isoDate)
}
