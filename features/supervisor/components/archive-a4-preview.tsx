/**
 * @file features/supervisor/components/archive-a4-preview.tsx
 * @purpose نمایش کامل گزارش آرشیو + چاپ A4
 * @safe-to-edit YES
 * @affects صفحه آرشیو گزارش روزانه
 * @depends-on features/site-report/components/printable-daily-report, features/site-report/lib/report-from-archive
 */

'use client'

import { useId, useState } from 'react'
import { ChevronDown, ChevronUp, Printer } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { PrintableDailyReport } from '@/features/site-report/components/printable-daily-report'
import { lipartaReportFromArchive } from '@/features/site-report/lib/report-from-archive'
import type { SiteReportAttachedPhoto } from '@/features/site-report/lib/types'
import type { ArchivedDailyReportRow } from '@/features/supervisor/lib/daily-report-archive'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'

const t = getSiteSupervisorMessages('fa')

export function ArchiveA4Preview({
  row,
  projectName,
  photos = [],
}: {
  row: ArchivedDailyReportRow
  projectName?: string
  photos?: SiteReportAttachedPhoto[]
}) {
  const printRootId = useId().replace(/:/g, '')
  const [expanded, setExpanded] = useState(true)

  const report = lipartaReportFromArchive({
    projectName,
    reportNo: row.reportNo,
    reportDate: row.reportDate,
    note: row.note,
    structuredJson: row.structuredJson,
    weather: row.weather,
    statusLabel: 'archived',
  })

  function handlePrint() {
    setExpanded(true)
    window.setTimeout(() => window.print(), 250)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? (
            <ChevronUp className="h-4 w-4 ml-1" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" aria-hidden />
          )}
          {expanded ? t.archiveHideReport : t.archiveShowReport}
        </Button>
        <Button type="button" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 ml-1" aria-hidden />
          {t.archivePrintA4}
        </Button>
      </div>

      {expanded ? (
        <div
          id={`archive-print-${printRootId}`}
          className="archive-print-root overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none"
        >
          <PrintableDailyReport report={report} previewMode photos={photos} />
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 12mm; }
              body * { visibility: hidden !important; }
              #archive-print-${printRootId},
              #archive-print-${printRootId} * { visibility: visible !important; }
              #archive-print-${printRootId} {
                position: absolute !important;
                inset: 0 !important;
                width: 100% !important;
                max-height: none !important;
                overflow: visible !important;
                background: white !important;
              }
            }
          `,
        }}
      />
    </div>
  )
}
