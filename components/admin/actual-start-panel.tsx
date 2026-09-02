'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScheduleDateInput } from '@/components/schedule/schedule-date-input'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { useLocale } from '@/components/i18n/locale-provider'
import type { ScheduleStartAnalysis } from '@/lib/schedule/apply-actual-start'
import type { ProjectTask } from '@/types/schedule'
import { CalendarClock, CheckCircle2, Loader2 } from 'lucide-react'

interface ActualStartPanelProps {
  projectId: string
  baselineStart: string | null
  actualStart: string | null
  taskCount: number
  disabled?: boolean
  onDraftChange?: (iso: string) => void
  onRescheduled: (payload: {
    tasks: ProjectTask[]
    actualStart: string
    analysis: ScheduleStartAnalysis
  }) => void
}

export function ActualStartPanel({
  projectId,
  baselineStart,
  actualStart: initialActualStart,
  taskCount,
  disabled,
  onDraftChange,
  onRescheduled,
}: ActualStartPanelProps) {
  const { locale } = useLocale()
  const fa = locale === 'fa'

  const defaultStart = initialActualStart ?? baselineStart ?? new Date().toISOString().slice(0, 10)
  const [actualStart, setActualStart] = useState(defaultStart)
  const [appliedStart, setAppliedStart] = useState<string | null>(initialActualStart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<ScheduleStartAnalysis | null>(null)

  useEffect(() => {
    setAppliedStart(initialActualStart)
    if (initialActualStart) {
      setActualStart(initialActualStart)
    } else if (baselineStart) {
      setActualStart(baselineStart)
      setLastSuccess(null)
      setError(null)
    }
  }, [initialActualStart, baselineStart])

  const handleDateChange = useCallback(
    (iso: string) => {
      setActualStart(iso)
      onDraftChange?.(iso)
    },
    [onDraftChange]
  )

  async function applyReschedule() {
    if (!actualStart) return
    setLoading(true)
    setError(null)

    try {
      const aligned = Boolean(baselineStart) && actualStart === baselineStart

      const response = await fetch('/api/schedule/apply-actual-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          aligned_with_baseline: aligned,
          actual_start_date: actualStart,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'زمان‌بندی مجدد ناموفق بود')

      const newStart = data.actual_start ?? actualStart
      setAppliedStart(newStart)
      setLastSuccess(data.analysis as ScheduleStartAnalysis)

      onRescheduled({
        tasks: data.tasks ?? [],
        actualStart: newStart,
        analysis: data.analysis,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'زمان‌بندی مجدد ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  const updatedCount = lastSuccess?.tasks_updated ?? 0
  const totalTasks = taskCount > 0 ? taskCount : updatedCount

  return (
    <Card className="border-primary/25 shadow-card">
      <CardHeader className="border-b bg-primary/5 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          {fa ? 'تاریخ شروع واقعی پروژه' : 'Actual Project Start Date'}
        </CardTitle>
        <CardDescription>
          {fa
            ? 'تاریخ جدید را وارد کنید: همهٔ تسک‌ها به‌اندازهٔ همان فاصله از baseline MSP جابه‌جا می‌شوند (بدون تغییر مدت).'
            : 'Enter the new start: every task shifts by the same day offset from the MSP baseline (durations unchanged).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          {baselineStart ? (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground mb-1">
                {fa ? 'Baseline MSP' : 'MSP baseline'}
              </p>
              <p className="font-medium tabular-nums">
                <FormattedDate value={baselineStart} />
              </p>
            </div>
          ) : null}

          {appliedStart ? (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground mb-1">
                {fa ? 'شروع واقعی فعال' : 'Active actual start'}
              </p>
              <p className="font-semibold text-primary tabular-nums">
                <FormattedDate value={appliedStart} />
              </p>
            </div>
          ) : null}

          <ScheduleDateInput
            id="actual-project-start"
            label={fa ? 'تاریخ شروع واقعی' : 'Actual start date'}
            valueIso={actualStart}
            onChangeIso={handleDateChange}
            className="min-w-[200px]"
            disabled={disabled || loading}
          />

          <Button type="button" disabled={disabled || loading || !actualStart} onClick={applyReschedule}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {fa ? 'در حال بازمحاسبه…' : 'Rescheduling…'}
              </>
            ) : fa ? (
              'بازمحاسبه سراسری'
            ) : (
              'Apply global reschedule'
            )}
          </Button>
        </div>

        {lastSuccess ? (
          <div
            role="status"
            className="text-sm text-emerald-800 flex flex-col gap-1 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3"
          >
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              {fa ? 'بازمحاسبه سراسری انجام شد' : 'Global reschedule completed'}
            </p>
            <p className="text-emerald-700 ps-6">
              {fa
                ? `${updatedCount} از ${totalTasks} تسک به‌روزرسانی شد · شروع جدید: `
                : `${updatedCount} of ${totalTasks} tasks updated · new start: `}
              <FormattedDate value={lastSuccess.actual_start} className="font-semibold" />
              {lastSuccess.delta_days != null ? (
                fa
                  ? ` · جابه‌جایی: ${lastSuccess.delta_days} روز`
                  : ` · shift: ${lastSuccess.delta_days} day(s)`
              ) : null}
              {lastSuccess.anchor_wbs ? (
                fa
                  ? ` · لنگر: WBS ${lastSuccess.anchor_wbs}`
                  : ` · anchor: WBS ${lastSuccess.anchor_wbs}`
              ) : null}
              {lastSuccess.baseline_backfilled
                ? fa
                  ? ` · ${lastSuccess.baseline_backfilled} baseline ذخیره شد`
                  : ` · ${lastSuccess.baseline_backfilled} baselines snapshotted`
                : null}
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
