'use client'

import { useEffect, useMemo, useState } from 'react'
import {
Check,
CheckCircle2,
CircleDashed,
ClipboardList,
HelpCircle,
Loader2,
X,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { CriticalBadge } from '@/features/schedule/components/task-status-badge'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import {
buildPlanCompliance,
type PlanComplianceRow,
} from '@/features/project-manager/lib/plan-compliance'
import { applyWeightedParentRollup } from '@/features/schedule/lib/parent-progress-rollup'
import { todayIso } from '@/features/schedule/lib/task-view-date'
import { publishScheduleViewSync } from '@/features/schedule/lib/schedule-view-sync'
import type { ProjectTask } from '@/shared/types/schedule'
import { formatScheduleWeightDisplay } from '@/features/workshop/lib/package-weight'
import { cn } from '@/shared/lib/utils'

interface ScheduleCatchUpPanelProps {
  projectId: string
  tasks: ProjectTask[]
  actualStart: string | null
  scheduleVersion?: string | null
  onTasksUpdated: (tasks: ProjectTask[]) => void
}

type Mode = 'ask' | 'review' | 'done'

export function ScheduleCatchUpPanel({
  projectId,
  tasks,
  actualStart,
  scheduleVersion,
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
  const [helpParentId, setHelpParentId] = useState<string | null>(null)

  // Reset wizard when actual start or schedule import changes (new XML upload)
  useEffect(() => {
    setMode('ask')
    setDraftPct({})
    setSavedMsg(null)
    setError(null)
    setHelpParentId(null)
  }, [actualStart, scheduleVersion])

  const dueTaskKey = compliance.allRows.map((r) => r.taskId).join('|')

  useEffect(() => {
    setDraftPct((prev) => {
      const next: Record<string, number> = { ...prev }
      for (const row of compliance.allRows) {
        if (next[row.taskId] == null) next[row.taskId] = row.actualPercent
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when due task set identity changes
  }, [dueTaskKey])

  const editorRows = useMemo(
    () => (compliance.allRows.length > 0 ? compliance.allRows : compliance.rows),
    [compliance]
  )

  const rollup = useMemo(() => {
    const nodes = editorRows.map((row) => ({
      id: row.taskId,
      wbs: row.wbs,
      name: row.name,
      weight: row.scheduleWeight,
      percent: draftPct[row.taskId] ?? row.actualPercent,
    }))
    return applyWeightedParentRollup(nodes)
  }, [editorRows, draftPct])

  const allAligned =
    compliance.behind === 0 &&
    compliance.notStarted === 0 &&
    compliance.rows.every((r) => Math.abs(r.actualPercent - r.plannedPercent) <= 5)

  function displayPercent(row: PlanComplianceRow): number {
    return rollup.percents[row.taskId] ?? draftPct[row.taskId] ?? row.actualPercent
  }

  function isRolledParent(row: PlanComplianceRow): boolean {
    return rollup.parentIds.has(row.taskId)
  }

  if (!compliance.shouldShowChecklist || compliance.rows.length === 0) {
    return null
  }

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
      publishScheduleViewSync(projectId)
      setMode('done')
      setSavedMsg(
        fa
          ? `پیشرفت ${data.updated} فعالیت ثبت شد (درصد سرشاخه‌ها از وزن زیرشاخه‌ها حساب شد).`
          : `Progress saved for ${data.updated} activities (parents rolled up from children).`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : fa ? 'ذخیره ناموفق بود' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function buildRolledUpdates(sourcePct: Record<string, number>) {
    const nodes = editorRows.map((row) => ({
      id: row.taskId,
      wbs: row.wbs,
      name: row.name,
      weight: row.scheduleWeight,
      percent: sourcePct[row.taskId] ?? row.actualPercent,
    }))
    const rolled = applyWeightedParentRollup(nodes)
    return editorRows.map((row) => ({
      task_id: row.taskId,
      percent_complete: rolled.percents[row.taskId] ?? row.actualPercent,
    }))
  }

  function confirmOnPlan() {
    const planned: Record<string, number> = {}
    for (const row of editorRows) {
      // Only push planned onto leaves / non-parents; parents will roll up
      if (!rollup.parentIds.has(row.taskId)) {
        planned[row.taskId] = Math.round(row.plannedPercent)
      } else {
        planned[row.taskId] = draftPct[row.taskId] ?? row.actualPercent
      }
    }
    // For due rows that are leaves, use planned
    for (const row of compliance.rows) {
      if (!rollup.parentIds.has(row.taskId)) {
        planned[row.taskId] = Math.round(row.plannedPercent)
      }
    }
    void saveUpdates(buildRolledUpdates(planned))
  }

  function confirmCustom() {
    void saveUpdates(buildRolledUpdates(draftPct))
  }

  function setLeafPercent(row: PlanComplianceRow, next: number) {
    if (isRolledParent(row)) return
    setDraftPct((prev) => ({
      ...prev,
      [row.taskId]: Math.min(100, Math.max(0, Math.round(next))),
    }))
  }

  function markRowDone(row: PlanComplianceRow) {
    setLeafPercent(row, 100)
  }

  function markRowAsPlanned(row: PlanComplianceRow) {
    setLeafPercent(row, row.plannedPercent)
  }

  function markRowZero(row: PlanComplianceRow) {
    setLeafPercent(row, 0)
  }

  return (
    <Card
      className={cn(
        'border-amber-300/80 shadow-card',
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
          <Badge variant="outline" className="bg-orange-100 text-orange-950 border-orange-300">
            {fa ? 'تاریخ گذشته / ناتمام' : 'Past due / incomplete'}:{' '}
            {
              editorRows.filter(
                (r) => r.finish && asOf > r.finish && r.actualPercent < 100
              ).length
            }
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
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {fa
                ? `${editorRows.length} فعالیت — داخل کادر اسکرول کنید تا انتهای برنامه. ردیف‌های نارنجی: تاریخ پایان گذشته ولی هنوز ۱۰۰٪ نشده‌اند.`
                : `${editorRows.length} activities — scroll inside the list. Orange rows: finish date passed but still incomplete.`}
            </p>
          <div className="overflow-y-scroll overflow-x-auto rounded-xl border max-h-[min(62vh,560px)] [scrollbar-gutter:stable]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted text-muted-foreground shadow-sm">
                  <th className="px-3 py-2 text-start font-medium">WBS</th>
                  <th className="px-3 py-2 text-start font-medium min-w-[10rem]">
                    {fa ? 'فعالیت' : 'Activity'}
                  </th>
                  <th className="px-3 py-2 text-end font-medium whitespace-nowrap">
                    {fa ? 'وزن' : 'Weight'}
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
                {editorRows.map((row) => {
                  const value = displayPercent(row)
                  const parentLocked = isRolledParent(row)
                  const help = rollup.explanations.get(row.taskId)
                  const gap = value - row.plannedPercent
                  const isPastDueIncomplete =
                    Boolean(row.finish) && asOf > row.finish! && value < 100
                  return (
                    <tr
                      key={row.taskId}
                      className={cn(
                        'relative',
                        isPastDueIncomplete &&
                          'bg-orange-100/95 border-s-4 border-s-orange-500 hover:bg-orange-100',
                        !isPastDueIncomplete && row.check === 'behind' && 'bg-red-50/40',
                        !isPastDueIncomplete && row.check === 'done' && 'bg-emerald-50/30',
                        (row.isSummary || parentLocked) && 'bg-slate-50/80'
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {row.wbs || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div
                          className={cn(
                            'font-medium leading-snug',
                            (row.isSummary || parentLocked) && 'font-semibold text-slate-900'
                          )}
                          style={{ paddingInlineStart: Math.min(row.depth, 8) * 14 }}
                        >
                          {row.name}
                        </div>
                        <div
                          className="flex flex-wrap gap-1 mt-1"
                          style={{ paddingInlineStart: Math.min(row.depth, 8) * 14 }}
                        >
                          {row.isCritical ? <CriticalBadge /> : null}
                          {isPastDueIncomplete ? (
                            <Badge className="text-[10px] bg-orange-200 text-orange-950 border border-orange-400">
                              {fa ? 'تاریخ گذشته' : 'Past due'}
                            </Badge>
                          ) : null}
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
                      <td className="px-3 py-2 text-end tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                        {formatScheduleWeightDisplay(row.scheduleWeight)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        <FormattedDate value={row.start} /> → <FormattedDate value={row.finish} />
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">{Math.round(row.plannedPercent)}%</td>
                      <td className="px-3 py-2 text-end tabular-nums font-semibold">
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>{value}%</span>
                          {parentLocked && help ? (
                            <button
                              type="button"
                              className="rounded-full p-0.5 text-sky-700 hover:bg-sky-100"
                              title={fa ? 'نحوه محاسبه درصد سرشاخه' : 'How parent % is calculated'}
                              aria-label={fa ? 'نحوه محاسبه درصد سرشاخه' : 'How parent % is calculated'}
                              onClick={(e) => {
                                e.stopPropagation()
                                setHelpParentId((id) =>
                                  id === row.taskId ? null : row.taskId
                                )
                              }}
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                        {helpParentId === row.taskId && help ? (
                          <div
                            className="absolute z-20 mt-1 max-w-xs rounded-lg border border-sky-200 bg-white p-2.5 text-start text-[11px] font-normal leading-relaxed text-slate-800 shadow-lg"
                            style={{ insetInlineEnd: 8 }}
                            dir="rtl"
                          >
                            <pre className="whitespace-pre-wrap font-sans">{help.text}</pre>
                            <button
                              type="button"
                              className="mt-1 text-[10px] text-sky-700 hover:underline"
                              onClick={() => setHelpParentId(null)}
                            >
                              {fa ? 'بستن' : 'Close'}
                            </button>
                          </div>
                        ) : null}
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
                            {parentLocked ? (
                              <div
                                className="w-16 rounded border border-dashed border-slate-300 bg-slate-100 px-1.5 py-1 text-end text-xs tabular-nums text-slate-600"
                                title={
                                  fa
                                    ? 'از وزن زیرشاخه‌ها محاسبه می‌شود'
                                    : 'Calculated from children weights'
                                }
                              >
                                {value}
                              </div>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={value}
                                onChange={(e) =>
                                  setLeafPercent(row, Number(e.target.value) || 0)
                                }
                                className="w-16 rounded border px-1.5 py-1 text-end text-xs tabular-nums"
                              />
                            )}
                            {!parentLocked ? (
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
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                {fa ? 'خودکار از زیرشاخه' : 'Auto from children'}
                              </span>
                            )}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {mode === 'review' ? (
          <div className="flex flex-wrap gap-2 sticky bottom-0 z-10 -mx-1 px-1 py-2 bg-card border-t">
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
                setDraftPct((prev) => {
                  const next = { ...prev }
                  for (const row of editorRows) {
                    if (!rollup.parentIds.has(row.taskId)) {
                      next[row.taskId] = Math.round(row.plannedPercent)
                    }
                  }
                  return next
                })
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
