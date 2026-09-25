'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { UNASSIGNED_CONTRACTOR_ID } from '@/lib/finance/contractor-monthly-cost'
import { cn } from '@/lib/utils'

type Payload = {
  months: Array<{ key: string; label: string }>
  contractors: Array<{
    contractorId: string
    contractorName: string
    activityCount: number
    contractValue: number
    executed: number
    months: number[]
  }>
  monthTotals: number[]
  grandTotal: number
  contractValue: number
}

function toman(value: number, fa: boolean): string {
  const text = Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
  return fa ? `${text} تومان` : `${text} Toman`
}

export function ContractorWorkshopCosts({
  projectId,
  fa,
}: {
  projectId: string | null
  fa: boolean
}) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(
          `/api/finance/contractor-costs?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || (fa ? 'بارگذاری ناموفق بود' : 'Load failed'))
        if (!cancelled) setData(json as Payload)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, fa])

  const maxCell = useMemo(() => {
    if (!data) return 1
    return Math.max(1, ...data.contractors.flatMap((row) => row.months), ...data.monthTotals)
  }, [data])

  if (!projectId) {
    return (
      <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
        {fa ? 'ابتدا یک پروژه انتخاب کنید.' : 'Select a project first.'}
      </p>
    )
  }
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center rounded-2xl border bg-white p-10 text-slate-500">
        <Loader2 className="me-2 h-4 w-4 animate-spin" />
        {fa ? 'در حال محاسبه هزینه پیمانکاران…' : 'Calculating contractor costs…'}
      </div>
    )
  }
  if (error) {
    return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
  }
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-gradient-to-br from-white to-teal-50 p-4">
          <Users className="h-4 w-4 text-teal-700" />
          <p className="mt-2 text-[11px] text-slate-500">{fa ? 'کارکرد انجام‌شده' : 'Executed'}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{toman(data.grandTotal, fa)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-[11px] text-slate-500">{fa ? 'مبلغ قرارداد فعالیت‌ها' : 'Contract value'}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{toman(data.contractValue, fa)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-[11px] text-slate-500">{fa ? 'تعداد پیمانکاران' : 'Contractors'}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{data.contractors.length}</p>
        </div>
      </div>

      <div className="overflow-auto rounded-[28px] border bg-white shadow-sm">
        <table className="min-w-full text-[12px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="sticky start-0 bg-slate-100 px-3 py-2 text-start">{fa ? 'پیمانکار' : 'Contractor'}</th>
              {data.months.map((month) => (
                <th key={month.key} className="px-2 py-2 text-end font-medium">
                  {month.label}
                </th>
              ))}
              <th className="px-3 py-2 text-end">{fa ? 'جمع' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            {data.contractors.map((row) => (
              <tr key={row.contractorId} className="border-t">
                <td className="sticky start-0 bg-white px-3 py-2 font-medium">
                  {row.contractorId === UNASSIGNED_CONTRACTOR_ID
                    ? fa
                      ? 'بدون پیمانکار'
                      : 'Unassigned'
                    : row.contractorName}
                  <span className="ms-1 text-[10px] text-slate-400">({row.activityCount})</span>
                </td>
                {row.months.map((value, index) => (
                  <td
                    key={`${row.contractorId}-${index}`}
                    className={cn('px-2 py-2 text-end tabular-nums', value > 0 && 'font-medium')}
                    style={{
                      background:
                        value > 0
                          ? `rgba(13, 148, 136, ${0.08 + 0.35 * (value / maxCell)})`
                          : undefined,
                    }}
                  >
                    {value > 0 ? Math.round(value).toLocaleString('en-US') : '—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-end font-semibold tabular-nums">
                  {Math.round(row.executed).toLocaleString('en-US')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-slate-900 text-white">
              <td className="px-3 py-2 font-semibold">{fa ? 'جمع ماه' : 'Month total'}</td>
              {data.monthTotals.map((value, index) => (
                <td key={`t-${index}`} className="px-2 py-2 text-end tabular-nums">
                  {Math.round(value).toLocaleString('en-US')}
                </td>
              ))}
              <td className="px-3 py-2 text-end font-bold tabular-nums">
                {Math.round(data.grandTotal).toLocaleString('en-US')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
