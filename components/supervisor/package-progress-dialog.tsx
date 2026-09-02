'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ModalOverlay } from '@/components/supervisor/modal-overlay'
import type { TodayActivity } from '@/lib/supervisor/types'
import type { SiteSupervisorMessages } from '@/lib/i18n/site-supervisor'
import { VoiceToTextButton } from '@/components/shared/voice-to-text-button'

interface PackageProgressDialogProps {
  open: boolean
  onClose: () => void
  activity: TodayActivity | null
  viewDate: string
  labels: SiteSupervisorMessages
  locale: 'fa' | 'en'
  onSaved: () => void
}

export function PackageProgressDialog({
  open,
  onClose,
  activity,
  viewDate,
  labels,
  locale,
  onSaved,
}: PackageProgressDialogProps) {
  const [progress, setProgress] = useState(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (activity) {
      setProgress(activity.actual_progress_percent)
      setNote('')
    }
    setError(null)
    setSuccess(false)
  }, [activity, open])

  if (!activity?.packageId) return null

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workshop/packages/${activity!.packageId}/supervisor-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: viewDate,
          progressPercent: progress,
          note: note.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || (locale === 'fa' ? 'ثبت نشد' : 'Failed to save'))
      }
      setSuccess(true)
      onSaved()
      setTimeout(() => onClose(), 600)
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === 'fa' ? 'خطا' : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const qtyLabel =
    activity.quantity != null && activity.uom
      ? `${activity.quantity} ${activity.uom}`
      : null

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title={labels.packageProgress}
      className="sm:max-w-lg"
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{activity.name}</p>
          {activity.location ? (
            <p className="text-xs text-muted-foreground mt-1">
              {labels.location}: {activity.location}
            </p>
          ) : null}
          {qtyLabel ? (
            <p className="text-xs text-muted-foreground">
              {labels.totalQuantity}: {qtyLabel}
            </p>
          ) : null}
          {activity.workshopNote ? (
            <p className="text-xs text-sky-800 mt-2 rounded-lg bg-sky-50 px-3 py-2">
              {labels.technicalOfficeNote}: {activity.workshopNote}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pkg-progress">{labels.actualProgress}</Label>
          <Input
            id="pkg-progress"
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="pkg-note">{labels.supervisorNote}</Label>
            <VoiceToTextButton
              onTranscript={(text) => setNote((prev) => (prev ? `${prev} ${text}` : text))}
            />
          </div>
          <Textarea
            id="pkg-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              locale === 'fa'
                ? 'توضیحات میدانی — با دکمه میکروفون صحبت کنید، AI به متن تبدیل می‌کند'
                : 'Field notes — use the mic button for voice-to-text'
            }
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? (
          <p className="text-sm text-emerald-700">
            {locale === 'fa' ? 'پیشرفت ثبت شد.' : 'Progress saved.'}
          </p>
        ) : null}

        <Button type="button" className="w-full" disabled={loading} onClick={() => void handleSave()}>
          {loading ? labels.saving : labels.saveProgress}
        </Button>
      </div>
    </ModalOverlay>
  )
}
