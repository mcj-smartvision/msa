'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduleAlertSeverity } from '@/lib/schedule/float-alerts'
import type { ActiveScheduleAlertDto } from '@/lib/schedule/schedule-alerts-api'

const SEVERITY_STYLE: Record<
  ScheduleAlertSeverity,
  { label: string; className: string }
> = {
  negative: { label: 'منفی', className: 'bg-rose-100 text-rose-800 border-rose-200' },
  critical: { label: 'بحرانی', className: 'bg-red-100 text-red-800 border-red-200' },
  near_critical: { label: 'نزدیک‌بحرانی', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  fast_consumption: {
    label: 'مصرف سریع',
    className: 'bg-orange-100 text-orange-900 border-orange-200',
  },
  urgent: {
    label: 'فوری (پیشرفت)',
    className: 'bg-rose-200 text-rose-950 border-rose-400',
  },
}

export function ScheduleActiveAlertsPanel({
  projectId,
  refreshKey = 0,
}: {
  projectId: string
  refreshKey?: number
}) {
  const [alerts, setAlerts] = useState<ActiveScheduleAlertDto[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule/alerts?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'بارگذاری هشدارها ناموفق بود')
      setAlerts(data.alerts ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function acknowledge(alertId: string) {
    setBusyId(alertId)
    setError(null)
    try {
      const res = await fetch('/api/schedule/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, alertId, action: 'acknowledge' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'تأیید هشدار ناموفق بود')
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setBusyId(null)
    }
  }

  if (!projectId) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" dir="rtl" lang="fa">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          هشدارهای فعال
          {alerts.length > 0 ? (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
              {alerts.length}
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          بروزرسانی
        </button>
      </div>

      {error ? (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-800">{error}</div>
      ) : null}

      {loading && alerts.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">در حال بارگذاری…</p>
      ) : alerts.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">هشدار فعالی نیست.</p>
      ) : (
        <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.critical
            return (
              <li key={alert.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium',
                    style.className
                  )}
                >
                  {style.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 leading-relaxed">{alert.message}</p>
                  {alert.activityName ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">{alert.activityName}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busyId === alert.id}
                  onClick={() => void acknowledge(alert.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  title="تأیید / بستن"
                >
                  {busyId === alert.id ? (
                    '…'
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <X className="h-3.5 w-3.5 text-slate-400" />
                      بستن
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
