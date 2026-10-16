/**
 * @file features/schedule/components/schedule-date-toolbar.tsx
 * @purpose کامپوننت UI — زمان‌بندی، WBS و گانت (schedule-date-toolbar)
 * @safe-to-edit CAREFUL
 * @affects زمان‌بندی، WBS و گانت
 * @depends-on shared/components/ui/button, features/schedule/components/schedule-date-input, features/schedule/components/formatted-date, features/schedule/hooks/use-schedule-view-date, shared/components/i18n/locale-provider, features/schedule/config
 */

'use client'

import { Button } from '@/shared/components/ui/button'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { useScheduleViewDate } from '@/features/schedule/hooks/use-schedule-view-date'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { SCHEDULE_DATE_COPY } from '@/features/schedule/config'

interface ScheduleDateToolbarProps {
  viewDate?: string
  onViewDateChange?: (iso: string) => void
  onResetToday?: () => void
}

export function ScheduleDateToolbar(props: ScheduleDateToolbarProps = {}) {
  const internal = useScheduleViewDate()
  const viewDate = props.viewDate ?? internal.viewDate
  const setViewDate = props.onViewDateChange ?? internal.setViewDate
  const resetToToday = props.onResetToday ?? internal.resetToToday

  const { locale } = useLocale()
  const fa = locale === 'fa'

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/20 p-4">
      <ScheduleDateInput
        id="schedule-view-date"
        label={fa ? SCHEDULE_DATE_COPY.viewOnDate : 'View schedule on date'}
        valueIso={viewDate}
        onChangeIso={setViewDate}
        className="min-w-[200px]"
      />
      <Button type="button" size="sm" variant="outline" className="h-9 mb-0.5" onClick={resetToToday}>
        {fa ? SCHEDULE_DATE_COPY.today : 'Today'}
      </Button>
      <p className="text-xs text-muted-foreground pb-2">
        {fa ? SCHEDULE_DATE_COPY.selected : 'Selected:'}{' '}
        <span className="tabular-nums">
          <FormattedDate value={viewDate} />
        </span>
      </p>
    </div>
  )
}
