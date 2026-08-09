'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Loader2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { CriticalBadge } from '@/components/schedule/task-status-badge'
import { useLocale } from '@/components/i18n/locale-provider'
import {
  buildPlanCompliance,
  type PlanComplianceRow,
} from '@/lib/project-manager/plan-compliance'
import { todayIso } from '@/lib/schedule/task-view-date'
import type { ProjectTask } from '@/types/schedule'
import { cn } from '@/lib/utils'

interface ScheduleCatchUpPanelProps {
  projectId: string
  tasks: ProjectTask[]
  actualStart: string | null
  onTasksUpdated: (tasks: ProjectTask[]) => void
}

type Mode = 'ask' | 'review' | 'done'

export function ScheduleCatchUpPanel({
  projectId,
  tasks,
  actualStart,
  onTasksUpdated,
}: ScheduleCatchUpPanelProps) {
  const { locale, dir } = useLocale()
  const fa = locale === 'fa' || locale === 'ar'
  const isRtl = dir === 'rtl'
  const asOf = todayIso()

  const compliance = useMemo(
    () => buildPlanCompliance(tasks, { actualStart, asOfDate: asOf }),
    [tasks, actualStart, asOf]
  )

  const [mode, setMode] = useState<Mode>('ask')
  const [draftPct, setDraftPct] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Reset wizard only when actual start changes (not after saving progress)
  useEffect(() => {
    setMode('ask')
    setSavedMsg(null)
    setError(null)
  }, [actualStart])

  const dueTaskKey = compliance.rows.map((r) => r.taskId).join('|')

  useEffect(() => {
    setDraftPct((prev) => {
      const next: Record<string, number> = { ...prev }
      for (const row of compliance.rows) {
        if (next[row.taskId] == null) next[row.taskId] = row.actualPercent
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when due task set identity changes
  }, [dueTaskKey])

  if (!compliance.shouldShowChecklist || compliance.rows.length === 0) {
    return null
  }

  // If everything already matches plan (±5%), show compact success instead of nagging
  const allAligned =
    compliance.behind === 0 &&
    compliance.notStarted === 0 &&
    compliance.rows.every((r) => Math.abs(r.actualPercent - r.plannedPercent) <= 5)

  async function saveUpdates(updates: { task_id: string; percent_complete: number }[]) {
    setSaving(true)
    setError(null)
    setSavedMsg(null)
    try {
      const response = await fetch('/api/schedule/catch-up-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, updates }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (fa ? 'ذخیره ناموفق بود' : 'Save failed'))
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        onTasksUpdated(data.tasks as ProjectTask[])
      }
      setMode('done')
      setSavedMsg(
        fa
          ? `پیشرفت ${data.updated} فعالیت ثبت شد. گزارش انطباق به‌روز شد.`
          : `Progress saved for ${data.updated} activities. Compliance report updated.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : fa ? 'ذخیره ناموفق بود' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function confirmOnPlan() {
    const updates = compliance.rows.map((row) => ({
      task_id: row.taskId,
      percent_complete: row.plannedPercent,
    }))
    void saveUpdates(updates)
  }

  function confirmCustom() {
    const updates = compliance.rows.map((row) => ({
      task_id: row.taskId,
      percent_complete: draftPct[row.taskId] ?? row.actualPercent,
    }))
    void saveUpdates(updates)
  }

  function markRowDone(row: PlanComplianceRow) {
    setDraftPct((prev) => ({ ...prev, [row.taskId]: 100 }))
  }

  function markRowAsPlanned(row: PlanComplianceRow) {
    setDraftPct((prev) => ({ ...prev, [row.taskId]: row.plannedPercent }))
  }

  function markRowZero(row: PlanComplianceRow) {
    setDraftPct((prev) => ({ ...prev, [row.taskId]: 0 }))
  }

  return (
    <Card
      className={cn(
        'border-amber-300/80 shadow-card overflow-hidden',
        isRtl && 'text-right'
      )}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <CardHeader className="border-b bg-gradient-to-l from-amber-50 via-orange-50/50 to-card">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-700" />
          {fa ? 'گزارش کارهای تا امروز' : 'Work-to-date catch-up report'}
        </CardTitle>
        <CardDescription className="leading-relaxed">
          {fa
            ? `شروع واقعی پروژه قبل از امروز است (${actualStart}). ${compliance.totalDue} فعالیت طبق برنامه باید تا امروز شروع یا پیشرفت کرده باشند — وضعیت را تأیید کنید.`
            : `Actual start is before today (${actualStart}). ${compliance.totalDue} activities should have progressed by today — confirm status.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">
            {fa ? 'انجام‌شده' : 'Done'}: {compliance.done}
          </Badge>
          <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200">
            {fa ? 'مطابق' : 'On track'}: {compliance.onTrack}
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200">
            {fa ? 'عقب' : 'Behind'}: {compliance.behind}
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
            {fa ? 'شروع‌نشده' : 'Not started'}: {compliance.notStarted}
          </Badge>
          <span className="text-muted-foreground self-center">
            {fa ? 'میانگین برنامه' : 'Avg plan'} {compliance.avgPlanned}% ·{' '}
            {fa ? 'واقعی' : 'actual'} {compliance.avgActual}%
          </span>
        </div>

        {allAligned && mode === 'ask' ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              {fa
                ? 'بر اساس پیشرفت ثبت‌شده، کارهای موعد تا امروز با برنامه هم‌خوان است. در صورت نیاز می‌توانید جزئیات را بازبینی کنید.'
                : 'Based on saved progress, due work looks aligned with the plan. You can still review details.'}
            </p>
          </div>
        ) : null}

        {mode === 'ask' ? (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <p className="font-semibold text-amber-950">
              {fa
                ? 'تا امروز کارها طبق برنامه انجام شده؟'
                : 'Was work completed according to the plan through today?'}
            </p>
            <p className="text-xs text-amber-900/80 leading-relaxed">
              {fa
                ? 'اگر «بله» بزنید، پیشرفت هر فعالیتِ موعد روی درصد برنامه‌ای تا امروز تنظیم می‌شود. اگر «خیر / گزارش دقیق» بزنید، ردیف‌به‌ردیف وضعیت را مشخص می‌کنید.'
                : '“Yes” sets each due activity to its planned % through today. “No / detailed report” lets you set each row.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving} onClick={confirmOnPlan}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Check className="h-4 w-4 me-1" />}
                {fa ? 'بله — طبق برنامه انجام شده' : 'Yes — on plan through today'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setMode('review')}
              >
                {fa ? 'خیر / گزارش دقیق فعالیت‌ها' : 'No / detailed activity report'}
              </Button>
            </div>
          </div>
        ) : null}

        {(mode === 'review' || mode === 'done' || (mode === 'ask' && allAligned)) && (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-3 py-2 text-start font-medium">WBS</th>
                  <th className="px-3 py-2 text-start font-medium min-w-[10rem]">
                    {fa ? 'فعالیت' : 'Activity'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium hidden md:table-cell">
                    {fa ? 'بازه' : 'Window'}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">{fa ? 'برنامه' : 'Plan'}</th>
                  <th className="px-3 py-2 text-end font-medium">{fa ? 'واقعی' : 'Actual'}</th>
                  {mode === 'review' ? (
                    <th className="px-3 py-2 text-end font-medium">{fa ? 'ثبت' : 'Set'}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {compliance.rows.map((row) => {
                  const value = draftPct[row.taskId] ?? row.actualPercent
                  const gap = value - row.plannedPercent
                  return (
                    <tr
                      key={row.taskId}
                      className={cn(
                        row.check === 'behind' && 'bg-red-50/40',
                        row.check === 'done' && 'bg-emerald-50/30'
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {row.wbs || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium leading-snug">{row.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {row.isCritical ? <CriticalBadge /> : null}
                          {row.check === 'behind' ? (
                            <Badge variant="destructive" className="text-[10px]">
                              {fa ? 'عقب' : 'Behind'}
                            </Badge>
                          ) : row.check === 'done' ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800">
                              {fa ? 'انجام' : 'Done'}
                            </Badge>
                          ) : row.check === 'not_started' ? (
                            <Badge variant="outline" className="text-[10px]">
                              {fa ? 'شروع‌نشده' : 'Not started'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              {fa ? 'مطابق' : 'On track'}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        <FormattedDate value={row.start} /> → <FormattedDate value={row.finish} />
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">{row.plannedPercent}%</td>
                      <td className="px-3 py-2 text-end tabular-nums font-semibold">
                        {mode === 'review' ? value : row.actualPercent}%
                        {mode !== 'review' && Math.abs(gap) > 5 ? (
                          <span
                            className={cn(
                              'block text-[10px] font-normal',
                              gap < 0 ? 'text-red-600' : 'text-emerald-600'
                            )}
                          >
                            {gap > 0 ? '+' : ''}
                            {gap}%
                          </span>
                        ) : null}
                      </td>
                      {mode === 'review' ? (
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-end gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={value}
                              onChange={(e) =>
                                setDraftPct((prev) => ({
                                  ...prev,
                                  [row.taskId]: Math.min(
                                    100,
                                    Math.max(0, Number(e.target.value) || 0)
                                  ),
                                }))
                              }
                              className="w-16 rounded border px-1.5 py-1 text-end text-xs tabular-nums"
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="text-[10px] text-sky-700 hover:underline"
                                onClick={() => markRowAsPlanned(row)}
                                title={fa ? 'طبق برنامه' : 'As planned'}
                              >
                                <Check className="h-3 w-3 inline" />
                              </button>
                              <button
                                type="button"
                                className="text-[10px] text-emerald-700 hover:underline"
                                onClick={() => markRowDone(row)}
                                title={fa ? '۱۰۰٪' : '100%'}
                              >
                                <CheckCircle2 className="h-3 w-3 inline" />
                              </button>
                              <button
                                type="button"
                                className="text-[10px] text-amber-700 hover:underline"
                                onClick={() => markRowZero(row)}
                                title={fa ? '۰٪' : '0%'}
                              >
                                <CircleDashed className="h-3 w-3 inline" />
                              </button>
                            </div>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {mode === 'review' ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={confirmCustom}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {fa ? 'ذخیره گزارش پیشرفت' : 'Save progress report'}
            </Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setMode('ask')}>
              <X className="h-4 w-4 me-1" />
              {fa ? 'بازگشت' : 'Back'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                const next: Record<string, number> = {}
                for (const row of compliance.rows) next[row.taskId] = row.plannedPercent
                setDraftPct(next)
              }}
            >
              {fa ? 'همه را طبق برنامه پر کن' : 'Fill all as planned'}
            </Button>
          </div>
        ) : null}

        {mode === 'ask' && allAligned ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setMode('review')}>
            {fa ? 'بازبینی و اصلاح پیشرفت' : 'Review & edit progress'}
          </Button>
        ) : null}

        {savedMsg ? (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 flex gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            {savedMsg}
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {fa
            ? 'این گزارش همان مبنای داشبورد مدیر پروژه برای شاخص انطباق و SPI است. بعد از ذخیره، وضعیت «تأخیر» در جدول برنامه بر اساس پیشرفت جدید به‌روز می‌شود.'
            : 'This report feeds the Project Manager compliance / SPI indicators. After save, Delay badges update from the new progress.'}
        </p>
      </CardContent>
    </Card>
  )
}
