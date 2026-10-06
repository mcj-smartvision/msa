'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getSiteOpsMessages } from '@/shared/lib/i18n/site-ops'

export function CreRunsClient() {
  const { locale } = useLocale()
  const t = getSiteOpsMessages(locale)
  const projectId = useSearchParams().get('projectId') ?? ''
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!projectId) return
    void fetch(`/api/site-ops/cre-runs?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  async function onImportFile(file: File) {
    if (!projectId) return
    setBusy(true)
    setMessage(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/site-ops/cre-runs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, export: json }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.error)
      setMessage(t.success)
      load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.error)
    } finally {
      setBusy(false)
    }
  }

  async function importFixture(name: 'cre-control-ready.json' | 'cre-not-control-ready.json') {
    setBusy(true)
    setMessage(null)
    try {
      const seed = await fetch('/api/site-ops/cre-runs/import-fixture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, fixture: name }),
      })
      const data = await seed.json()
      if (!seed.ok) throw new Error(data.error || t.error)
      setMessage(t.success)
      load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.error)
    } finally {
      setBusy(false)
    }
  }

  const q = projectId ? `?projectId=${projectId}` : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
          {busy ? t.loading : t.importCre}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={busy || !projectId}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          disabled={busy || !projectId}
          onClick={() => void importFixture('cre-control-ready.json')}
        >
          Seed CONTROL_READY
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          disabled={busy || !projectId}
          onClick={() => void importFixture('cre-not-control-ready.json')}
        >
          Seed NOT_CONTROL_READY
        </button>
      </div>
      {message && <p className="text-sm text-slate-700">{message}</p>}
      {runs.length === 0 ? (
        <p className="text-sm text-slate-600">{t.noRuns}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-3">{t.gate}</th>
              <th className="py-2 pr-3">{t.score}</th>
              <th className="py-2 pr-3">{t.blockers}</th>
              <th className="py-2 pr-3">{t.forecast}</th>
              <th className="py-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={String(run.id)} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{String(run.gate)}</td>
                <td className="py-2 pr-3">{String(run.overall_score)}</td>
                <td className="py-2 pr-3">{String(run.blocker_count)}</td>
                <td className="py-2 pr-3">{String(run.forecast ?? '—')}</td>
                <td className="py-2">
                  <Link className="text-slate-900 underline" href={`/site-ops/cre-runs/${run.id}${q}`}>
                    {String(run.id).slice(0, 8)}…
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
