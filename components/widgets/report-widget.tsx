'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/hooks/useSupabase'
import { fetchReportsArchive } from '@/utils/reports'
import type { ReportWithAnalysis } from '@/types'
import type { WidgetRenderContext } from '@/types/dashboard'
import { WidgetShell } from '@/components/widgets/widget-shell'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { Skeleton } from '@/components/ui/skeleton'

export function ReportWidget({ context }: { context: WidgetRenderContext }) {
  const supabase = useSupabase()
  const [reports, setReports] = useState<ReportWithAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportsArchive(supabase, context.projectId ?? undefined)
      .then(setReports)
      .finally(() => setLoading(false))
  }, [context.projectId, supabase])

  return (
    <WidgetShell
      title="گزارش‌های اخیر"
      description="آخرین گزارش‌های تصویری سایت"
      action={
        <Link href="/reports/new" className="text-xs text-primary underline">
          گزارش جدید
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">هنوز گزارشی ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {reports.slice(0, 5).map((report) => (
            <li key={report.id} className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{report.activity_type ?? 'گزارش سایت'}</p>
              <p className="text-xs text-muted-foreground">
                <FormattedDate value={report.created_at} dateTime /> · نیروی کار {report.workforce_count ?? '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  )
}
