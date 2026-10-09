import type { HolidayInput } from '@/features/holidays/lib/types'

export const END_BEFORE_START_ERROR = 'تاریخ پایان نباید قبل از تاریخ شروع باشد'

export const isEndBeforeStart = (f: Pick<HolidayInput, 'startDate' | 'endDate'>) =>
  !!f.startDate && !!f.endDate && f.endDate < f.startDate

/** A weekly rule's end is an open-ended "until", so only dated holidays get end defaulted to start. */
export function withDefaultEnd(f: HolidayInput): HolidayInput {
  if (f.type === 'weekly' || !f.startDate) return f
  if (f.endDate && f.endDate >= f.startDate) return f
  return { ...f, endDate: f.startDate }
}
