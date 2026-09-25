'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WORKSHOP_UOMS, WORKSHOP_UOM_LABELS } from '@/lib/workshop/types'

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
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

type Draft = {
  estimatedQty: string
  qtyKind: 'حدودی' | 'قطعی'
  uom: string
  unitPrice: string
  progressPercent: string
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
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
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
      const next = (data.activities ?? []) as ContractorActivity[]
      setActivities(next)
      setDrafts(
        Object.fromEntries(
          next.map((activity) => [
            `${activity.entityType}:${activity.entityId}`,
            {
              estimatedQty: String(activity.estimatedQty),
              qtyKind: activity.qtyKind,
              uom: activity.uom,
              unitPrice: String(activity.unitPrice),
              progressPercent: String(activity.progressPercent),
            },
          ])
        )
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'بارگذاری فعالیت‌ها ناموفق بود')
    } finally {
      setLoading(false)
    }
  }, [contractorId, projectId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(
    () =>
      activities.reduce(
        (sum, activity) => {
          const draft = drafts[`${activity.entityType}:${activity.entityId}`]
          const qty = Number(draft?.estimatedQty ?? activity.estimatedQty) || 0
          const price = Number(draft?.unitPrice ?? activity.unitPrice) || 0
          const progress = Number(draft?.progressPercent ?? activity.progressPercent) || 0
          return {
            amount: sum.amount + qty * price,
            executed: sum.executed + qty * price * (progress / 100),
          }
        },
        { amount: 0, executed: 0 }
      ),
    [activities, drafts]
  )

  async function save(activity: ContractorActivity) {
    const key = `${activity.entityType}:${activity.entityId}`
    const draft = drafts[key]
    if (!draft) return
    setSavingId(key)
    setError(null)
    try {
      const response = await fetch('/api/schedule/contractor-activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          contractorId,
          entityType: activity.entityType,
          entityId: activity.entityId,
          estimatedQty: Number(draft.estimatedQty),
          qtyKind: draft.qtyKind,
          uom: draft.uom,
          unitPrice: Number(draft.unitPrice),
          progressPercent: Number(draft.progressPercent),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره فعالیت ناموفق بود')
      const next = (data.activities ?? []) as ContractorActivity[]
      setActivities(next)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ذخیره فعالیت ناموفق بود')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-orange-200 bg-white p-4" dir="rtl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">فعالیت‌ها و صورت‌وضعیت — {contractorName}</h3>
          <p className="text-xs text-muted-foreground">
            فعالیت‌های نهایی برنامه زمان‌بندی که پیمانکار مستقیم یا ارثی آن‌هاست
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="me-1 h-4 w-4" />
          بستن
        </Button>
      </div>

      {error ? <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بارگذاری فعالیت‌ها...
        </p>
      ) : activities.length === 0 ? (
        <p className="rounded-lg border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          فعالیت تخصیص‌یافته‌ای برای این پیمانکار وجود ندارد.
        </p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => {
            const key = `${activity.entityType}:${activity.entityId}`
            const draft = drafts[key]
            if (!draft) return null
            const executed =
              (Number(draft.estimatedQty) || 0) *
              (Number(draft.unitPrice) || 0) *
              ((Number(draft.progressPercent) || 0) / 100)
            const setDraft = (patch: Partial<Draft>) =>
              setDrafts((current) => ({
                ...current,
                [key]: { ...draft, ...patch },
              }))
            return (
              <div key={key} className="rounded-lg border bg-background p-2.5">
                <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
                  <div className="min-w-[14rem] flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">شرح آیتم</Label>
                    <Input
                      className="h-9 min-w-[14rem]"
                      value={`${activity.wbs ? `${activity.wbs} — ` : ''}${activity.title}`}
                      readOnly
                    />
                  </div>
                  <div className="w-[13rem] shrink-0 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">مقدار</Label>
                    <div dir="ltr" className="flex h-9 overflow-hidden rounded-md border border-input">
                      <select
                        value={draft.qtyKind}
                        onChange={(event) =>
                          setDraft({ qtyKind: event.target.value as Draft['qtyKind'] })
                        }
                        className="w-[4.75rem] border-0 border-r border-input bg-muted/40 px-1 text-[11px]"
                      >
                        <option value="حدودی">حدودی</option>
                        <option value="قطعی">قطعی</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={draft.estimatedQty}
                        onChange={(event) => setDraft({ estimatedQty: event.target.value })}
                        className="min-w-0 flex-1 border-0 px-2 text-sm outline-none"
                      />
                      <select
                        value={draft.uom}
                        onChange={(event) => setDraft({ uom: event.target.value })}
                        className="w-[5rem] border-0 border-l border-input bg-muted/40 px-1 text-[11px]"
                      >
                        {WORKSHOP_UOMS.map((option) => (
                          <option key={option} value={option}>
                            {WORKSHOP_UOM_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="w-[8rem] shrink-0 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">قیمت واحد</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min="0"
                      step="1"
                      dir="ltr"
                      value={draft.unitPrice}
                      onChange={(event) => setDraft({ unitPrice: event.target.value })}
                    />
                  </div>
                  <div className="w-[5rem] shrink-0 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">درصد پیشرفت</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      dir="ltr"
                      value={draft.progressPercent}
                      onChange={(event) => setDraft({ progressPercent: event.target.value })}
                    />
                  </div>
                  <div className="w-[9rem] shrink-0 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {draft.qtyKind === 'قطعی' ? 'مبلغ قطعی' : 'مبلغ حدودی'}
                    </Label>
                    <Input
                      className="h-9 tabular-nums"
                      readOnly
                      dir="ltr"
                      value={formatMoney(executed)}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      disabled={savingId === key}
                      onClick={() => void save(activity)}
                    >
                      <Pencil className="me-1 h-3.5 w-3.5" />
                      ویرایش
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9"
                      disabled={savingId === key}
                      onClick={() => void save(activity)}
                    >
                      {savingId === key ? (
                        <Loader2 className="me-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="me-1 h-4 w-4" />
                      )}
                      ذخیره
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
            <span>جمع مبلغ: {formatMoney(totals.amount)}</span>
            <span>جمع کارکرد: {formatMoney(totals.executed)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
