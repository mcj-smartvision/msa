'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getSiteOpsMessages } from '@/shared/lib/i18n/site-ops'
import { QtyWithUom } from '@/features/workshop/components/uom-display'

export function WorkOrderClient() {
  const { locale } = useLocale()
  const t = getSiteOpsMessages(locale)
  const params = useParams<{ id: string }>()
  const projectId = useSearchParams().get('projectId') ?? ''
  const [wo, setWo] = useState<Record<string, unknown> | null>(null)
  const [qty, setQty] = useState('')
  const [pd, setPd] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    void fetch(`/api/site-ops/work-orders/${params.id}`)
      .then((r) => r.json())
      .then((d) => setWo(d.workOrder ?? null))
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  async function submit() {
    setMessage(null)
    const res = await fetch(`/api/site-ops/work-orders/${params.id}/actuals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actualQuantity: Number(qty),
        actualPersonDays: Number(pd),
        evidenceNotes: notes,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || t.error)
      return
    }
    setMessage(t.success)
    load()
  }

  async function decide(actualId: string, approve: boolean) {
    const res = await fetch(`/api/site-ops/actuals/${actualId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || t.error)
      return
    }
    setMessage(t.success)
    load()
  }

  if (!wo) return <p className="text-sm text-slate-600">{t.loading}</p>

  const task = wo.site_ops_operational_tasks as { name?: string; task_uid?: number; uom_json?: { value?: unknown } }
  const plan = wo.site_ops_daily_plans as { status?: string; plan_date?: string }
  const actuals = (wo.site_ops_actual_entries as Array<Record<string, unknown>>) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {task?.task_uid} — {task?.name}
        </h2>
        <p className="text-sm text-slate-600">
          {t.planDate}: {String(plan?.plan_date)} · {t.status}: {String(wo.status)} · plan{' '}
          {String(plan?.status)}
        </p>
        <p className="text-sm text-slate-600">
          {t.planned}:{' '}
          <QtyWithUom
            qty={String(wo.planned_quantity)}
            uom={String(task?.uom_json?.value ?? '')}
          />{' '}
          /{' '}
          {String(wo.planned_person_days)} {t.personDays}
        </p>
      </div>

      <section className="space-y-3 rounded-md border border-slate-200 p-4">
        <h3 className="font-medium">{t.submitActual}</h3>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            {t.quantity}
            <input
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t.personDays}
            <input
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
              value={pd}
              onChange={(e) => setPd(e.target.value)}
            />
          </label>
          <label className="min-w-[220px] flex-1 text-sm">
            {t.notes}
            <input
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {t.submitActual}
        </button>
      </section>

      <section>
        <h3 className="mb-2 font-medium">{t.actual}</h3>
        <ul className="space-y-2 text-sm">
          {actuals.map((a) => (
            <li key={String(a.id)} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
              <span>
                {String(a.actual_quantity)} / {String(a.actual_person_days)} pd
              </span>
              <span className="font-medium">{String(a.status)}</span>
              {a.status === 'SUBMITTED' && (
                <>
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-2 py-1 text-white"
                    onClick={() => void decide(String(a.id), true)}
                  >
                    {t.approveActual}
                  </button>
                  <button
                    type="button"
                    className="rounded bg-rose-700 px-2 py-1 text-white"
                    onClick={() => void decide(String(a.id), false)}
                  >
                    {t.rejectActual}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
      {message && <p className="text-sm">{message}</p>}
      {projectId && <p className="sr-only">{projectId}</p>}
    </div>
  )
}
