/**
 * @file features/supervisor/components/daily-report-background-panel.tsx
 * @purpose کامپوننت UI — سرپرست کارگاه و گزارش روزانه (daily-report-background-panel)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on shared/components/ui/button, shared/components/ui/input, shared/components/ui/skeleton, features/schedule/hooks/use-schedule-calendar, features/schedule/lib/dates, features/schedule/lib/parent-progress-rollup, features/holidays/lib/work-calendar, features/supervisor/lib/daily-report-activities, features/project-store/use-project-store, features/project-store/use-project-store-sync
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { formatScheduleDate } from '@/features/schedule/lib/dates'
import { applyWeightedParentRollup } from '@/features/schedule/lib/parent-progress-rollup'
import { holidaysOn, siteWorkCalendar } from '@/features/holidays/lib/work-calendar'
import {
buildDailyReportActivitiesFromTree,
type DailyProgressEntry,
} from '@/features/supervisor/lib/daily-report-activities'
import { useProjectStore } from '@/features/project-store/use-project-store'
import { useProjectStoreSync } from '@/features/project-store/use-project-store-sync'
import {
buildProgressLedgerRows,
clipLedgerDays,
forecastShift,
ledgerDateRange,
segmentedPlannedProgress,
startDelay,
type PlannedDay,
type ProgressLedgerRow,
} from '@/features/supervisor/lib/progress-ledger'
import {
groupWindows,
windowSegments,
} from '@/features/schedule/lib/week-commitment-windows'
import {
calendarDays,
checkPercentEntry,
cumulativeBefore,
cumulativeOnOrBefore,
isDistinctProgressPoint,
mergeProgressHistory,
reportedDays,
type ReportedDayProgress,
} from '@/features/supervisor/lib/weekly-activity-progress'
import { cn } from '@/shared/lib/utils'
import { CalcTraceProvider, CalcTraceTrigger } from '@/features/calc-trace/components/calc-trace'
import type { CalcTraceMap } from '@/features/calc-trace/lib/types'
import { activityProgressTrace, weightRollupTrace } from '@/features/supervisor/lib/supervisor-traces'
import { SUPERVISOR_COPY, SUPERVISOR_PUNCT } from '@/features/supervisor/config'
import { siteSupervisorT } from '@/shared/lib/i18n/site-supervisor'

const t = siteSupervisorT

function weekdayShort() {
  return [t.tinySat, t.tinySun, t.tinyMon, t.tinyTue, t.tinyWed, t.tinyThu, t.tinyFri]
}
const NAME_COL = 280
const TOTAL_COL = 64

const faNum = (n: number) => n.toLocaleString('fa-IR-u-nu-latn')
const NO_DRAFTS: Record<string, number | null> = {}
/** 0 = Saturday … 6 = Friday. */
const siteWeekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 1) % 7

/** Approved schedule window of this row only — never inherited from a parent. */
function schedulePlanWindow(
  row: Pick<ProgressLedgerRow, 'hasOwnWindow' | 'approvedStartDate' | 'approvedFinishDate' | 'startDate' | 'finishDate'>
): { start: string; finish: string } | null {
  if (!row.hasOwnWindow) return null
  const start = row.approvedStartDate ?? row.startDate
  const finish = row.approvedFinishDate ?? row.finishDate
  if (!start || !finish) return null
  return { start, finish }
}

function monthDayLabel(iso: string, calendar: Parameters<typeof formatScheduleDate>[1]) {
  const parts = formatScheduleDate(iso, calendar).split(/[/-]/)
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : parts.join('/')
}

function PlanBar({ isStart, isFinish }: { isStart: boolean; isFinish: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0.5 h-1.5 bg-sky-500',
        isStart && 'right-0.5 rounded-r-sm',
        isFinish && 'left-0.5 rounded-l-sm'
      )}
    />
  )
}

function previousPoint(cells: Map<string, ReportedDayProgress> | undefined, date: string): ReportedDayProgress | undefined {
  if (!cells) return undefined
  let previous: ReportedDayProgress | undefined
  for (const point of cells.values()) {
    if (point.date >= date) break
    previous = point
  }
  return previous
}

function parseDraft(raw: string): number | null {
  const ascii = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String(SUPERVISOR_PUNCT.persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(SUPERVISOR_PUNCT.arabicDigits.indexOf(d)))
    .replace(/[٫,]/g, '.')
  if (ascii === '' || !/^-?\d+(\.\d+)?$/.test(ascii)) return null
  return Number(ascii)
}

/** Imported names often start with their own WBS (in Persian digits). */
const nameHasWbs = (name: string, wbs: string) =>
  name
    .replace(/[۰-۹]/g, (d) => String(SUPERVISOR_PUNCT.persianDigits.indexOf(d)))
    .trim()
    .startsWith(wbs)

/**
 * Every daily-report percent of the project on one sheet: the latest schedule's rows against each
 * calendar day from the first to the last project day. A cell is that day's progress and can be edited.
 */
export function DailyReportBackgroundPanel({ projectId, isAdmin = false }: { projectId: string | null; isAdmin?: boolean }) {
  const { calendar } = useScheduleCalendar()
  useProjectStoreSync(projectId)
  const snapshot = useProjectStore((s) => (s.snapshot?.projectId === projectId ? s.snapshot : null))
  const localEntries = useProjectStore((s) => s.localEntries)
  /** Saved history with the store's drafts applied: the same entries every view shows. */
  const preview = useProjectStore((s) => s.entries)
  const drafts = useProjectStore((s) => (projectId ? s.draftsByProject[projectId] : undefined)) ?? NO_DRAFTS
  const today = useProjectStore((s) => s.today)
  const loading = useProjectStore((s) => s.status === 'loading')
  const saving = useProjectStore((s) => s.syncing)
  const storeError = useProjectStore((s) => s.error)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ activityId: string; date: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [showFullRange, setShowFullRange] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledToToday = useRef(false)

  const tree = snapshot?.tree ?? null
  const forecastWindows = useMemo(() => groupWindows(snapshot?.windows ?? []), [snapshot])
  const holidays = useMemo(() => snapshot?.holidays ?? [], [snapshot])

  const activities = useMemo(
    () => (tree ? buildDailyReportActivitiesFromTree(tree.nodes, tree.orphanPackages) : []),
    [tree]
  )
  const baselineOf = useMemo(() => new Map(activities.map((a) => [a.id, a.baselinePercentComplete ?? 0])), [activities])
  const rows = useMemo(
    () => (tree ? buildProgressLedgerRows(tree.nodes, tree.orphanPackages, activities) : []),
    [tree, activities]
  )
  const history = useMemo(() => mergeProgressHistory(snapshot?.history ?? [], localEntries), [snapshot, localEntries])

  const cellsOf = useCallback(
    (source: DailyProgressEntry[]) => {
      const out = new Map<string, Map<string, ReportedDayProgress>>()
      for (const row of rows) {
        if (!row.activityId) continue
        const days = reportedDays(row.activityId, source, baselineOf.get(row.activityId) ?? 0)
        out.set(row.activityId, new Map(days.map((d) => [d.date, d])))
      }
      return out
    },
    [rows, baselineOf]
  )
  const savedCells = useMemo(() => cellsOf(history), [cellsOf, history])
  const cellsByActivity = useMemo(() => cellsOf(preview), [cellsOf, preview])
  const draftCount = Object.keys(drafts).length

  useEffect(() => {
    if (draftCount === 0) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draftCount])

  const isWorkday = useMemo(() => siteWorkCalendar(holidays), [holidays])

  /**
   * Required progress of each activity on working days (Friday and registered holidays off): each day
   * follows that day's forecast window, and the approved plan before the forecast windows begin.
   */
  const plannedByActivity = useMemo(() => {
    const out = new Map<string, Map<string, PlannedDay>>()
    for (const row of rows) {
      if (!row.activityId || !row.hasOwnWindow) continue
      const approved = { start: row.approvedStartDate, finish: row.approvedFinishDate }
      out.set(row.activityId, segmentedPlannedProgress(windowSegments(forecastWindows, row.activityId, approved), isWorkday))
    }
    return out
  }, [rows, forecastWindows, isWorkday])

  /** From the project's scheduled start to its scheduled finish, widened to cover reports and today. */
  const days = useMemo(() => {
    const reported = preview.filter((e) => e.percentComplete > 0).map((e) => e.reportDate)
    const range = ledgerDateRange(rows, [today, ...reported])
    const all = range ? calendarDays(range.from, range.to) : []
    return clipLedgerDays(all, today, showFullRange)
  }, [rows, preview, today, showFullRange])

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.wbs ?? '').toLowerCase().includes(q))
  }, [rows, query])

  /**
   * Heading rows show Σ(weight × child%) / Σ(weight) of their schedule children, using the
   * live cumulative of each reported activity (drafts included), like the schedule editor.
   * The stored percent of a heading is not refreshed when its children are reported.
   */
  const { headingPercents, headingExplanations } = useMemo(() => {
    const scheduleRows = rows.filter((r) => !r.key.startsWith('package:') && r.wbs)
    const rollup = applyWeightedParentRollup(
      scheduleRows.map((r) => {
        let percent = r.schedulePercent ?? 0
        if (r.activityId) {
          const last = [...(cellsByActivity.get(r.activityId)?.values() ?? [])].at(-1)
          percent = last?.cumulative ?? baselineOf.get(r.activityId) ?? 0
        }
        return { id: r.key, wbs: r.wbs, name: r.name, weight: r.scheduleWeight, percent }
      })
    )
    const out = new Map<string, number>()
    for (const key of rollup.parentIds) out.set(key, rollup.percents[key]!)
    return { headingPercents: out, headingExplanations: rollup.explanations }
  }, [rows, cellsByActivity, baselineOf])

  /** «موشن حساب» of each row, built from the data already on screen; only for system admins. */
  const traces = useMemo<CalcTraceMap | null>(() => {
    if (!isAdmin) return null
    const out: CalcTraceMap = {}
    const draftKeys = Object.keys(drafts)
    for (const row of rows) {
      if (row.activityId) {
        const cells = cellsByActivity.get(row.activityId)
        const trace = activityProgressTrace({
          row: { ...row, activityId: row.activityId },
          days: cells ? [...cells.values()] : [],
          baseline: baselineOf.get(row.activityId) ?? 0,
          plannedToday: plannedByActivity.get(row.activityId)?.get(today)?.cumulative ?? null,
          unsavedDrafts: draftKeys.filter((k) => k.startsWith(`${row.activityId}@`)).length,
        })
        out[trace.metric] = trace
      } else {
        const explanation = headingExplanations.get(row.key)
        if (!explanation) continue
        const trace = weightRollupTrace(row, explanation)
        out[trace.metric] = trace
      }
    }
    return out
  }, [isAdmin, rows, cellsByActivity, baselineOf, plannedByActivity, today, drafts, headingExplanations])

  useEffect(() => {
    scrolledToToday.current = false
  }, [showFullRange, projectId])

  useEffect(() => {
    if (scrolledToToday.current || days.length === 0) return
    const cell = scrollRef.current?.querySelector('[data-today]')
    if (!cell) return
    cell.scrollIntoView({ inline: 'center', block: 'nearest' })
    scrolledToToday.current = true
  }, [days])

  function cumulativeOf(activityId: string): number {
    const cells = cellsByActivity.get(activityId)
    const last = cells ? [...cells.values()].at(-1) : undefined
    return last?.cumulative ?? baselineOf.get(activityId) ?? 0
  }

  function startEdit(event: MouseEvent<HTMLTableSectionElement>) {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!cell || saving) return
    const activityId = cell.dataset.act!
    const date = cell.dataset.date!
    if (editing?.activityId === activityId && editing.date === date) return
    const cumulative =
      cellsByActivity.get(activityId)?.get(date)?.cumulative ??
      cumulativeOnOrBefore(activityId, preview, date, baselineOf.get(activityId) ?? 0)
    setDraft(cumulative == null ? '' : String(cumulative))
    setEditing({ activityId, date })
  }

  /** Keeps the typed value as a store draft; nothing is saved until «ذخیره». */
  function commitCell() {
    if (!editing) return
    const { activityId, date } = editing
    const value = parseDraft(draft)
    if (value == null ? draft.trim() !== '' : checkPercentEntry(value, null).error != null) return
    setEditing(null)
    const store = useProjectStore.getState()
    if (value == null) store.removeDailyLog(activityId, date)
    else store.updateTaskProgress(activityId, value, date)
  }

  async function saveAll() {
    if (!projectId || saving || draftCount === 0) return
    setError(null)
    setSavedMsg(null)
    try {
      const { saved } = await useProjectStore.getState().syncWithDatabase()
      setSavedMsg(t.savedChanges(faNum(saved)))
    } catch (e) {
      setError(e instanceof Error ? e.message : t.saveFailed)
    }
  }

  const shownError = error ?? storeError

  if (!projectId) return <p className="text-sm text-muted-foreground">{t.selectProjectFirst}</p>
  if (!tree) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t.loadingScheduleReports}>
        {shownError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{shownError}</p> : null}
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  const draftValue = parseDraft(draft)
  const draftCheck =
    editing == null || draftValue == null
      ? null
      : checkPercentEntry(
          draftValue,
          cumulativeBefore(editing.activityId, preview, editing.date, baselineOf.get(editing.activityId) ?? 0)
        )
  const draftInvalid = editing != null && draft.trim() !== '' && (draftValue == null || draftCheck?.error != null)
  const draftMessage =
    editing == null || draft.trim() === ''
      ? null
      : draftValue == null
        ? t.enterValidNumber
        : draftCheck?.error === 'max'
          ? t.percentMax
          : draftCheck?.error === 'min'
            ? t.percentMin
            : draftCheck?.decrease
              ? t.decreaseWarning
              : null
  return (
    <CalcTraceProvider traces={traces ?? undefined}>
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">{t.backgroundTitle}</h2>
          <p className="text-xs leading-5 text-slate-500">
            {t.backgroundHint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading || saving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchWbsName}
            className="h-9 w-52 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setShowFullRange((v) => !v)}
          >
            {showFullRange ? t.nearRange : t.fullRange}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={saving || draftCount === 0}
            onClick={() => useProjectStore.getState().discardDrafts()}
          >
            {t.discardChanges}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={saving || draftCount === 0}
            onClick={() => void saveAll()}
          >
            {saving ? t.saving : draftCount ? t.saveChangesCount(faNum(draftCount)) : t.saveChanges}
          </Button>
        </div>
      </div>

      {shownError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{shownError}</p> : null}
      {savedMsg && draftCount === 0 ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{savedMsg}</p>
      ) : null}

      <div ref={scrollRef} className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="border-separate border-spacing-0 text-[11px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                className="sticky right-0 z-30 border-b border-l border-slate-200 bg-slate-100 px-2 py-1.5 text-right font-semibold text-slate-700"
                style={{ minWidth: NAME_COL, maxWidth: NAME_COL }}
              >
                {t.activityLatestSchedule}
              </th>
              <th
                className="sticky z-30 border-b border-l border-slate-200 bg-slate-100 px-1 py-1.5 text-center font-semibold text-slate-700"
                style={{ right: NAME_COL, minWidth: TOTAL_COL }}
              >
                {t.cumulativeShort}
              </th>
              {days.map((d) => {
                const wd = siteWeekday(d)
                const label = formatScheduleDate(d, calendar).split(/[/-]/)
                const holidayTitles = holidaysOn(holidays, d).map((h) => h.title)
                return (
                  <th
                    key={d}
                    data-today={d === today ? '' : undefined}
                    className={cn(
                      'min-w-[44px] border-b border-l border-slate-200 px-0.5 py-1 text-center font-normal tabular-nums',
                      holidayTitles.length
                        ? 'bg-red-100 text-red-700'
                        : wd === 6
                          ? 'bg-slate-200/80 text-slate-500'
                          : 'bg-slate-50 text-slate-600',
                      wd === 0 && 'border-r-2 border-r-slate-300',
                      d === today && 'bg-amber-100 font-bold text-amber-900'
                    )}
                    title={[formatScheduleDate(d, calendar), ...holidayTitles].join(' — ')}
                  >
                    <div>{weekdayShort()[wd]}</div>
                    <div dir="ltr">{label.length === 3 ? `${label[1]}/${label[2]}` : label.join('/')}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody onClick={startEdit}>
            {visibleRows.map((row) => {
              const editable = row.activityId != null
              const cells = row.activityId ? cellsByActivity.get(row.activityId) : undefined
              const total = row.activityId
                ? cumulativeOf(row.activityId)
                : headingPercents.get(row.key) ?? row.schedulePercent
              const plannedByDate = row.activityId ? plannedByActivity.get(row.activityId) : undefined
              const shift = total != null && total >= 100 ? null : forecastShift(row, today)
              const firstReported = cells ? [...cells.values()].find((c) => c.cumulative > 0)?.date ?? null : null
              const delay = editable ? startDelay(row, firstReported) : null
              const delayText = delay
                ? delay.started
                  ? t.startDelayReported(faNum(delay.days), formatScheduleDate(firstReported!, calendar))
                  : t.startDelayForecast(faNum(delay.days))
                : null
              const dateOf = (iso: string | null) => (iso ? formatScheduleDate(iso, calendar) : '—')
              const plan = schedulePlanWindow(row)
              const planDays = plan ? days.filter((d) => d >= plan.start && d <= plan.finish) : []
              const planVisStart = planDays[0]
              const planVisEnd = planDays.at(-1)
              return (
                <tr key={row.key} className="group">
                  <td
                    className={cn(
                      'sticky right-0 z-10 border-b border-l border-slate-100 py-1 pl-2 text-right',
                      editable ? 'bg-white group-hover:bg-sky-50' : 'bg-slate-50 font-semibold text-slate-800'
                    )}
                    style={{ minWidth: NAME_COL, maxWidth: NAME_COL, paddingRight: 8 + row.depth * 14 }}
                    title={[
                      row.name,
                      t.approvedPlan(dateOf(row.approvedStartDate), dateOf(row.approvedFinishDate)),
                      t.forecastWithProgress(dateOf(row.startDate), dateOf(row.finishDate)),
                    ].join('\n')}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {row.wbs && !nameHasWbs(row.name, row.wbs) ? (
                        <span className="shrink-0 font-mono text-[10px] text-slate-500">{row.wbs}</span>
                      ) : null}
                      <span className="min-w-0 truncate">{row.name}</span>
                      {plan ? (
                        <span
                          className="mr-auto shrink-0 font-mono text-[9px] tabular-nums text-sky-800"
                          dir="ltr"
                        >
                          {monthDayLabel(plan.start, calendar)}–{monthDayLabel(plan.finish, calendar)}
                        </span>
                      ) : null}
                      {shift ? (
                        <span
                          className={cn(
                            'shrink-0 rounded px-1 text-[9px] font-semibold tabular-nums',
                            !plan && 'mr-auto',
                            shift.days > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {shift.of === 'start' ? t.start : t.finish} {faNum(Math.abs(shift.days))} {t.daysUnit} {shift.days > 0 ? t.later : t.earlier}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={cn(
                      'sticky z-10 border-b border-l border-slate-100 text-center font-bold tabular-nums',
                      editable ? 'bg-white text-[#1e3a5f] group-hover:bg-sky-50' : 'bg-slate-50 text-slate-500'
                    )}
                    style={{ right: NAME_COL, minWidth: TOTAL_COL }}
                    title={
                      !editable && headingPercents.has(row.key)
                        ? t.weightProgress(
                            row.scheduleWeight == null ? '—' : row.scheduleWeight.toLocaleString('en-US', { maximumFractionDigits: 2 }),
                            headingPercents.get(row.key)!.toLocaleString('en-US', { maximumFractionDigits: 1 })
                          )
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      {total == null ? '' : SUPERVISOR_COPY.pct(faNum(Math.round(total * 100) / 100))}
                      {traces ? (
                        <CalcTraceTrigger
                          metrics={[row.activityId ? `supervisor.activity:${row.activityId}` : `supervisor.weights:${row.key}`]}
                        />
                      ) : null}
                    </div>
                  </td>
                  {days.map((d) => {
                    const wd = siteWeekday(d)
                    if (!editable) {
                      const inWindow = plan != null && d >= plan.start && d <= plan.finish
                      return (
                        <td
                          key={d}
                          className={cn(
                            'relative border-b border-l border-slate-100 bg-slate-50',
                            wd === 0 && 'border-r-2 border-r-slate-300',
                            inWindow && 'bg-sky-50'
                          )}
                        >
                          {inWindow ? (
                            <PlanBar isStart={d === planVisStart} isFinish={d === planVisEnd} />
                          ) : null}
                        </td>
                      )
                    }
                    const cell = cells?.get(d)
                    const inWindow = plan != null && d >= plan.start && d <= plan.finish
                    const isEditing = editing?.activityId === row.activityId && editing.date === d
                    const key = `${row.activityId}@${d}`
                    const planned = plannedByDate?.get(d) ?? null
                    const showActual =
                      cell != null &&
                      drafts[key] !== null &&
                      (drafts[key] != null || isDistinctProgressPoint(cell, previousPoint(cells, d)))
                    return (
                      <td
                        key={d}
                        data-act={row.activityId!}
                        data-date={d}
                        title={[
                          drafts[key] === null
                            ? t.willDeleteOnSave
                            : showActual
                              ? t.supervisorEntry(
                                  faNum(cell!.cumulative),
                                  cell!.daily == null ? '—' : SUPERVISOR_COPY.pct(faNum(cell!.daily))
                                )
                              : t.noReportClick,
                          inWindow && plan
                            ? t.scheduleRange(dateOf(plan.start), dateOf(plan.finish))
                            : null,
                          planned != null
                            ? t.planGuideOnly(faNum(planned.cumulative))
                            : null,
                          delayText && d === row.approvedStartDate ? delayText : null,
                        ]
                          .filter(Boolean)
                          .join('\n')}
                        className={cn(
                          'relative h-10 cursor-pointer border-b border-l border-slate-100 p-0 text-center align-middle tabular-nums',
                          wd === 0 && 'border-r-2 border-r-slate-300',
                          !isWorkday(d) && (wd === 6 ? 'bg-slate-100/70' : 'bg-red-50/70'),
                          inWindow && isWorkday(d) && 'bg-sky-100',
                          inWindow && isWorkday(d) && (d === plan.start || d === plan.finish) && 'bg-sky-200',
                          d === today && 'bg-amber-50',
                          showActual && 'font-semibold text-amber-800',
                          showActual && cell?.daily != null && cell.daily < 0 && 'text-red-600',
                          drafts[key] != null && 'bg-amber-200 font-bold text-amber-950 ring-1 ring-inset ring-amber-500',
                          'hover:outline hover:outline-1 hover:outline-[#1e3a5f]'
                        )}
                      >
                        {isEditing ? (
                          <div className="relative flex justify-center">
                            <input
                              autoFocus
                              dir="ltr"
                              inputMode="decimal"
                              value={draft}
                              disabled={saving}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={commitCell}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitCell()
                                if (e.key === 'Escape') setEditing(null)
                              }}
                              className={cn(
                                'h-7 w-11 rounded border text-center text-[11px] font-bold outline-none',
                                draftInvalid ? 'border-red-500 bg-red-50' : 'border-[#1e3a5f] bg-white'
                              )}
                              title={t.cumulativeTitle}
                              aria-invalid={draftInvalid}
                            />
                            {draftMessage ? (
                              <p
                                role="alert"
                                dir="rtl"
                                className="absolute top-full z-40 mt-1 w-56 whitespace-normal rounded border border-red-200 bg-white px-2 py-1 text-right text-[10px] font-semibold leading-4 text-red-600 shadow-md"
                              >
                                {draftMessage}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="relative flex h-full flex-col items-center justify-center leading-tight">
                            <span className="min-h-[14px]">{showActual && cell ? faNum(cell.cumulative) : ''}</span>
                            {inWindow ? (
                              <PlanBar isStart={d === planVisStart} isFinish={d === planVisEnd} />
                            ) : null}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="font-semibold text-amber-800">45</span> {t.legendCumulativeRecorded}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex h-3 w-5 items-end rounded-sm border border-sky-200 bg-sky-100">
            <span className="h-1 w-full rounded-sm bg-sky-500" />
          </span>{' '}
          {t.legendScheduleRange}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-200 bg-amber-50" /> {t.legendToday}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-200 bg-slate-100" /> {t.weekdayFri}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-red-200 bg-red-100" />{' '}
          {SUPERVISOR_COPY.recordedHoliday}
        </span>
        <span>{SUPERVISOR_COPY.grayParents}</span>
      </div>
    </div>
    </CalcTraceProvider>
  )
}
