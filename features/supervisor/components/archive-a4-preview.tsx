/**
 * @file features/supervisor/components/archive-a4-preview.tsx
 * @purpose دکمه مشاهده / چاپ گزارش کامل A4 با عکس در آرشیو
 * @safe-to-edit YES
 * @affects صفحه آرشیو گزارش روزانه
 * @depends-on features/site-report/components/printable-daily-report, features/site-report/lib/report-from-archive
 */

'use client'

import { useEffect, useId, useState } from 'react'
import { Eye, Printer, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { PrintableDailyReport } from '@/features/site-report/components/printable-daily-report'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import { lipartaReportFromArchive } from '@/features/site-report/lib/report-from-archive'
import type { SiteReportAttachedPhoto } from '@/features/site-report/lib/types'
import type { ArchivedDailyReportRow } from '@/features/supervisor/lib/daily-report-archive'
import { siteSupervisorT } from '@/shared/lib/i18n/site-supervisor'

const t = siteSupervisorT

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
  const [open, setOpen] = useState(false)

  const report = lipartaReportFromArchive({
    projectName,
    reportNo: row.reportNo,
    reportDate: row.reportDate,
    note: row.note,
    structuredJson: row.structuredJson,
    weather: row.weather,
    statusLabel: 'archived',
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handlePrint() {
    setOpen(true)
    window.setTimeout(() => window.print(), 300)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" size="sm" className="min-h-10 flex-1 sm:flex-none" onClick={() => setOpen(true)}>
          <Eye className="h-4 w-4 ml-1" aria-hidden />
          {t.archiveViewA4WithPhotos}
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={handlePrint}>
          <Printer className="h-4 w-4 ml-1" aria-hidden />
          {t.archivePrintA4}
        </Button>
      </div>
      <p className="text-[11px] text-slate-500 print:hidden">{t.archiveA4Hint}</p>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/55 p-3 sm:p-6 print:static print:inset-auto print:bg-transparent print:p-0"
          role="dialog"
          aria-modal="true"
          aria-label={t.archiveViewA4WithPhotos}
          onClick={() => setOpen(false)}
        >
          <div
            className="my-4 w-full max-w-[220mm] rounded-xl border border-slate-300 bg-white shadow-xl print:my-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.archiveViewA4WithPhotos}</p>
                <p className="truncate font-mono text-[11px] text-slate-500">{row.reportNo}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 ml-1" aria-hidden />
                  {t.archivePrintA4}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4 ml-1" aria-hidden />
                  {SITE_REPORT_COPY.printClose}
                </Button>
              </div>
            </div>
            <div
              id={`archive-print-${printRootId}`}
              className="archive-print-root max-h-[80vh] overflow-auto print:max-h-none"
            >
              <PrintableDailyReport report={report} previewMode photos={photos} />
            </div>
          </div>
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
