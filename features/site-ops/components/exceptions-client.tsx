/**
 * @file features/site-ops/components/exceptions-client.tsx
 * @purpose کامپوننت UI — عملیات کارگاه، دستورکار و برنامه روزانه (exceptions-client)
 * @safe-to-edit CAREFUL
 * @affects عملیات کارگاه، دستورکار و برنامه روزانه
 * @depends-on shared/components/i18n/locale-provider, shared/lib/i18n/technical-office, features/site-ops/config
 */

'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getTechnicalOfficeMessages } from '@/shared/lib/i18n/technical-office'
import { SITE_OPS_COPY } from '@/features/site-ops/config'

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
      body: JSON.stringify({ note: SITE_OPS_COPY.acknowledgeNote }),
    })
    const body = await res.json()
    if (!res.ok) {
      setMessage(body.error || t.error)
      return
    }
    setMessage(t.saved)
    load()
  }

  if (!projectId) return <p className="text-sm text-muted-foreground">{SITE_OPS_COPY.pickProject}</p>
  if (!data) return <p className="text-sm text-muted-foreground">{t.loading}</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t.exceptions}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {SITE_OPS_COPY.exceptionsIntro}
        </p>
      </div>
      {message && <p className="text-sm">{message}</p>}

      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <h3 className="font-medium">{SITE_OPS_COPY.paymentRiskTitle}</h3>
        {(data.paymentRiskPackages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{SITE_OPS_COPY.noPaymentRisk}</p>
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
                    <p className="text-emerald-700 text-xs mt-1">{SITE_OPS_COPY.riskAcknowledged}</p>
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
        <h3 className="font-medium">{SITE_OPS_COPY.openBlockers}</h3>
        {(data.openBlockers ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{SITE_OPS_COPY.noOpenBlockers}</p>
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
