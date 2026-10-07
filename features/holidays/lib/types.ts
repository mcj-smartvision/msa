export type HolidayType = 'weekly' | 'official' | 'organizational'

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  weekly: 'جمعه‌ها / تعطیلی هفتگی',
  official: 'مناسبت رسمی',
  organizational: 'تعطیلی سازمانی',
}

/** What the work calendar needs from a holiday; dates are Gregorian YYYY-MM-DD. */
export interface HolidayRule {
  type: HolidayType
  startDate: string
  /** Last day of a multi-day holiday; for a weekly holiday, the last week it applies (null = open-ended). */
  endDate: string | null
  isActive: boolean
}

export interface Holiday extends HolidayRule {
  id: string
  title: string
  description: string | null
  createdAt: string
}

export interface HolidayInput {
  type: HolidayType
  startDate: string
  endDate: string | null
  title: string
  description: string | null
  isActive: boolean
}

export function holidayFromRow(row: Record<string, unknown>): Holiday {
  return {
    id: String(row.id),
    type: row.type as HolidayType,
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    title: String(row.title ?? ''),
    description: row.description ? String(row.description) : null,
    isActive: row.is_active !== false,
    createdAt: String(row.created_at ?? ''),
  }
}
