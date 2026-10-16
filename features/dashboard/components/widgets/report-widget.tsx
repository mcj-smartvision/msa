/**
 * @file features/dashboard/components/widgets/report-widget.tsx
 * @purpose کامپوننت UI — داشبورد نقش‌ها و ویجت‌ها (report-widget)
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on shared/hooks/use-supabase, features/reports/services/reports, shared/types, shared/types/dashboard, features/dashboard/components/widgets/widget-shell, features/schedule/components/formatted-date, shared/components/ui/skeleton
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { fetchReportsArchive } from '@/features/reports/services/reports'
import type { ReportWithAnalysis } from '@/shared/types'
import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { REPORT_WIDGET_COPY } from '@/features/dashboard/config'

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
      title={REPORT_WIDGET_COPY.title}
      description={REPORT_WIDGET_COPY.description}
      action={
        <Link href="/reports/new" className="text-xs text-primary underline">
          {REPORT_WIDGET_COPY.newReport}
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{REPORT_WIDGET_COPY.empty}</p>
      ) : (
        <ul className="space-y-2">
          {reports.slice(0, 5).map((report) => (
            <li key={report.id} className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{report.activity_type ?? REPORT_WIDGET_COPY.siteReport}</p>
              <p className="text-xs text-muted-foreground">
                <FormattedDate value={report.created_at} dateTime /> · {REPORT_WIDGET_COPY.workforce} {report.workforce_count ?? '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  )
}
