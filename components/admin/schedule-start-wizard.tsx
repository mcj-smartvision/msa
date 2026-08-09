'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScheduleDateInput } from '@/components/schedule/schedule-date-input'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { diffDaysIso } from '@/lib/schedule/dates'
import type { ScheduleStartAnalysis } from '@/lib/schedule/apply-actual-start'
import { useLocale } from '@/components/i18n/locale-provider'
import { CheckCircle2, Loader2, CalendarClock } from 'lucide-react'

interface ScheduleStartWizardProps {
  projectId: string
  baselineStart: string
  onComplete?: () => void
}

export function ScheduleStartWizard({ projectId, baselineStart, onComplete }: ScheduleStartWizardProps) {
  const router = useRouter()
  const { locale } = useLocale()
  const fa = locale === 'fa'

  const [step, setStep] = useState<'question' | 'date' | 'done'>('question')
  const [actualStart, setActualStart] = useState(baselineStart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ScheduleStartAnalysis | null>(null)

  useEffect(() => {
    setActualStart(baselineStart)
  }, [baselineStart])

  async function submit(aligned: boolean) {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/schedule/apply-actual-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          aligned_with_baseline: aligned,
          actual_start_date: aligned ? baselineStart : actualStart,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'اعمال تاریخ شروع ناموفق بود')

      setAnalysis(data.analysis)
      setStep('done')
      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ناموفق')
    } finally {
      setLoading(false)
    }
  }

  const dayDelta =
    step === 'date' && actualStart ? diffDaysIso(baselineStart, actualStart) : 0

  return (
    <Card className="border-primary/30 shadow-card">
      <CardHeader className="border-b bg-primary/5">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            {fa ? 'تأیید تاریخ شروع پروژه' : 'Confirm project start date'}
          </CardTitle>
          <CardDescription className="mt-1">
            {fa
              ? 'تاریخ شروع جدید را وارد کنید تا برنامه با مدت تسک‌ها و وابستگی‌ها دوباره محاسبه شود.'
              : 'Set the project start to rebuild all task dates from durations and dependencies.'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm">
          {fa ? 'شروع برنامه (baseline MSP):' : 'Schedule baseline start:'}{' '}
          <strong>
            <FormattedDate value={baselineStart} />
          </strong>
        </p>

        {step === 'question' ? (
          <div className="space-y-4">
            <p className="font-medium">
              {fa
                ? 'آیا شروع واقعی پروژه مطابق همین زمان‌بندی است؟'
                : 'Does the actual project start match this schedule?'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={loading} onClick={() => submit(true)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {fa ? 'بله — مطابق است' : 'Yes — matches baseline'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setStep('date')}
              >
                {fa ? 'خیر — تاریخ دیگر' : 'No — different date'}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'date' ? (
          <div className="space-y-4">
            <p className="font-medium">
              {fa ? 'تاریخ شروع واقعی پروژه را وارد کنید:' : 'Enter the actual project start date:'}
            </p>
            <ScheduleDateInput
              id="actual-start"
              valueIso={actualStart}
              onChangeIso={setActualStart}
              className="max-w-xs"
            />
            {dayDelta !== 0 ? (
              <p className="text-xs text-muted-foreground">
                {fa ? 'فاصله از baseline:' : 'Offset from baseline:'}{' '}
                {dayDelta > 0 ? '+' : ''}
                {dayDelta} {fa ? 'روز' : 'days'} —{' '}
                {fa ? 'برنامه با وابستگی‌ها بازمحاسبه می‌شود' : 'schedule will be rebuilt via dependencies'}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={loading || !actualStart} onClick={() => submit(false)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {fa ? 'بازمحاسبه و به‌روزرسانی برنامه' : 'Rebuild & update schedule'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep('question')}>
                {fa ? 'بازگشت' : 'Back'}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'done' && analysis ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-2">
            <p className="text-sm font-medium text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {fa ? 'برنامه بازمحاسبه شد' : 'Schedule rebuilt'}
            </p>
            <ul className="text-sm text-emerald-900/90 space-y-1">
              <li>
                {fa ? 'شروع واقعی:' : 'Actual start:'}{' '}
                <FormattedDate value={analysis.actual_start} />
              </li>
              <li>
                {fa ? 'تسک‌های به‌روز شده:' : 'Tasks updated:'} {analysis.tasks_updated}
                {analysis.rebuilt_from_dependencies
                  ? fa
                    ? ' (با وابستگی‌ها)'
                    : ' (with dependencies)'
                  : ''}
              </li>
              <li>
                {fa ? 'در جریان' : 'In progress'}: {analysis.tasks_in_progress} · {fa ? 'تمام' : 'Done'}:{' '}
                {analysis.tasks_completed} · {fa ? 'تأخیر' : 'Delayed'}: {analysis.tasks_delayed}
              </li>
              <li>
                {fa ? 'پیشرفت کل' : 'Overall progress'}: {analysis.overall_percent}%
              </li>
            </ul>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
