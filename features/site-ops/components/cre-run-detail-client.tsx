'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getSiteOpsMessages } from '@/shared/lib/i18n/site-ops'
import { SiteOpsSummaryCards } from '@/features/site-ops/components/summary-cards'
import { FieldStateBadge } from '@/features/site-ops/components/field-state-badge'

export function CreRunDetailClient() {
  const { locale } = useLocale()
  const t = getSiteOpsMessages(locale)
  const params = useParams<{ id: string }>()
  const projectId = useSearchParams().get('projectId') ?? ''
  const router = useRouter()
  const [run, setRun] = useState<Record<string, unknown> | null>(null)
  const [forceReason, setForceReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    void fetch(`/api/site-ops/cre-runs/${params.id}`)
      .then((r) => r.json())
      .then((d) => setRun(d.run ?? null))
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  async function promote(force: boolean) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/site-ops/cre-runs/${params.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, forceReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.error)
      setMessage(`${t.success} (${data.snapshots?.length ?? 0})`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.error)
    } finally {
      setBusy(false)
    }
  }

  if (!run) return <p className="text-sm text-slate-600">{t.loading}</p>

  const summary = run.summary_json as {
    gate: string
    overall_score: number
    blocker_count: number
    forecast: string
    finding_codes?: string[]
    top_remediations?: string[]
  }
  const raw = run.raw_json as {
    control_ready_table?: {
      rows: Array<Record<string, unknown>>
    }
    findings?: Array<{ code: string; title?: string }>
  }
  const rows = raw.control_ready_table?.rows ?? []

  return (
    <div className="space-y-6">
      <SiteOpsSummaryCards
        gate={summary.gate}
        score={summary.overall_score}
        blockers={summary.blocker_count}
        forecast={summary.forecast}
        labels={{ gate: t.gate, score: t.score, blockers: t.blockers, forecast: t.forecast }}
      />

      {summary.gate === 'NOT_CONTROL_READY' && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium">{t.notReadyWarn}</p>
          <ul className="mt-2 list-disc ps-5">
            {(summary.finding_codes ?? []).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-2">{t.fixAndRerun}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void promote(false)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {t.promoteReady}
        </button>
        <div className="flex flex-col gap-1">
          <input
            className="min-w-[260px] rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={t.forceReason}
            value={forceReason}
            onChange={(e) => setForceReason(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !forceReason.trim()}
            onClick={() => void promote(true)}
            className="rounded-md border border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-950 disabled:opacity-50"
          >
            {t.forcePromote}
          </button>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          onClick={() =>
            router.push(`/site-ops/daily-plans?projectId=${projectId || String(run.project_id)}`)
          }
        >
          {t.generatePlan}
        </button>
      </div>
      {message && <p className="text-sm">{message}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-2">UID</th>
              <th className="py-2 pr-2">WBS</th>
              <th className="py-2 pr-2">نام</th>
              <th className="py-2 pr-2">{t.status}</th>
              <th className="py-2 pr-2">{t.quantity}</th>
              <th className="py-2 pr-2">UOM</th>
              <th className="py-2 pr-2">{t.crew}</th>
              <th className="py-2">PD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const qty = row.quantity as { value?: unknown; state?: string }
              const uom = row.quantity_uom as { value?: unknown; state?: string }
              const crew = row.crew_or_resource as { value?: unknown; state?: string }
              const pd = row.person_day as { value?: unknown; state?: string }
              return (
                <tr key={String(row.task_uid)} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2">{String(row.task_uid)}</td>
                  <td className="py-2 pr-2">{String(row.wbs ?? '')}</td>
                  <td className="py-2 pr-2">{String(row.name)}</td>
                  <td className="py-2 pr-2 font-medium">{String(row.readiness_row_status)}</td>
                  <td className="py-2 pr-2">
                    <div>{String(qty?.value ?? '—')}</div>
                    <FieldStateBadge state={qty?.state} />
                  </td>
                  <td className="py-2 pr-2">
                    <div>{String(uom?.value ?? '—')}</div>
                    <FieldStateBadge state={uom?.state} />
                  </td>
                  <td className="py-2 pr-2">
                    <div>{String(crew?.value ?? '—')}</div>
                    <FieldStateBadge state={crew?.state} />
                  </td>
                  <td className="py-2">
                    <div>{String(pd?.value ?? '—')}</div>
                    <FieldStateBadge state={pd?.state} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
