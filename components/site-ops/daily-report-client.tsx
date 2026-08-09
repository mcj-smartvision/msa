'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale } from '@/components/i18n/locale-provider'
import { getSiteOpsMessages } from '@/lib/i18n/site-ops'
import { SiteOpsSummaryCards } from '@/components/site-ops/summary-cards'

export function DailyReportClient() {
  const { locale } = useLocale()
  const t = getSiteOpsMessages(locale)
  const search = useSearchParams()
  const projectId = search.get('projectId') ?? ''
  const [date, setDate] = useState(search.get('date') ?? new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !date) return
    setError(null)
    void fetch(`/api/site-ops/reports/daily?projectId=${projectId}&date=${date}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || t.error)
        setReport(d.report)
      })
      .catch((e) => {
        setReport(null)
        setError(e instanceof Error ? e.message : t.error)
      })
  }, [projectId, date, t.error])

  const totals = (report?.totals ?? null) as {
    plannedQuantity?: number
    actualQuantity?: number
    plannedPersonDays?: number
    actualPersonDays?: number
    productivity?: number | null
  } | null
  const lines = (report?.lines as Array<Record<string, unknown>>) ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          {t.planDate}
          <input
            type="date"
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {projectId && date && (
          <a
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            href={`/api/site-ops/reports/daily?projectId=${projectId}&date=${date}&format=csv`}
          >
            {t.exportCsv}
          </a>
        )}
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      {report && (
        <>
          <SiteOpsSummaryCards
            gate={String(report.gate ?? '—')}
            score={totals?.productivity != null ? Number(totals.productivity).toFixed(2) : '—'}
            blockers={lines.filter((l) => (l.constraints as string[] | undefined)?.length).length}
            forecast={String(report.planStatus ?? '—')}
            labels={{
              gate: t.gate,
              score: t.productivity,
              blockers: t.blockers,
              forecast: t.status,
            }}
          />
          <p className="text-sm text-slate-600">{String(report.note)}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">فعالیت</th>
                <th className="py-2">{t.planned}</th>
                <th className="py-2">{t.actual}</th>
                <th className="py-2">{t.variance}</th>
                <th className="py-2">{t.productivity}</th>
                <th className="py-2">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={String(line.workOrderId)} className="border-b border-slate-100">
                  <td className="py-2">
                    {String(line.taskUid)} — {String(line.taskName)}
                  </td>
                  <td className="py-2">
                    {String(line.plannedQuantity)} / {String(line.plannedPersonDays)} pd
                  </td>
                  <td className="py-2">
                    {String(line.actualQuantity)} / {String(line.actualPersonDays)} pd
                  </td>
                  <td className="py-2">
                    {String(line.qty_variance)} / {String(line.pd_variance)}
                  </td>
                  <td className="py-2">
                    {line.productivity != null ? Number(line.productivity).toFixed(2) : '—'}
                  </td>
                  <td className="py-2">{String(line.actualStatus ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
