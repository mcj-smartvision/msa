/**
 * @file features/supervisor/components/daily-report-workflow-bar.tsx
 * @purpose دکمه‌های ثبت و تأیید نهایی / ارسال به مدیر
 * @safe-to-edit CAREFUL
 * @affects تب ثبت گزارش روزانه
 * @depends-on shared/components/ui/button, features/supervisor/lib/daily-report-workflow, shared/lib/i18n/site-supervisor
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  canSaveDailyReport,
  canSendDailyReportToManager,
  parseWorkflowStatus,
  type DailyReportWorkflowStatus,
} from '@/features/supervisor/lib/daily-report-workflow'
import { parseLipartaDailyReport } from '@/features/site-report/lib/parse-structured'
import { resolveDailyReportNote, siteReportHasContent } from '@/features/site-report/lib/report-content'
import type { LipartaDailyReportData } from '@/features/site-report/lib/types'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'
import { cn } from '@/shared/lib/utils'

const t = getSiteSupervisorMessages('fa')

export function DailyReportWorkflowBar({
  projectId,
  reportDate,
  note,
  weather,
  structured,
  onNoteLoaded,
  onStructuredLoaded,
  onReady,
  onSaved,
  onArchived,
  className,
}: {
  projectId: string
  reportDate: string
  note: string
  weather?: unknown
  structured?: LipartaDailyReportData | null
  /** Server draft note when opening an existing open draft */
  onNoteLoaded?: (note: string) => void
  onStructuredLoaded?: (report: LipartaDailyReportData | null) => void
  /** Always called when draft status fetch finishes (success or failure) */
  onReady?: () => void
  onSaved?: () => void
  /** After send-to-manager — parent clears form and opens a new blank report */
  onArchived?: (archivedReportDate: string) => void
  className?: string
}) {
  const [status, setStatus] = useState<DailyReportWorkflowStatus>('draft')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [busy, setBusy] = useState<'save' | 'send' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [sentToArchive, setSentToArchive] = useState(false)
  const onNoteLoadedRef = useRef(onNoteLoaded)
  const onStructuredLoadedRef = useRef(onStructuredLoaded)
  const onReadyRef = useRef(onReady)
  const onSavedRef = useRef(onSaved)
  const onArchivedRef = useRef(onArchived)
  const structuredRef = useRef(structured)
  const noteRef = useRef(note)
  const loadGen = useRef(0)

  useEffect(() => {
    onNoteLoadedRef.current = onNoteLoaded
  }, [onNoteLoaded])
  useEffect(() => {
    onStructuredLoadedRef.current = onStructuredLoaded
  }, [onStructuredLoaded])
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])
  useEffect(() => {
    onArchivedRef.current = onArchived
  }, [onArchived])
  // Keep refs in sync during render so Save/Send never races behind useEffect
  structuredRef.current = structured
  noteRef.current = note

  useEffect(() => {
    let cancelled = false
    const gen = ++loadGen.current
    setLoading(true)
    setError(null)
    setOkMsg(null)

    void (async () => {
      try {
        const res = await fetch(
          `/api/supervisor/daily-report-workflow?projectId=${encodeURIComponent(projectId)}`
        )
        const data = (await res.json()) as {
          workflowStatus?: string
          note?: string
          structuredJson?: unknown
          error?: string
          message?: string
        }
        if (cancelled || gen !== loadGen.current) return
        if (!res.ok) throw new Error(data.message || data.error || t.workflowLoadFailed)
        setStatus(parseWorkflowStatus(data.workflowStatus))
        onNoteLoadedRef.current?.(typeof data.note === 'string' ? data.note : '')
        onStructuredLoadedRef.current?.(parseLipartaDailyReport(data.structuredJson))
      } catch (e) {
        if (cancelled || gen !== loadGen.current) return
        setError(e instanceof Error ? e.message : t.workflowLoadFailed)
        setStatus('draft')
        onNoteLoadedRef.current?.('')
      } finally {
        if (!cancelled && gen === loadGen.current) {
          setLoading(false)
          onReadyRef.current?.()
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId])

  function hasPersistableContent(): boolean {
    const n = noteRef.current.replace(/\s+/g, ' ').trim()
    return n.length > 0 || siteReportHasContent(structuredRef.current)
  }

  async function run(action: 'save' | 'send_to_manager') {
    if (!hasPersistableContent()) {
      setOkMsg(null)
      setError(t.workflowContentRequired)
      return
    }
    setBusy(action === 'save' ? 'save' : 'send')
    setError(null)
    setOkMsg(null)
    setSentToArchive(false)
    try {
      const res = await fetch('/api/supervisor/daily-report-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          projectId,
          reportDate,
          note: resolveDailyReportNote(noteRef.current, structuredRef.current),
          weather: weather ?? null,
          structuredJson: structuredRef.current ?? null,
        }),
      })
      const data = (await res.json()) as {
        workflowStatus?: string
        reportDate?: string
        openNewDraft?: boolean
        error?: string
        message?: string
      }
      if (!res.ok) throw new Error(data.message || data.error || t.workflowActionFailed)

      if (action === 'send_to_manager' || data.openNewDraft) {
        setStatus('draft')
        setOkMsg(t.sendToManagerOk)
        setSentToArchive(true)
        onArchivedRef.current?.(data.reportDate || reportDate)
        router.push(
          `/dashboard/site-supervisor/daily-reports?projectId=${encodeURIComponent(projectId)}`
        )
      } else {
        setStatus(parseWorkflowStatus(data.workflowStatus))
        setOkMsg(t.saveDraftOk)
        setSentToArchive(false)
        onSavedRef.current?.()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.workflowActionFailed)
    } finally {
      setBusy(null)
    }
  }

  const showActions = canSaveDailyReport(status) && canSendDailyReportToManager(status)

  return (
    <div
      className={cn(
        'space-y-2 border-t border-slate-100 pt-3',
        'sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-2 bg-white/95 px-2 pb-2 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none lg:bottom-auto',
        className
      )}
    >
      <p className="text-[11px] text-slate-500">{t.workflowHint}</p>

      {showActions ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 bg-white sm:h-10"
            disabled={busy != null || loading}
            onClick={() => void run('save')}
          >
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            {t.saveDraftCta}
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 sm:h-10"
            disabled={busy != null || loading}
            onClick={() => void run('send_to_manager')}
          >
            {busy === 'send' ? (
              <Loader2 className="h-4 w-4 animate-spin ml-1" />
            ) : (
              <Send className="h-4 w-4 ml-1" aria-hidden />
            )}
            {t.sendToManagerCta}
          </Button>
        </div>
      ) : null}

      {okMsg ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-emerald-700">{okMsg}</p>
          {sentToArchive ? (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-emerald-800" asChild>
              <Link
                href={`/dashboard/site-supervisor/daily-reports?projectId=${encodeURIComponent(projectId)}`}
              >
                {t.workflowViewArchiveCta}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  )
}
