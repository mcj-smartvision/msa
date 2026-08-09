'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/components/i18n/locale-provider'
import { getTechnicalOfficeMessages } from '@/lib/i18n/technical-office'

export function ExceptionsClient() {
  const { locale } = useLocale()
  const t = getTechnicalOfficeMessages(locale)
  const projectId = useSearchParams().get('projectId') ?? ''
  const [data, setData] = useState<{
    paymentRiskPackages: Array<Record<string, unknown>>
    pendingApprovals: Array<Record<string, unknown>>
    openBlockers: Array<Record<string, unknown>>
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!projectId) return
    void fetch(`/api/site-ops/exceptions?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setMessage(d.error)
        else setData(d)
      })
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  async function acknowledge(id: string) {
    setMessage(null)
    const res = await fetch(`/api/site-ops/packages/${id}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'مدیر پروژه ریسک پرداخت/محدوده را تأیید کرد' }),
    })
    const body = await res.json()
    if (!res.ok) {
      setMessage(body.error || t.error)
      return
    }
    setMessage(t.saved)
    load()
  }

  if (!projectId) return <p className="text-sm text-muted-foreground">یک پروژه انتخاب کنید.</p>
  if (!data) return <p className="text-sm text-muted-foreground">{t.loading}</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t.exceptions}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          مدیر پروژه / کنترل پروژه — فقط شکاف‌های حساس مقدار/پرداخت را تأیید کنید.
        </p>
      </div>
      {message && <p className="text-sm">{message}</p>}

      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <h3 className="font-medium">ریسک پرداخت / مقدار</h3>
        {(data.paymentRiskPackages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">پرچم باز ریسک پرداخت وجود ندارد.</p>
        ) : (
          <ul className="space-y-2">
            {data.paymentRiskPackages.map((pkg) => (
              <li key={String(pkg.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{String(pkg.name)}</p>
                  <p className="text-amber-800">{String(pkg.payment_flag)}</p>
                  {pkg.payment_flag_reason ? (
                    <p className="text-muted-foreground mt-1">{String(pkg.payment_flag_reason)}</p>
                  ) : null}
                  {pkg.pm_risk_acknowledged ? (
                    <p className="text-emerald-700 text-xs mt-1">ریسک تأیید شد</p>
                  ) : null}
                </div>
                {!pkg.pm_risk_acknowledged && (
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-white"
                    onClick={() => void acknowledge(String(pkg.id))}
                  >
                    {t.acknowledge}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <h3 className="font-medium">موانع باز</h3>
        {(data.openBlockers ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">مانع بازی وجود ندارد.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.openBlockers.map((b) => {
              const task = b.site_ops_operational_tasks as { name?: string; task_uid?: number } | null
              return (
                <li key={String(b.id)} className="rounded-xl border px-3 py-2">
                  <span className="font-medium">
                    {task?.task_uid} — {task?.name}
                  </span>
                  <span className="ms-2 text-muted-foreground">{String(b.blocker_type)}</span>
                  <p className="mt-1">{String(b.note)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
