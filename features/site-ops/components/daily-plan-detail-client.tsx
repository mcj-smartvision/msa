'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getSiteOpsMessages } from '@/shared/lib/i18n/site-ops'

export function DailyPlanDetailClient() {
  const { locale } = useLocale()
  const t = getSiteOpsMessages(locale)
  const params = useParams<{ date: string }>()
  const projectId = useSearchParams().get('projectId') ?? ''
  const [bundle, setBundle] = useState<{
    plan: Record<string, unknown>
    workOrders: Array<Record<string, unknown>>
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!projectId) return
    void fetch(`/api/site-ops/daily-plans/by-date?projectId=${projectId}&date=${params.date}`)
      .then((r) => r.json())
      .then((d) => setBundle(d.bundle))
  }, [projectId, params.date])

  useEffect(() => {
    load()
  }, [load])

  async function issue() {
    if (!bundle?.plan?.id) return
    const res = await fetch(`/api/site-ops/daily-plans/${bundle.plan.id}/issue`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || t.error)
      return
    }
    setMessage(t.success)
    load()
  }

  if (!bundle) return <p className="text-sm text-slate-600">{t.loading}</p>

  const q = projectId ? `?projectId=${projectId}` : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {t.dailyPlans}: {String(bundle.plan.plan_date)}
          </h2>
          <p className="text-sm text-slate-600">
            {t.status}: {String(bundle.plan.status)} · {t.gate}:{' '}
            {String(bundle.plan.gate_at_issue ?? '—')}
          </p>
        </div>
        <div className="flex gap-2">
          {bundle.plan.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => void issue()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {t.issuePlan}
            </button>
          )}
          <Link
            href={`/site-ops/reports/daily?projectId=${projectId}&date=${params.date}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {t.dailyReport}
          </Link>
        </div>
      </div>
      {message && <p className="text-sm">{message}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2">{t.workOrders}</th>
            <th className="py-2">{t.planned}</th>
            <th className="py-2">{t.personDays}</th>
            <th className="py-2">{t.status}</th>
          </tr>
        </thead>
        <tbody>
          {bundle.workOrders.map((wo) => {
            const task = wo.site_ops_operational_tasks as { name?: string; task_uid?: number }
            return (
              <tr key={String(wo.id)} className="border-b border-slate-100">
                <td className="py-2">
                  <Link className="underline" href={`/site-ops/work-orders/${wo.id}${q}`}>
                    {task?.task_uid} — {task?.name}
                  </Link>
                </td>
                <td className="py-2">{String(wo.planned_quantity)}</td>
                <td className="py-2">{String(wo.planned_person_days)}</td>
                <td className="py-2">{String(wo.status)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
