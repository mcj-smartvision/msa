'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getSiteOpsMessages } from '@/shared/lib/i18n/site-ops'
import { SiteOpsSummaryCards } from '@/features/site-ops/components/summary-cards'

export function SiteOpsOverviewClient() {
  const { locale } = useLocale()
  const t = getSiteOpsMessages(locale)
  const projectId = useSearchParams().get('projectId') ?? ''
  const [latest, setLatest] = useState<{
    gate: string
    overall_score: number
    blocker_count: number
    forecast: string | null
    id: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    void fetch(`/api/site-ops/cre-runs?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => setLatest(d.runs?.[0] ?? null))
      .catch(() => setError(t.error))
  }, [projectId, t.error])

  const q = projectId ? `?projectId=${projectId}` : ''

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {latest ? (
        <SiteOpsSummaryCards
          gate={latest.gate}
          score={latest.overall_score}
          blockers={latest.blocker_count}
          forecast={latest.forecast ?? '—'}
          labels={{ gate: t.gate, score: t.score, blockers: t.blockers, forecast: t.forecast }}
        />
      ) : (
        <p className="text-sm text-slate-600">{t.noRuns}</p>
      )}

      {latest?.gate === 'NOT_CONTROL_READY' && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">{t.notReadyWarn}</p>
          <p className="mt-1">{t.fixAndRerun}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/site-ops/cre-runs${q}`}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {t.importCre}
        </Link>
        <Link
          href={`/site-ops/daily-plans${q}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {t.newDailyPlan}
        </Link>
        {latest && (
          <Link
            href={`/site-ops/cre-runs/${latest.id}${q}`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {t.creRuns}
          </Link>
        )}
      </div>
    </div>
  )
}
