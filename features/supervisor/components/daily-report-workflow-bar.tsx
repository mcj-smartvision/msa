/**
 * @file features/supervisor/components/daily-report-workflow-bar.tsx
 * @purpose دکمه‌های ثبت و تأیید نهایی / ارسال به مدیر
 * @safe-to-edit CAREFUL
 * @affects تب ثبت گزارش روزانه
 * @depends-on shared/components/ui/button, features/supervisor/lib/daily-report-workflow, shared/lib/i18n/site-supervisor
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  canSaveDailyReport,
  canSendDailyReportToManager,
  parseWorkflowStatus,
  type DailyReportWorkflowStatus,
} from '@/features/supervisor/lib/daily-report-workflow'
import { parseLipartaDailyReport } from '@/features/site-report/lib/parse-structured'
import { siteReportHasContent } from '@/features/site-report/lib/report-content'
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
  onSaved?: () => void
  /** After send-to-manager — parent clears form and opens a new blank report */
  onArchived?: (archivedReportDate: string) => void
  className?: string
}) {
  const [status, setStatus] = useState<DailyReportWorkflowStatus>('draft')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'save' | 'send' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const onNoteLoadedRef = useRef(onNoteLoaded)
  const onStructuredLoadedRef = useRef(onStructuredLoaded)
  const onSavedRef = useRef(onSaved)
  const onArchivedRef = useRef(onArchived)
  const loadGen = useRef(0)

  useEffect(() => {
    onNoteLoadedRef.current = onNoteLoaded
  }, [onNoteLoaded])
  useEffect(() => {
    onStructuredLoadedRef.current = onStructuredLoaded
  }, [onStructuredLoaded])
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])
  useEffect(() => {
    onArchivedRef.current = onArchived
  }, [onArchived])

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
      } finally {
        if (!cancelled && gen === loadGen.current) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId])

  async function run(action: 'save' | 'send_to_manager') {
    setBusy(action === 'save' ? 'save' : 'send')
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch('/api/supervisor/daily-report-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          projectId,
          reportDate,
          note,
          weather: weather ?? null,
          structuredJson: structured ?? null,
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
        onArchivedRef.current?.(data.reportDate || reportDate)
      } else {
        setStatus(parseWorkflowStatus(data.workflowStatus))
        setOkMsg(t.saveDraftOk)
        onSavedRef.current?.()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.workflowActionFailed)
    } finally {
      setBusy(null)
    }
  }

  const showActions = canSaveDailyReport(status) && canSendDailyReportToManager(status)
  const contentReady =
    note.replace(/\s+/g, ' ').trim().length > 0 || siteReportHasContent(structured)

  return (
    <div className={cn('space-y-2 border-t border-slate-100 pt-3', className)}>
      <p className="text-[11px] text-slate-500">{t.workflowHint}</p>

      {showActions ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1 bg-white"
            disabled={busy != null || loading || !contentReady}
            onClick={() => void run('save')}
          >
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            {t.saveDraftCta}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={busy != null || loading || !contentReady}
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

      {okMsg ? <p className="text-sm font-medium text-emerald-700">{okMsg}</p> : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  )
}
