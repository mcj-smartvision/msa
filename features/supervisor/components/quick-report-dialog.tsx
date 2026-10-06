'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { ModalOverlay } from '@/features/supervisor/components/modal-overlay'
import { AiDraftViewer } from '@/shared/components/common/ai-draft-viewer'
import type {
ActualStatus,
DailyReportInput,
PlannedStatus,
QualityStatus,
TodayActivity,
} from '@/features/supervisor/lib/types'
import type { SiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'
import { VoiceToTextButton } from '@/shared/components/common/voice-to-text-button'
import { getSupervisorRouteCopy } from '@/shared/lib/common/ai-action-routing'
import type { AiDraftLabels } from '@/shared/lib/common/ai-types'

interface QuickReportDialogProps {
  open: boolean
  onClose: () => void
  activity: TodayActivity | null
  projectId: string
  supervisorId: string
  viewDate: string
  labels: SiteSupervisorMessages
  locale: 'fa' | 'en'
  onSubmit: (input: DailyReportInput) => Promise<{ summaryText: string; reportId: string }>
  onApproveReport: (reportId: string, text: string) => Promise<void>
  onRejectReport: (reportId: string) => Promise<void>
}

export function QuickReportDialog({
  open,
  onClose,
  activity,
  projectId,
  supervisorId,
  viewDate,
  labels,
  locale,
  onSubmit,
  onApproveReport,
  onRejectReport,
}: QuickReportDialogProps) {
  const [shift, setShift] = useState<'morning' | 'evening' | 'night'>('morning')
  const [progress, setProgress] = useState(0)
  const [actualStatus, setActualStatus] = useState<ActualStatus>('started')
  const [quality, setQuality] = useState<QualityStatus>('good')
  const [issueNote, setIssueNote] = useState('')
  const [supervisorNote, setSupervisorNote] = useState('')
  const [hseIncident, setHseIncident] = useState(false)
  const [hseDesc, setHseDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [summaryText, setSummaryText] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (activity) {
      setProgress(activity.actual_progress_percent)
      setActualStatus(activity.actual_status)
    }
    setSummaryText(null)
    setReportId(null)
    setError(null)
  }, [activity, open])

  if (!activity) return null

  const reportLabels: AiDraftLabels = (() => {
    const route = getSupervisorRouteCopy('daily_report', locale)
    return {
      draftByAi: labels.draftByAi,
      confirmed: labels.confirmed,
      approveSend: route.approveSend,
      editText: labels.editText,
      reject: labels.reject,
      regenerate: labels.regenerate,
      saving: labels.saving,
      whatIsThis: route.whatIsThis,
      destinationHint: route.destinationHint,
    }
  })()

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const input: DailyReportInput = {
        date: viewDate,
        shift,
        siteId: projectId,
        supervisorId,
        activities: [
          {
            scheduleActivityId: activity!.id,
            plannedStatus: activity!.planned_status as PlannedStatus,
            actualStatus,
            actualProgressPercent: progress,
            qualityStatus: quality,
            issues: issueNote.trim()
              ? [{ type: 'other', description: issueNote.trim() }]
              : [],
          },
        ],
        resourcesSummary: { materialAlerts: [] },
        hse: { hasIncident: hseIncident, description: hseDesc || undefined },
        supervisorNote: supervisorNote || undefined,
      }
      const result = await onSubmit(input)
      setSummaryText(result.summaryText)
      setReportId(result.reportId)
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === 'fa' ? 'ناموفق بود' : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} title={labels.quickReport} className="sm:max-w-xl">
      {!summaryText ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">{activity.name}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{labels.shift}</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as typeof shift)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{labels.morning}</SelectItem>
                  <SelectItem value="evening">{labels.evening}</SelectItem>
                  <SelectItem value="night">{labels.night}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="progress">{labels.actualProgress}</Label>
                <VoiceToTextButton
                  onTranscript={(text) => {
                    const match = text.match(/(\d{1,3})\s*%?/)
                    if (match) setProgress(Math.min(100, Number(match[1])))
                    setSupervisorNote((prev) => (prev ? `${prev} ${text}` : text))
                  }}
                />
              </div>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{locale === 'fa' ? 'وضعیت' : 'Status'}</Label>
              <Select value={actualStatus} onValueChange={(v) => setActualStatus(v as ActualStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notStarted">{locale === 'fa' ? 'شروع نشده' : 'Not started'}</SelectItem>
                  <SelectItem value="started">{locale === 'fa' ? 'شروع شده' : 'Started'}</SelectItem>
                  <SelectItem value="finished">{locale === 'fa' ? 'تمام شده' : 'Finished'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{labels.quality}</Label>
              <Select value={quality} onValueChange={(v) => setQuality(v as QualityStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">{labels.good}</SelectItem>
                  <SelectItem value="acceptable">{labels.acceptable}</SelectItem>
                  <SelectItem value="problematic">{labels.problematic}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="issue">{labels.issueNote}</Label>
              <VoiceToTextButton
                onTranscript={(text) => setIssueNote((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
            <Textarea id="issue" rows={2} value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="note">{labels.supervisorNote}</Label>
              <VoiceToTextButton
                onTranscript={(text) =>
                  setSupervisorNote((prev) => (prev ? `${prev} ${text}` : text))
                }
              />
            </div>
            <Textarea id="note" rows={2} value={supervisorNote} onChange={(e) => setSupervisorNote(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hseIncident} onChange={(e) => setHseIncident(e.target.checked)} />
            {labels.hseIncident}
          </label>
          {hseIncident ? (
            <Textarea
              rows={2}
              value={hseDesc}
              onChange={(e) => setHseDesc(e.target.value)}
              placeholder={locale === 'fa' ? 'جزئیات HSE' : 'HSE details'}
            />
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="button" className="w-full" disabled={loading} onClick={() => void handleGenerate()}>
            {loading ? labels.saving : labels.submitReport}
          </Button>
        </div>
      ) : (
        <AiDraftViewer
          text={summaryText}
          status="draft_by_ai"
          labels={reportLabels}
          loading={loading}
          onApprove={async (text) => {
            if (!reportId) return
            setLoading(true)
            try {
              await onApproveReport(reportId, text)
              onClose()
            } finally {
              setLoading(false)
            }
          }}
          onReject={async () => {
            if (!reportId) return
            setLoading(true)
            try {
              await onRejectReport(reportId)
              setSummaryText(null)
              setReportId(null)
            } finally {
              setLoading(false)
            }
          }}
        />
      )}
    </ModalOverlay>
  )
}
