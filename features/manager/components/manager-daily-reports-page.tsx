/**
 * @file features/manager/components/manager-daily-reports-page.tsx
 * @purpose مشاهده و تأیید گزارش روزانه توسط مدیر پروژه
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر — گزارش روزانه
 * @depends-on shared/hooks/use-synced-project-id, features/manager/lib/daily-reports-config, shared/components/ui/button, shared/components/ui/skeleton
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { MANAGER_DAILY_REPORTS_COPY as t } from '@/features/manager/lib/daily-reports-config'
import { cn } from '@/shared/lib/utils'

type ReportRow = {
  id: string
  reportNo: string | null
  reportDate: string
  workflowStatus: string
  notePreview: string
  approvedByManager?: boolean
}

export function ManagerDailyReportsPage({ initialProjectId }: { initialProjectId: string | null }) {
  const projectId = useSyncedProjectId(initialProjectId)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<ReportRow[]>([])
  const [recent, setRecent] = useState<ReportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) {
      setPending([])
      setRecent([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/manager/daily-reports?projectId=${encodeURIComponent(projectId)}`,
        { cache: 'no-store' }
      )
      const data = (await res.json().catch(() => ({}))) as {
        pending?: ReportRow[]
        recent?: ReportRow[]
        error?: string
        message?: string
      }
      if (!res.ok) throw new Error(data.message || data.error || t.loadFailed)
      setPending(Array.isArray(data.pending) ? data.pending : [])
      setRecent(Array.isArray(data.recent) ? data.recent : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadFailed)
      setPending([])
      setRecent([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function approveReport(reportId: string) {
    setApprovingId(reportId)
    setOkMsg(null)
    setError(null)
    try {
      const res = await fetch('/api/manager/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t.approveFailed)
      setOkMsg(t.approveOk)
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.approveFailed)
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100/80" dir="rtl" lang="fa">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 pb-12">
        <Button type="button" variant="ghost" size="sm" className="-mr-2 text-slate-600" asChild>
          <Link href="/dashboard/manager">
            <ArrowRight className="h-4 w-4 ml-1" aria-hidden />
            {t.backToManager}
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{t.hint}</p>
        </div>

        {!projectId ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-600">
            {t.selectProject}
          </p>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label={t.loading}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
            ) : null}
            {okMsg ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {okMsg}
              </p>
            ) : null}

            <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
              <h2 className="text-sm font-bold text-sky-950">{t.pendingTitle}</h2>
              {pending.length === 0 ? (
                <p className="text-xs text-sky-900/80">{t.emptyPending}</p>
              ) : (
                <ul className="space-y-2">
                  {pending.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 tabular-nums">
                          {row.reportDate}
                          {row.reportNo ? (
                            <span className="mr-2 font-mono text-xs font-normal text-slate-500">
                              · {row.reportNo}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                          {row.notePreview || t.noNote}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={approvingId === row.id}
                        onClick={() => void approveReport(row.id)}
                      >
                        {approvingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin ml-1" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 ml-1" aria-hidden />
                        )}
                        {t.approveCta}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800">{t.archiveTitle}</h2>
              {recent.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-600">
                  {t.emptyArchive}
                </p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((row) => {
                    const approved = row.workflowStatus === 'approved' || row.approvedByManager
                    return (
                      <li
                        key={row.id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 tabular-nums">
                            {row.reportDate}
                            {row.reportNo ? (
                              <span className="mr-2 font-mono text-xs font-normal text-slate-500">
                                · {row.reportNo}
                              </span>
                            ) : null}
                          </p>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              approved
                                ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                                : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                            )}
                          >
                            {approved ? t.statusApproved : t.statusSubmitted}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600">
                          {row.notePreview || t.noNote}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
