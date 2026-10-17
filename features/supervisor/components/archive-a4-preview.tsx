/**
 * @file features/supervisor/components/archive-a4-preview.tsx
 * @purpose پیش‌نمایش و چاپ A4 از گزارش آرشیو
 * @safe-to-edit YES
 * @affects صفحه آرشیو گزارش روزانه
 * @depends-on features/site-report/components/printable-daily-report, features/site-report/lib/report-from-archive
 */

'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { PrintableDailyReport } from '@/features/site-report/components/printable-daily-report'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import { lipartaReportFromArchive } from '@/features/site-report/lib/report-from-archive'
import type { ArchivedDailyReportRow } from '@/features/supervisor/lib/daily-report-archive'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'

const t = getSiteSupervisorMessages('fa')

export function ArchiveA4Preview({
  row,
  projectName,
}: {
  row: ArchivedDailyReportRow
  projectName?: string
}) {
  const [open, setOpen] = useState(false)

  const report = lipartaReportFromArchive({
    projectName,
    reportNo: row.reportNo,
    reportDate: row.reportDate,
    note: row.note,
    structuredJson: row.structuredJson,
    weather: row.weather,
    statusLabel: row.status,
  })

  function handlePrint() {
    setOpen(true)
    window.setTimeout(() => window.print(), 200)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {SITE_REPORT_COPY.printPreview}
        </Button>
        <Button type="button" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 ml-1" aria-hidden />
          {t.archivePrintA4}
        </Button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6 print:static print:bg-transparent print:p-0"
          role="dialog"
          aria-modal="true"
          aria-label={SITE_REPORT_COPY.printPreview}
          onClick={() => setOpen(false)}
        >
          <div
            className="my-4 w-full max-w-[220mm] rounded-xl border border-slate-300 bg-white shadow-xl print:my-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 print:hidden">
              <p className="text-sm font-semibold text-slate-800">
                {SITE_REPORT_COPY.printPreview} · {row.reportNo}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 ml-1" aria-hidden />
                  {t.archivePrintA4}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                  {SITE_REPORT_COPY.printClose}
                </Button>
              </div>
            </div>
            <div
              id={`archive-print-${row.id}`}
              className="archive-print-root max-h-[80vh] overflow-auto print:max-h-none"
            >
              <PrintableDailyReport report={report} previewMode />
            </div>
          </div>
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden !important; }
              .archive-print-root, .archive-print-root * { visibility: visible !important; }
              .archive-print-root {
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
    </>
  )
}
