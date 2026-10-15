'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { UomStack } from '@/features/workshop/components/uom-display'
import { useProjectStore } from '@/features/project-store/use-project-store'
import { useProjectStoreSync } from '@/features/project-store/use-project-store-sync'
import { cn } from '@/shared/lib/utils'

/** Statement and reported physical progress may differ by less than this (percentage points). */
const PROGRESS_MISMATCH_POINTS = 1

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatQty(value: number): string {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

type ContractorActivity = {
  entityType: 'task' | 'package'
  entityId: string
  wbs: string | null
  title: string
  estimatedQty: number
  qtyKind: 'حدودی' | 'قطعی'
  uom: string
  unitPrice: number
  progressPercent: number
}

export function ContractorActivitiesPanel({
  projectId,
  contractorId,
  contractorName,
  onClose,
}: {
  projectId: string
  contractorId: string
  contractorName: string
  onClose: () => void
}) {
  useProjectStoreSync(projectId)
  const tasks = useProjectStore((s) => (s.snapshot?.projectId === projectId ? s.tasks : null))
  const [activities, setActivities] = useState<ContractorActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/schedule/contractor-activities?projectId=${encodeURIComponent(projectId)}&contractorId=${encodeURIComponent(contractorId)}`,
        { cache: 'no-store' }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'بارگذاری فعالیت‌ها ناموفق بود')
      setActivities((data.activities ?? []) as ContractorActivity[])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'بارگذاری فعالیت‌ها ناموفق بود')
    } finally {
      setLoading(false)
    }
  }, [contractorId, projectId])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(
    () =>
      activities.map((activity) => {
        const amount = (Number(activity.estimatedQty) || 0) * (Number(activity.unitPrice) || 0)
        const progress = Math.min(100, Math.max(0, Number(activity.progressPercent) || 0))
        const storeId = `${activity.entityType === 'task' ? 'schedule' : 'package'}:${activity.entityId}`
        const physical = tasks?.[storeId]?.actual_progress ?? null
        return {
          ...activity,
          amount,
          progress,
          physical,
          mismatch: physical != null && Math.abs(physical - progress) >= PROGRESS_MISMATCH_POINTS,
          executed: amount * (progress / 100),
        }
      }),
    [activities, tasks]
  )
  const mismatchCount = rows.filter((r) => r.mismatch).length

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          amount: sum.amount + row.amount,
          executed: sum.executed + row.executed,
        }),
        { amount: 0, executed: 0 }
      ),
    [rows]
  )

  return (
    <div
      className="mt-4 overflow-hidden rounded-2xl border border-orange-200/80 bg-white shadow-sm"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-orange-100 bg-gradient-to-l from-orange-50 to-white px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">فعالیت‌ها — {contractorName}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            فقط مشاهده — از برنامه زمان‌بندی؛ قابل ویرایش نیست
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="me-1 h-4 w-4" />
          بستن
        </Button>
      </div>

      {error ? <p className="mx-4 mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {!loading && mismatchCount > 0 ? (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          درصد صورت‌وضعیت {mismatchCount.toLocaleString('en-US')} فعالیت با پیشرفت فیزیکی گزارش روزانه فرق دارد. مبلغ کارکرد با همان درصد صورت‌وضعیت حساب
          می‌شود.
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بارگذاری فعالیت‌ها...
        </p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">
          فعالیت تخصیص‌یافته‌ای برای این پیمانکار وجود ندارد.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-[11px] font-semibold text-white">
                <th className="px-3 py-2.5 text-center">WBS</th>
                <th className="px-3 py-2.5 text-right">شرح آیتم</th>
                <th className="px-3 py-2.5 text-center">مقدار</th>
                <th className="px-3 py-2.5 text-center">وضعیت مقدار</th>
                <th className="px-3 py-2.5 text-center">واحد</th>
                <th className="px-3 py-2.5 text-center">قیمت واحد</th>
                <th className="px-3 py-2.5 text-center">پیشرفت صورت‌وضعیت</th>
                <th className="px-3 py-2.5 text-center" title="آخرین درصد تجمعی ثبت‌شدهٔ سرپرست کارگاه">
                  پیشرفت فیزیکی
                </th>
                <th className="px-3 py-2.5 text-center">کارکرد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.entityType}:${row.entityId}`}
                  className={cn(
                    'border-b border-slate-100',
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                  )}
                >
                  <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-slate-600">
                    {row.wbs || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-800">{row.title}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-700" dir="ltr">
                    {formatQty(row.estimatedQty)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        row.qtyKind === 'قطعی'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      )}
                    >
                      {row.qtyKind}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <UomStack uom={row.uom} />
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-700" dir="ltr">
                    {formatMoney(row.unitPrice)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="mx-auto flex w-28 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{ width: `${row.progress}%` }}
                        />
                      </div>
                      <span className="w-9 text-left text-[11px] tabular-nums text-slate-600" dir="ltr">
                        {row.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.physical == null ? (
                      <span className="text-[11px] text-slate-400">—</span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                          row.mismatch ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'
                        )}
                        title={row.mismatch ? 'با درصد صورت‌وضعیت فرق دارد' : undefined}
                        dir="ltr"
                      >
                        {row.mismatch ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
                        {Math.round(row.physical * 100) / 100}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-slate-800" dir="ltr">
                    {formatMoney(row.executed)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-orange-50 text-sm font-bold text-slate-900">
                <td className="px-3 py-3" colSpan={6}>
                  جمع
                </td>
                <td className="px-3 py-3 text-center text-[11px] font-medium text-slate-600" colSpan={2}>
                  مبلغ قرارداد {formatMoney(totals.amount)}
                </td>
                <td className="px-3 py-3 text-center tabular-nums" dir="ltr">
                  {formatMoney(totals.executed)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
