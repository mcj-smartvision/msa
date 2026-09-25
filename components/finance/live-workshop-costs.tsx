'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, Timer, Wallet } from 'lucide-react'
import { loadOverheadMonthTotals } from '@/components/finance/overhead-costs-matrix'
import { deductedMonthFromLabel } from '@/lib/finance/overhead-schedule-months'
import {
  TOMAN_SCALE,
  buildLiveCostBreakdown,
  buildLiveWorkshopCostModel,
  type LiveCostBreakdownRow,
  type OverheadMonthAmount,
} from '@/lib/finance/live-workshop-cost'
import { cn } from '@/lib/utils'

type Payload = {
  asOfIso: string
  overheadExact: number
  overheadEstimated: number
  overhead: number
  contractor: number
  total: number
  breakdown?: LiveCostBreakdownRow[]
  activityCount: number
  monthLabels?: string[]
  monthAmounts?: number[]
}

function groupComma(value: number): string {
  return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function toman(value: number, fa: boolean): string {
  return fa ? `${groupComma(value)} تومان` : `${groupComma(value)} Toman`
}

function localOverheadMonths(projectId: string | null, fa: boolean): OverheadMonthAmount[] {
  const stored = loadOverheadMonthTotals(projectId, fa)
  const year =
    stored.labels.map((label) => String(label).match(/(13|14)\d{2}/)?.[0]).find(Boolean) ??
    null
  return stored.labels.flatMap((label, index) => {
    const month = deductedMonthFromLabel(label, index, year ? Number(year) : null)
    if (!month.startIso || !month.endIso) return []
    return [
      {
        startIso: month.startIso,
        endIso: month.endIso,
        label: month.label,
        amountToman: (stored.totals[index] ?? 0) * TOMAN_SCALE,
      },
    ]
  })
}

export function LiveWorkshopCosts({
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
          `/api/finance/live-costs?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || (fa ? 'بارگذاری ناموفق بود' : 'Load failed'))
        if (!cancelled) setData(json as Payload)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, fa])

  const merged = useMemo(() => {
    if (!data) return null
    const local = typeof window === 'undefined' ? [] : localOverheadMonths(projectId, fa)
    const localSum = local.reduce((sum, month) => sum + month.amountToman, 0)
    const apiSum = (data.monthAmounts ?? []).reduce((sum, value) => sum + value, 0)
    if (localSum > 0 && localSum !== apiSum) {
      const todayIso = data.asOfIso
      const model = buildLiveWorkshopCostModel({
        overheadMonths: local,
        activities: [],
        todayIso,
      })
      return {
        ...data,
        overheadExact: model.overheadExact,
        overheadEstimated: model.overheadEstimated,
        overhead: model.overhead,
        contractor: data.contractor,
        total: model.overhead + data.contractor,
        breakdown: buildLiveCostBreakdown(local, todayIso, data.contractor, data.activityCount),
      }
    }
    return data
  }, [data, fa, projectId])

  if (!projectId) {
    return (
      <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
        {fa ? 'ابتدا یک پروژه انتخاب کنید.' : 'Select a project first.'}
      </p>
    )
  }

  if (loading && !merged) {
    return (
      <div className="flex items-center justify-center rounded-2xl border bg-white p-10 text-slate-500">
        <Loader2 className="me-2 h-4 w-4 animate-spin" />
        {fa ? 'در حال محاسبه هزینه تا این لحظه…' : 'Calculating live cost…'}
      </div>
    )
  }

  if (error) {
    return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
  }

  if (!merged) return null

  const shareContractor = merged.total > 0 ? merged.contractor / merged.total : 0

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-orange-200">
          <Sparkles className="h-4 w-4" />
          <p className="text-[12px] font-medium">
            {fa ? 'کل هزینه کارگاه تا این لحظه' : 'Workshop cost incurred to date'}
          </p>
        </div>
        <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">{toman(merged.total, fa)}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[11px] text-slate-300">{fa ? 'بالاسری دقیق ماه‌های بسته' : 'Closed overhead'}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{toman(merged.overheadExact, fa)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="flex items-center gap-1 text-[11px] text-amber-200">
              <Timer className="h-3.5 w-3.5" />
              {fa ? 'برآورد این ماه' : 'Current month estimate'}
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">{toman(merged.overheadEstimated, fa)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[11px] text-teal-200">{fa ? 'سهم پیمانکاران' : 'Contractor share'}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{toman(merged.contractor, fa)}</p>
            <p className="mt-1 text-[11px] text-slate-300">
              {fa ? `${Math.round(shareContractor * 100)}٪` : `${Math.round(shareContractor * 100)}%`}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            {fa ? 'خلاصه هزینه‌های کارگاه' : 'Workshop cost summary'}
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">
            {fa
              ? 'هر ردیف می‌گوید این مبلغ از کجا آمده تا عدد بالای صفحه قابل ردگیری باشد.'
              : 'Each row shows where that amount comes from.'}
          </p>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-4 py-2.5 text-start font-semibold">{fa ? 'مورد' : 'Item'}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{fa ? 'منبع' : 'Source'}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{fa ? 'توضیح' : 'How'}</th>
                <th className="px-4 py-2.5 text-end font-semibold">{fa ? 'مبلغ' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {(merged.breakdown ?? []).map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t border-slate-100',
                    row.kind === 'overhead-estimate' && 'bg-amber-50/70',
                    row.kind === 'contractor' && 'bg-teal-50/50'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{row.title}</td>
                  <td className="px-4 py-3 text-slate-600">{row.source}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{row.note}</td>
                  <td className="px-4 py-3 text-end font-semibold tabular-nums text-slate-900">
                    {toman(row.amount, fa)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-800 bg-slate-900 text-white">
                <td className="px-4 py-3 font-semibold" colSpan={3}>
                  {fa ? 'جمع هزینه تا این لحظه' : 'Total incurred to date'}
                </td>
                <td className="px-4 py-3 text-end text-lg font-bold tabular-nums">
                  {toman(merged.total, fa)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
