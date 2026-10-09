'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { formatScheduleDateTime } from '@/features/schedule/lib/dates'

function formatSiteLoginAt(value: string, fa: boolean, calendar: 'jalali' | 'gregorian') {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  if (fa) {
    return d.toLocaleString('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }
  return formatScheduleDateTime(value, calendar)
}

/** Below workspace sidebar — last site login for the current user. */
export function LastPresenceSidebarFooter() {
  const { locale } = useLocale()
  const { calendar } = useScheduleCalendar()
  const fa = locale === 'fa' || locale === 'ar'
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void fetch('/api/auth/my-last-login')
      .then((res) => res.json().catch(() => ({})))
      .then((data: { lastLoginAt?: string | null }) => {
        if (!cancelled) {
          setLastLoginAt(data.lastLoginAt ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setLastLoginAt(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-center shadow-sm"
      dir="rtl"
      lang="fa"
    >
      <p className="text-sm font-bold text-slate-900">آخرین ورود به سایت</p>
      {loading ? (
        <div className="mt-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-800">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>در حال بارگذاری...</span>
        </div>
      ) : lastLoginAt ? (
        <p className="mt-2 text-[15px] font-bold leading-relaxed tabular-nums text-slate-900">
          {formatSiteLoginAt(lastLoginAt, fa, calendar)}
        </p>
      ) : (
        <p className="mt-2 text-sm font-semibold text-slate-800">ثبت نشده</p>
      )}
    </div>
  )
}
