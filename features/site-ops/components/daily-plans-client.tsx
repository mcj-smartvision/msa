'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getSiteOpsMessages } from '@/shared/lib/i18n/site-ops'

type OpsTask = {
  id: string
  task_uid: number
  name: string
  quantity_json: { value?: unknown }
  person_day_json: { value?: unknown }
  location_json: { value?: unknown }
  crew_resource_json: { value?: unknown }
}

export function DailyPlansClient() {
  const { locale } = useLocale()
  const t = getSiteOpsMessages(locale)
  const projectId = useSearchParams().get('projectId') ?? ''
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([])
  const [tasks, setTasks] = useState<OpsTask[]>([])
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [override, setOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [latestGate, setLatestGate] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!projectId) return
    void fetch(`/api/site-ops/daily-plans?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
    void fetch(`/api/site-ops/operational-tasks?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.tasks ?? []) as OpsTask[]
        setTasks(list)
        const init: Record<string, boolean> = {}
        for (const task of list) init[task.id] = true
        setSelected(init)
      })
    void fetch(`/api/site-ops/cre-runs?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => setLatestGate(d.runs?.[0]?.gate ?? null))
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  async function createPlan() {
    if (!projectId) return
    setMessage(null)
    const workOrders = tasks
      .filter((task) => selected[task.id])
      .map((task) => ({
        operationalTaskId: task.id,
        plannedQuantity: Number(task.quantity_json?.value ?? 0) || 0,
        plannedPersonDays: Number(task.person_day_json?.value ?? 0) || 0,
        location: task.location_json?.value != null ? String(task.location_json.value) : null,
        assignedCrewId: null as string | null,
      }))

    // Ensure crews exist for named resources (soft)
    for (const task of tasks.filter((x) => selected[x.id])) {
      const crewName = task.crew_resource_json?.value
      if (crewName != null && String(crewName).trim()) {
        await fetch('/api/site-ops/crews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, name: String(crewName) }),
        })
      }
    }

    const crewsRes = await fetch(`/api/site-ops/crews?projectId=${projectId}`)
    const crewsData = await crewsRes.json()
    const crews = (crewsData.crews ?? []) as Array<{ id: string; name: string }>

    for (const wo of workOrders) {
      const task = tasks.find((x) => x.id === wo.operationalTaskId)
      const name = task?.crew_resource_json?.value != null ? String(task.crew_resource_json.value) : ''
      const match = crews.find((c) => c.name === name)
      if (match) wo.assignedCrewId = match.id
    }

    const res = await fetch('/api/site-ops/daily-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        planDate,
        notes,
        allowNotReadyOverride: override,
        overrideReason,
        workOrders,
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

  const q = projectId ? `?projectId=${projectId}` : ''

  return (
    <div className="space-y-6">
      {latestGate === 'NOT_CONTROL_READY' && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium">{t.notReadyWarn}</p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            {t.forcePromote}
          </label>
          {override && (
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder={t.forceReason}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          )}
        </div>
      )}

      <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{t.newDailyPlan}</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-600">{t.emptyPromote}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                {t.planDate}
                <input
                  type="date"
                  className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                />
              </label>
              <label className="min-w-[240px] flex-1 text-sm">
                {t.notes}
                <input
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
            <ul className="divide-y rounded-md border border-slate-200 text-sm">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[task.id])}
                    onChange={(e) => setSelected((s) => ({ ...s, [task.id]: e.target.checked }))}
                  />
                  <span className="font-medium">{task.task_uid}</span>
                  <span className="flex-1">{task.name}</span>
                  <span className="text-slate-500">
                    qty {String(task.quantity_json?.value ?? 0)} / pd{' '}
                    {String(task.person_day_json?.value ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void createPlan()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {t.createPlan}
            </button>
          </>
        )}
        {message && <p className="text-sm">{message}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t.dailyPlans}</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noPlans}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">{t.planDate}</th>
                <th className="py-2">{t.status}</th>
                <th className="py-2">{t.gate}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={String(plan.id)} className="border-b border-slate-100">
                  <td className="py-2">
                    <Link
                      className="underline"
                      href={`/site-ops/daily-plans/${plan.plan_date}${q}`}
                    >
                      {String(plan.plan_date)}
                    </Link>
                  </td>
                  <td className="py-2">{String(plan.status)}</td>
                  <td className="py-2">{String(plan.gate_at_issue ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
