'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WORKSHOP_UOM_LABELS, type WorkshopUom } from '@/lib/workshop/types'
import { cn } from '@/lib/utils'

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatQty(value: number): string {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function uomLabel(uom: string): string {
  return WORKSHOP_UOM_LABELS[uom as WorkshopUom] ?? uom
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
        return {
          ...activity,
          amount,
          progress,
          executed: amount * (progress / 100),
        }
      }),
    [activities]
  )

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
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-[11px] font-semibold text-white">
                <th className="px-3 py-2.5 text-center">WBS</th>
                <th className="px-3 py-2.5 text-right">شرح آیتم</th>
                <th className="px-3 py-2.5 text-center">مقدار</th>
                <th className="px-3 py-2.5 text-center">وضعیت مقدار</th>
                <th className="px-3 py-2.5 text-center">واحد</th>
                <th className="px-3 py-2.5 text-center">قیمت واحد</th>
                <th className="px-3 py-2.5 text-center">پیشرفت</th>
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
                  <td className="px-3 py-2.5 text-center text-slate-600">{uomLabel(row.uom)}</td>
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
                <td className="px-3 py-3 text-center text-[11px] font-medium text-slate-600">
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
