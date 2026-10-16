/**
 * @file features/supervisor/components/daily-report-panel.tsx
 * @purpose کامپوننت UI — سرپرست کارگاه و گزارش روزانه (daily-report-panel)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/skeleton, shared/components/ui/textarea, features/schedule/components/formatted-date, features/workshop/components/uom-display, features/supervisor/lib/daily-progress-storage
 */

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Textarea } from '@/shared/components/ui/textarea'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { UomStack } from '@/features/workshop/components/uom-display'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import { useProjectStore } from '@/features/project-store/use-project-store'
import { useProjectStoreSync } from '@/features/project-store/use-project-store-sync'
import {
activitiesEligibleForDailyReport,
buildDailyReportActivitiesFromTree,
classifyDailyReportTiming,
groupDailyReportActivitiesByParent,
getLatestProgressForActivity,
partitionEligibleByTiming,
type DailyReportTiming,
type DailyProgressEntry,
type DailyReportActivity,
} from '@/features/supervisor/lib/daily-report-activities'
import {
buildActivityProgressTimeline,
checkPercentEntry,
cumulativeBefore,
entryOn,
mergeProgressHistory,
progressAxis,
SITE_WEEK_DAY_LABELS,
type PercentEntryCheck,
type ActivityProgressWeek,
type ActivityWeekProgress,
} from '@/features/supervisor/lib/weekly-activity-progress'
import type { ParsedDailyReportVoice } from '@/features/supervisor/lib/parse-daily-report-voice'
import { VoiceToTextButton } from '@/shared/components/common/voice-to-text-button'
import { postDailyProgress } from '@/features/supervisor/lib/daily-progress-sync'
import { cn } from '@/shared/lib/utils'
import { useWeather } from '@/features/weather/hooks/use-weather'
import { ensureWeatherLine, extractWeatherLine, formatWeatherReportLine, weatherSnapshotFromPayload } from '@/features/weather/lib/report-stamp'
import { SUPERVISOR_COPY, SUPERVISOR_PUNCT } from '@/features/supervisor/config'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'

const t = getSiteSupervisorMessages('fa')

function faNum(n: number): string {
  return n.toLocaleString('fa-IR-u-nu-latn')
}

/** Cumulative before today: the last earlier report, else what today's report started from, else the schedule percent. */
function previousProgressInfo(
  activity: DailyReportActivity,
  history: DailyProgressEntry[],
  reportDate: string
): { percent: number | null; date: string | null; neverReported: boolean; fromBaseline?: boolean; unknown?: boolean } {
  const latestBeforeToday = getLatestProgressForActivity(activity.id, history, reportDate)
  if (latestBeforeToday) {
    return {
      percent: latestBeforeToday.percentComplete,
      date: latestBeforeToday.reportDate,
      neverReported: false,
    }
  }
  if (entryOn(activity.id, history, reportDate)) {
    const before = cumulativeBefore(activity.id, history, reportDate, activity.baselinePercentComplete ?? 0)
    return { percent: before, date: null, neverReported: false, unknown: before == null }
  }
  const baseline = activity.baselinePercentComplete ?? 0
  if (baseline > 0) {
    return { percent: baseline, date: null, neverReported: false, fromBaseline: true }
  }
  return { percent: null, date: null, neverReported: true }
}

/** Today's progress of a saved report: the entered increment, or the rise over the previous cumulative. */
function todayIncrementOf(entry: DailyProgressEntry | null, previous: number | null): number | null {
  if (!entry) return null
  if (entry.dailyIncrement != null) return entry.dailyIncrement
  return previous == null ? null : Math.round((entry.percentComplete - previous) * 100) / 100
}

function ProgressBar({
  value,
  tone = 'navy',
}: {
  value: number
  tone?: 'navy' | 'emerald' | 'amber'
}) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          tone === 'emerald' && 'bg-emerald-500',
          tone === 'amber' && 'bg-amber-500',
          tone === 'navy' && 'bg-[#1e3a5f]'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

const SHORT_DAY_LABELS = [t.shortSat, t.shortSun, t.shortMon, t.shortTue, t.shortWed, t.shortThu]

const PERCENT_ERROR_TEXT = { max: t.percentMax, min: t.percentMin } as const
const DECREASE_WARNING = t.decreaseWarning

function PercentEntryMessage({ check }: { check: PercentEntryCheck | null }) {
  if (check?.error) {
    return (
      <p role="alert" className="text-[10px] font-semibold text-red-600">
        {PERCENT_ERROR_TEXT[check.error]}
      </p>
    )
  }
  if (check?.decrease) {
    return (
      <p role="alert" className="flex items-start gap-1 text-[10px] font-semibold leading-4 text-red-600">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        {DECREASE_WARNING}
      </p>
    )
  }
  return null
}

function ProgressTimelineChart({ weeks }: { weeks: ActivityProgressWeek[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [boxW, setBoxW] = useState(280)
  const boxRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBoxW(Math.max(160, Math.round(entry.contentRect.width)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const dayLabels: readonly string[] = SITE_WEEK_DAY_LABELS
  /** Half-panel chart: last two site-weeks keep the sparkline readable. */
  const chartWeeks = weeks.length > 2 ? weeks.slice(-2) : weeks
  const days = chartWeeks.flatMap((w, weekIndex) =>
    w.days.map((d) => ({ ...d, weekIndex, dayIndex: dayLabels.indexOf(d.label) }))
  )
  const weekStartCol = chartWeeks.map((_, wi) => chartWeeks.slice(0, wi).reduce((n, w) => n + w.days.length, 0))
  const axisW = 26
  const pad = 4
  const H = 112
  const top = 18
  const bottom = H - 16
  const colW = Math.max(14, (boxW - axisW - pad * 2) / Math.max(1, days.length))
  const W = Math.round(colW * days.length + pad * 2)
  const axis = progressAxis(
    days.filter((d) => !d.future && d.cumulative != null).map((d) => d.cumulative!)
  )
  const ticks = axis.ticks
  const yOf = (v: number) => top + ((axis.max - v) / (axis.max - axis.min)) * (bottom - top)
  const points = days.map((d, i) => ({
    ...d,
    x: pad + colW * (i + 0.5),
    y: d.future || d.cumulative == null ? null : yOf(d.cumulative),
  }))
  const drawn = points.filter((p): p is typeof p & { y: number } => p.y != null)
  const area =
    drawn.length > 0
      ? `M${drawn[0]!.x},${yOf(axis.min)} ` + drawn.map((p) => `L${p.x},${p.y}`).join(' ') + ` L${drawn.at(-1)!.x},${yOf(axis.min)} Z`
      : null
  const hovered = hover == null ? null : points[hover]!
  const current = weeks[weeks.length - 1]!

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [days.length, boxW])

  return (
    <div className="flex h-full min-h-[8.5rem] w-full flex-col" title={t.cumulativeTrendHint}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-500">
          {current.weekComplete ? t.weekEndCumulative : t.cumulativeToToday}
        </span>
        <span className="text-sm font-bold tabular-nums text-[#1e3a5f]">
          {current.endCumulative == null ? '—' : SUPERVISOR_COPY.pct(faNum(current.endCumulative))}
        </span>
      </div>
      <div ref={boxRef} className="flex min-h-0 flex-1" dir="ltr">
        <svg width={axisW} height={H} className="block shrink-0" aria-hidden>
          {ticks.map((tick) => (
            <text key={tick} x={axisW - 3} y={yOf(tick) + 3} fontSize={9} fill="#64748b" textAnchor="end" direction="ltr">
              {tick}
            </text>
          ))}
          <line x1={axisW - 0.5} x2={axisW - 0.5} y1={top - 1} y2={bottom} stroke="#cbd5e1" />
        </svg>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: W }} onMouseLeave={() => setHover(null)}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={t.dailyChartAria}>
              {chartWeeks.map((w, wi) => {
                const x0 = pad + weekStartCol[wi]! * colW
                const weekW = colW * w.days.length
                return (
                  <g key={w.weekStart}>
                    {wi % 2 === 1 ? <rect x={x0} y={0} width={weekW} height={bottom} fill="#f8fafc" /> : null}
                    {wi > 0 ? <line x1={x0} x2={x0} y1={0} y2={bottom + 2} stroke="#e2e8f0" /> : null}
                    <text x={x0 + weekW / 2} y={11} textAnchor="middle" fontSize={8} fontWeight={700} fill="#94a3b8">
                      {t.weekN(faNum(w.index))}
                    </text>
                  </g>
                )
              })}

              {ticks.map((tick) => (
                <line key={tick} x1={0} x2={W} y1={yOf(tick)} y2={yOf(tick)} stroke={tick === axis.min ? '#cbd5e1' : '#f1f5f9'} />
              ))}

              {hovered ? (
                <rect x={hovered.x - colW / 2} y={top - 1} width={colW} height={bottom - top + 1} fill="#e2e8f0" fillOpacity={0.5} />
              ) : null}

              {area ? <path d={area} fill="#f59e0b" fillOpacity={0.12} /> : null}
              {drawn.length > 1 ? (
                <polyline points={drawn.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth={1.75} strokeLinejoin="round" />
              ) : null}

              {points.map((p, i) => (
                <g key={p.date}>
                  {p.y == null ? null : (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.daily != null ? (hover === i ? 4 : 3) : hover === i ? 3 : 2}
                      fill={p.daily != null ? '#f59e0b' : '#fff'}
                      stroke="#f59e0b"
                      strokeWidth={1.2}
                    />
                  )}
                  <text
                    x={p.x}
                    y={H - 4}
                    textAnchor="middle"
                    fontSize={8}
                    fill={p.future ? '#94a3b8' : '#64748b'}
                  >
                    {SHORT_DAY_LABELS[p.dayIndex]}
                  </text>
                  <rect
                    x={p.x - colW / 2}
                    y={0}
                    width={colW}
                    height={H}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover((h) => (h === i ? null : i))}
                  />
                </g>
              ))}
            </svg>

            {hovered ? (
              <div
                dir="rtl"
                className="pointer-events-none absolute z-10 w-36 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] leading-tight shadow-md"
                style={{ left: Math.min(W - 70, Math.max(70, hovered.x)), top: 2 }}
              >
                <p className="font-bold text-slate-800">
                  {hovered.label} <FormattedDate value={hovered.date} />
                </p>
                <p className="text-slate-500">{t.weekN(faNum(chartWeeks[hovered.weekIndex]!.index))}</p>
                {hovered.future ? (
                  <p className="text-slate-400">{t.notReachedYet}</p>
                ) : (
                  <p className="tabular-nums text-[#1e3a5f]">
                    {hovered.cumulative == null ? '—' : SUPERVISOR_COPY.pct(faNum(hovered.cumulative))}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-200/80 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
      {children}
    </span>
  )
}

function timingTheme(timing: DailyReportTiming) {
  if (timing === 'past') {
    return {
      card: 'border-amber-300 ring-1 ring-amber-100',
      header: 'border-amber-100 bg-gradient-to-b from-amber-50 to-white',
      wbs: 'bg-amber-700',
      accent: 'text-amber-800',
      badge: t.badgeOverdue,
      badgeClass: 'bg-amber-100 text-amber-900',
      progressAccent: 'text-amber-800',
    }
  }
  if (timing === 'upcoming') {
    return {
      card: 'border-slate-200 border-dashed',
      header: 'border-slate-100 bg-gradient-to-b from-slate-50 to-white',
      wbs: 'bg-slate-500',
      accent: 'text-slate-600',
      badge: t.badgeNotStarted,
      badgeClass: 'bg-slate-100 text-slate-700',
      progressAccent: 'text-slate-700',
    }
  }
  return {
    card: 'border-slate-200',
    header: 'border-slate-100 bg-gradient-to-b from-slate-50 to-white',
    wbs: 'bg-[#1e3a5f]',
    accent: 'text-[#1e3a5f]',
    badge: t.badgeCurrent,
    badgeClass: 'bg-sky-100 text-sky-900',
    progressAccent: 'text-[#1e3a5f]',
  }
}

function ActivityProgressRow({
  activity,
  history,
  reportDate,
  value,
  onChange,
  onSave,
  onSaveDay,
  saving,
  timing = 'current',
}: {
  activity: DailyReportActivity
  /** Server history merged with this browser's entries (cumulative percent per day). */
  history: DailyProgressEntry[]
  reportDate: string
  /** Today's cumulative percent being entered (0–100). */
  value: number | undefined
  onChange: (pct: number) => void
  onSave: () => Promise<void>
  /** Saves the cumulative percent of `date` (today or earlier). */
  onSaveDay: (date: string, percent: number) => Promise<void>
  saving: boolean
  timing?: DailyReportTiming
}) {
  const theme = timingTheme(timing)
  const previous = previousProgressInfo(activity, history, reportDate)
  const todayEntry = entryOn(activity.id, history, reportDate)
  const reportedToday = todayEntry != null
  const todayIncrement = todayIncrementOf(todayEntry, previous.percent)
  const base = previous.percent ?? 0
  /** What is typed in the main input while it differs from the accepted `value`. */
  const [rawInput, setRawInput] = useState<string | null>(null)
  useEffect(() => {
    setRawInput((raw) => (raw != null && Number(raw) !== value ? null : raw))
  }, [value])
  const typed = rawInput == null || rawInput.trim() === '' ? value : Number(rawInput)
  const inputCheck = typed == null || Number.isNaN(typed) ? null : checkPercentEntry(typed, previous.percent)
  const cumulativeAfter = Math.min(100, Math.max(0, value ?? todayEntry?.percentComplete ?? base))
  const gainToday = Math.round((cumulativeAfter - base) * 100) / 100
  const timeline = useMemo(
    () => buildActivityProgressTimeline(activity.id, history, reportDate, activity.baselinePercentComplete ?? 0),
    [activity.id, activity.baselinePercentComplete, history, reportDate]
  )
  const week = timeline[timeline.length - 1]!

  return (
    <li
      className={cn(
        'overflow-hidden rounded-lg border bg-white shadow-sm transition-colors',
        reportedToday ? 'border-emerald-200/90 ring-1 ring-emerald-100' : theme.card
      )}
    >
      <div className={cn('border-b px-3 py-1.5', theme.header)}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {activity.wbs ? (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white',
                  theme.wbs
                )}
              >
                {activity.wbs}
              </span>
            ) : null}
            <p className="text-[13px] font-bold leading-snug text-slate-900">{activity.name}</p>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', theme.badgeClass)}>
              {theme.badge}
            </span>
            {activity.quantity != null && activity.uom ? (
              <MetaPill>
                {t.planQtyPrefix}{' '}
                <span className="inline-flex items-center gap-0.5 font-semibold tabular-nums text-slate-800">
                  {faNum(activity.quantity)}
                  <UomStack uom={activity.uom} />
                </span>
              </MetaPill>
            ) : null}
            <MetaPill>
              {t.start}: <FormattedDate value={activity.plannedStartDate} />
            </MetaPill>
            {activity.plannedFinishDate ? (
              <MetaPill>
                {t.finish}: <FormattedDate value={activity.plannedFinishDate} />
              </MetaPill>
            ) : null}
            {activity.location ? <MetaPill>{t.locationColon} {activity.location}</MetaPill> : null}
          </div>
          {reportedToday ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
              {t.recorded}
              {todayIncrement != null ? ` · ${SUPERVISOR_COPY.pct(faNum(todayIncrement))}` : ''}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch sm:grid-cols-2">
        {/* RTL: first column = right half — entry / percent */}
        <div className="flex min-h-[8.5rem] flex-col justify-center border-slate-100 p-3 sm:border-l">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`pct-${activity.id}`} className="text-[11px] font-semibold text-slate-600">
              {t.todayCumulativeProgress}
            </Label>
            <span className={cn('text-xl font-bold tabular-nums', theme.progressAccent)}>
              {SUPERVISOR_COPY.pct(faNum(cumulativeAfter))}
            </span>
          </div>
          <ProgressBar value={cumulativeAfter} tone="amber" />
          <p className="mt-1 text-[10px] text-slate-500">
            {t.previousLabel}{' '}
            <span className="font-semibold tabular-nums text-slate-700">{SUPERVISOR_COPY.pct(faNum(base))}</span>
            {' — '}
            {t.todayProgressLabel}{' '}
            <span className={cn('font-semibold tabular-nums', gainToday < 0 ? 'text-red-600' : 'text-slate-700')}>
              {SUPERVISOR_COPY.pct(faNum(gainToday))}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Input
              id={`pct-${activity.id}`}
              type="number"
              min={0}
              max={100}
              value={rawInput ?? value ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                setRawInput(raw)
                if (raw.trim() === '') return
                const n = Number(raw)
                if (!Number.isNaN(n) && checkPercentEntry(n, null).error == null) onChange(n)
              }}
              aria-invalid={inputCheck?.error != null}
              className={cn(
                'h-9 w-20 text-center text-base font-bold tabular-nums shrink-0',
                inputCheck?.error && 'border-red-400 focus-visible:ring-red-300'
              )}
              dir="ltr"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0"
              disabled={saving || value === undefined || inputCheck?.error != null}
              onClick={() => void onSave()}
            >
              {saving ? '…' : t.save}
            </Button>
            <BoxEditor
              label={t.todayCumulativeLabel}
              initial={todayEntry?.percentComplete ?? cumulativeAfter}
              min={0}
              max={100}
              previous={previous.percent}
              hint={(v) => t.todayProgressHint(faNum(Math.round((v - base) * 100) / 100))}
              saving={saving}
              onSave={(v) => onSaveDay(reportDate, v)}
            />
          </div>
          <PercentEntryMessage check={inputCheck} />
        </div>

        {/* RTL: second column = left half — chart */}
        <div className="min-h-[8.5rem] min-w-0 border-t border-slate-100 p-3 sm:border-t-0">
          <ProgressTimelineChart weeks={timeline} />
        </div>
      </div>

      <PastDaysEditor
        activity={activity}
        history={history}
        reportDate={reportDate}
        week={week}
        previousDate={previous.date}
        saving={saving}
        onSaveDay={onSaveDay}
      />
    </li>
  )
}

/** «ویرایش» button that opens a number input with «ثبت» / «انصراف» inside a box. */
function BoxEditor({
  label,
  initial,
  min,
  max,
  previous,
  hint,
  saving,
  onSave,
}: {
  label: string
  initial: number
  min: number
  max: number
  /** Cumulative before that day; a lower value is warned about but still saved. */
  previous?: number | null
  hint?: (value: number) => ReactNode
  saving: boolean
  onSave: (value: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const parsed = parseDraft(draft)
  const check = parsed == null ? null : checkPercentEntry(parsed, previous)
  const valid = parsed != null && parsed >= min && parsed <= max

  async function save() {
    if (parsed == null || !valid || saving) return
    await onSave(parsed)
    setEditing(false)
  }

  if (!editing) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2 text-[11px]"
        disabled={saving}
        onClick={() => {
          setDraft(String(Math.min(max, Math.max(min, initial))))
          setEditing(true)
        }}
      >
        {t.editText}
      </Button>
    )
  }

  return (
    <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50/80 p-1.5">
      <p className="text-[9px] font-semibold text-slate-500">{label}</p>
      <div className="flex flex-wrap items-center gap-1">
        <Input
          type="text"
          inputMode="decimal"
          value={draft}
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') setEditing(false)
          }}
          className={cn(
            'h-8 w-16 text-center text-sm font-bold tabular-nums',
            !valid && 'border-red-400 focus-visible:ring-red-300'
          )}
          dir="ltr"
          aria-label={label}
        />
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={saving || !valid}
          onClick={() => void save()}
        >
          {saving ? '…' : t.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" disabled={saving} onClick={() => setEditing(false)}>
          {t.dismiss}
        </Button>
      </div>
      {parsed == null ? (
        <p role="alert" className="text-[10px] text-red-600">
          {t.numberBetween(faNum(min), faNum(max))}
        </p>
      ) : check?.error || check?.decrease ? (
        <PercentEntryMessage check={check} />
      ) : null}
      {parsed != null && valid && hint ? <p className="text-[10px] text-slate-500">{hint(parsed)}</p> : null}
    </div>
  )
}

/** Number typed in a box; accepts Persian/Arabic digits and «٫». */
function parseDraft(raw: string): number | null {
  const ascii = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String(SUPERVISOR_PUNCT.persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(SUPERVISOR_PUNCT.arabicDigits.indexOf(d)))
    .replace(/[٫,]/g, '.')
  if (ascii === '' || !/^-?\d+(\.\d+)?$/.test(ascii)) return null
  return Number(ascii)
}

function PastDaysEditor({
  activity,
  history,
  reportDate,
  week,
  previousDate,
  saving,
  onSaveDay,
}: {
  activity: DailyReportActivity
  history: DailyProgressEntry[]
  reportDate: string
  week: ActivityWeekProgress
  previousDate: string | null
  saving: boolean
  onSaveDay: (date: string, percent: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const baseline = activity.baselinePercentComplete ?? 0
  const days = useMemo(() => {
    const list = week.days
      .filter((d) => d.date < reportDate)
      .map((d) => ({ date: d.date, label: d.label as string }))
    if (previousDate && previousDate < week.weekStart) {
      list.unshift({ date: previousDate, label: t.lastPreviousReport })
    }
    return list.map((d) => {
      const entry = entryOn(activity.id, history, d.date)
      const before = cumulativeBefore(activity.id, history, d.date, baseline)
      return { ...d, entry, before, daily: todayIncrementOf(entry, before) }
    })
  }, [activity.id, baseline, history, previousDate, reportDate, week])

  if (days.length === 0) return null

  return (
    <div className="border-t border-slate-100 px-2.5 py-1">
      <button
        type="button"
        className="text-[10px] font-semibold text-[#1e3a5f] hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? t.closeEditPrevious : t.editPreviousDays(faNum(days.length))}
      </button>
      {open ? (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => {
            const editing = editingDate === d.date
            const start = d.before ?? 0
            const parsed = parseDraft(draft)
            const check = parsed == null ? null : checkPercentEntry(parsed, d.before)
            const valid = parsed != null && check?.error == null
            const save = async () => {
              if (parsed == null || !valid || saving) return
              await onSaveDay(d.date, parsed)
              setEditingDate(null)
            }
            return (
              <li
                key={d.date}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <div className="min-w-0 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-800">{d.label}</p>
                  <FormattedDate value={d.date} />
                </div>
                {editing ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={draft}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void save()
                        if (e.key === 'Escape') setEditingDate(null)
                      }}
                      className={cn(
                        'h-8 w-16 text-center text-sm font-bold tabular-nums',
                        !valid && 'border-red-400 focus-visible:ring-red-300'
                      )}
                      dir="ltr"
                      aria-label={t.cumulativeAria(d.label)}
                    />
                    <span className={cn('text-[10px]', valid ? 'text-slate-500' : 'text-red-600')}>
                      {parsed != null && valid
                        ? t.thatDayProgress(faNum(Math.round((parsed - start) * 100) / 100))
                        : check?.error
                          ? null
                          : t.range0to100}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={saving || !valid}
                      onClick={() => void save()}
                    >
                      {saving ? '…' : t.save}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={saving}
                      onClick={() => setEditingDate(null)}
                    >
                      {t.dismiss}
                    </Button>
                    <div className="basis-full">
                      <PercentEntryMessage check={check} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <p className="text-sm font-bold tabular-nums text-slate-800">
                        {d.entry ? SUPERVISOR_COPY.pct(faNum(d.entry.percentComplete)) : t.notRecorded}
                      </p>
                      {d.entry ? (
                        <p className="text-[10px] text-slate-500">
                          {t.thatDayProgress(d.daily == null ? '—' : faNum(d.daily))}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={saving || editingDate != null}
                      onClick={() => {
                        setDraft(String(d.entry?.percentComplete ?? start))
                        setEditingDate(d.date)
                      }}
                    >
                      {d.entry ? t.editText : t.save}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export function DailyReportPanel({
  projectId,
  projectName = '',
}: {
  projectId: string | null
  projectName?: string
}) {
  useProjectStoreSync(projectId)
  const { data: weather } = useWeather(projectId)
  const reportDate = useProjectStore((s) => s.today)
  const snapshot = useProjectStore((s) => (projectId && s.snapshot?.projectId === projectId ? s.snapshot : null))
  const localEntries = useProjectStore((s) => s.localEntries)
  const storeStatus = useProjectStore((s) => s.status)
  const storeError = useProjectStore((s) => s.error)
  const activities = useMemo(
    () => (snapshot ? buildDailyReportActivitiesFromTree(snapshot.tree.nodes, snapshot.tree.orphanPackages) : []),
    [snapshot]
  )
  const activitiesLoading = !snapshot && storeStatus !== 'error' && Boolean(projectId)
  const [saveError, setSaveError] = useState<string | null>(null)
  const activitiesError = saveError ?? (storeStatus === 'error' ? storeError : null)

  const [notesByDate, setNotesByDate] = useState<Record<string, string>>({})
  const [formValues, setFormValues] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingActivityId, setSavingActivityId] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState(false)
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null)
  const [organizeLoading, setOrganizeLoading] = useState(false)
  const [organizeError, setOrganizeError] = useState<string | null>(null)
  const [voiceParsed, setVoiceParsed] = useState<ParsedDailyReportVoice | null>(null)
  const [organizedDraft, setOrganizedDraft] = useState('')
  const [timingFilter, setTimingFilter] = useState<'all' | DailyReportTiming>('current')
  const [searchQuery, setSearchQuery] = useState('')

  /** Saved reports (database + this browser's copies): the history every view reads from the store. */
  const history = useMemo(() => mergeProgressHistory(snapshot?.history ?? [], localEntries), [snapshot, localEntries])

  useEffect(() => {
    if (!projectId) return
    const stored = readProjectDailyProgress(projectId)
    setNotesByDate(stored.notesByDate)
    setNote(stored.notesByDate[reportDate] ?? '')
    setHydrated(true)
  }, [projectId, reportDate])

  useEffect(() => {
    if (!hydrated || !weather) return
    const line = formatWeatherReportLine(weather)
    setNote((prev) => {
      const existing = extractWeatherLine(prev)
      if (existing === line) return prev
      return ensureWeatherLine(prev, line)
    })
  }, [hydrated, weather, reportDate])

  const eligible = useMemo(
    () => activitiesEligibleForDailyReport(activities, history, reportDate),
    [activities, history, reportDate]
  )

  const eligibleByTiming = useMemo(
    () => partitionEligibleByTiming(activities, history, reportDate),
    [activities, history, reportDate]
  )

  const timingCounts = useMemo(
    () => ({
      current: eligibleByTiming.current.length,
      past: eligibleByTiming.past.length,
      upcoming: eligibleByTiming.upcoming.length,
    }),
    [eligibleByTiming]
  )

  const reportSections = useMemo(
    () =>
      (
        [
          {
            timing: 'current' as const,
            title: t.currentPeriod,
            description: t.currentPeriodDesc,
            shellClass: 'border-sky-200 bg-sky-50/40',
            titleClass: 'text-sky-900',
          },
          {
            timing: 'past' as const,
            title: t.previousWork,
            description: t.previousWorkDesc,
            shellClass: 'border-amber-200 bg-amber-50/40',
            titleClass: 'text-amber-900',
          },
        ] as const
      ).map((section) => ({
        ...section,
        groups: groupDailyReportActivitiesByParent(eligibleByTiming[section.timing]),
      })),
    [eligibleByTiming]
  )

  const filteredEligible = useMemo(() => {
    const base = timingFilter === 'all' ? eligible : eligibleByTiming[timingFilter]
    const q = searchQuery.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.wbs?.toLowerCase().includes(q) ?? false) ||
        (a.parentTaskName?.toLowerCase().includes(q) ?? false) ||
        (a.parentTaskWbs?.toLowerCase().includes(q) ?? false)
    )
  }, [eligible, eligibleByTiming, timingFilter, searchQuery])

  const displaySections = useMemo(() => {
    if (timingFilter === 'all') {
      if (filteredEligible.length === 0) return []
      return [
        {
          timing: 'all' as const,
          title: t.reportableToday,
          description: t.reportableTodayDesc,
          shellClass: 'border-slate-200 bg-white',
          titleClass: 'text-slate-900',
          groups: groupDailyReportActivitiesByParent(filteredEligible),
        },
      ]
    }
    return reportSections
      .filter((section) => section.timing === timingFilter)
      .map((section) => ({
        ...section,
        groups: groupDailyReportActivitiesByParent(
          section.groups.flatMap((g) => g.activities).filter((a) => filteredEligible.includes(a))
        ),
      }))
      .filter((section) => section.groups.length > 0)
  }, [filteredEligible, reportSections, timingFilter])

  useEffect(() => {
    if (!hydrated) return
    const initial: Record<string, number> = {}
    for (const a of eligible) {
      const todayEntry = entryOn(a.id, history, reportDate)
      initial[a.id] =
        todayEntry?.percentComplete ?? cumulativeBefore(a.id, history, reportDate, a.baselinePercentComplete ?? 0) ?? 0
    }
    setFormValues(initial)
  }, [hydrated, eligible, history, reportDate])

  function weatherByDateFor(date: string) {
    return weather ? { [date]: weatherSnapshotFromPayload(weather, date) } : undefined
  }

  /** Saves through the store (this browser's copy, then the database); a failed upload keeps the local copy. */
  async function saveReports(reports: Array<{ taskId: string; dateKey: string; progress: number }>, nextNotes?: Record<string, string>) {
    if (nextNotes) setNotesByDate(nextNotes)
    try {
      await useProjectStore.getState().saveDailyReports(reports, {
        notesByDate: nextNotes,
        weatherByDate: weatherByDateFor(reportDate),
      })
      setSaveError(null)
    } catch (error) {
      console.error(error)
      setSaveError(error instanceof Error ? error.message : t.saveScheduleFailed)
    }
  }

  // Re-push local daily progress into Supabase after the schedule:uuid fix
  // so previously saved supervisor % lands in ویرایش/ارسال without retyping.
  // A newer server value (e.g. edited in the schedule) is not overwritten.
  const serverLoaded = snapshot != null
  useEffect(() => {
    if (!hydrated || !projectId || !snapshot || localEntries.length === 0) return
    const pending = localEntries.filter((e) => {
      if (e.reportDate !== reportDate) return false
      const server = entryOn(e.activityId, snapshot.history, reportDate)
      return !server || (e.savedAt ?? '') > (server.savedAt ?? '')
    })
    if (pending.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        await postDailyProgress(projectId, pending, [reportDate])
        if (cancelled) return
        setSaveError(null)
        void useProjectStore.getState().refresh()
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          setSaveError(error instanceof Error ? error.message : t.syncScheduleFailed)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open / day change
  }, [hydrated, projectId, reportDate, serverLoaded])

  async function handleSaveSingle(activityId: string) {
    await handleSaveDay(activityId, reportDate, formValues[activityId] ?? 0)
  }

  /** Saves the cumulative percent of one day (today or earlier); other days keep theirs. */
  async function handleSaveDay(activityId: string, date: string, percent: number) {
    if (!projectId) return
    setSavingActivityId(activityId)
    setSavedActivityId(null)

    const nextNotes = date === reportDate ? notesWithWeather(note.trim()) : undefined
    if (nextNotes) setNote(nextNotes[reportDate] ?? note)
    await saveReports([{ taskId: activityId, dateKey: date, progress: percent }], nextNotes)

    setSavingActivityId(null)
    setSavedActivityId(activityId)
    window.setTimeout(() => setSavedActivityId(null), 2500)
  }

  function notesWithWeather(body: string): Record<string, string> {
    const line = weather ? formatWeatherReportLine(weather) : ''
    const stamped = line ? ensureWeatherLine(body, line) : body
    return { ...notesByDate, [reportDate]: stamped }
  }

  async function handleSubmit() {
    if (!projectId) return
    setSubmitting(true)
    setSubmitOk(false)

    const reports = eligible.map((a) => ({
      taskId: a.id,
      dateKey: reportDate,
      progress: formValues[a.id] ?? cumulativeBefore(a.id, history, reportDate, a.baselinePercentComplete ?? 0) ?? 0,
    }))
    const nextNotes = notesWithWeather(note.trim())
    setNote(nextNotes[reportDate] ?? note)
    await saveReports(reports, nextNotes)

    setSubmitting(false)
    setSubmitOk(true)
    window.setTimeout(() => setSubmitOk(false), 4000)
  }

  async function handleVoiceOrganize(transcript: string) {
    setOrganizeError(null)
    setOrganizeLoading(true)
    setVoiceParsed(null)
    try {
      const res = await fetch('/api/supervisor/organize-daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          activities: eligible.map((a) => ({
            id: a.id,
            wbs: a.wbs,
            name: a.name,
          })),
        }),
      })
      const data = (await res.json()) as ParsedDailyReportVoice & { error?: string }
      if (!res.ok) throw new Error(data.error || t.voiceProcessFailed)
      setVoiceParsed(data)
      setOrganizedDraft(data.organizedText)
    } catch (e) {
      setOrganizeError(e instanceof Error ? e.message : t.voiceProcessFailed)
    } finally {
      setOrganizeLoading(false)
    }
  }

  function applyOrganizedReport() {
    if (!voiceParsed) return
    setFormValues((prev) => {
      const next = { ...prev }
      for (const item of voiceParsed.activities) {
        if (item.percentComplete != null) {
          next[item.activityId] = item.percentComplete
        }
      }
      return next
    })
    setNote((prev) => {
      const line = extractWeatherLine(prev) ?? (weather ? formatWeatherReportLine(weather) : '')
      const body = organizedDraft.trim()
      return line ? ensureWeatherLine(body, line) : body
    })
    setVoiceParsed(null)
    setOrganizedDraft('')
  }

  if (!projectId) {
    return (
      <p className="text-sm text-slate-500" dir="rtl" lang="fa">
        {t.selectProjectFirst}
      </p>
    )
  }

  if (!hydrated || activitiesLoading) {
    return (
      <div className="space-y-4" dir="rtl" aria-busy="true" aria-label={t.loadingScheduleReports}>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3" dir="rtl" lang="fa">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTimingFilter('all')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            timingFilter === 'all'
              ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          )}
        >
          {t.allCount(faNum(eligible.length))}
        </button>
        <button
          type="button"
          onClick={() => setTimingFilter('current')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            timingFilter === 'current'
              ? 'border-sky-600 bg-sky-600 text-white'
              : 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100'
          )}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          {t.currentPeriod} ({faNum(timingCounts.current)})
        </button>
        <button
          type="button"
          onClick={() => setTimingFilter('past')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            timingFilter === 'past'
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
          )}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          {t.previousWorkShort} ({faNum(timingCounts.past)})
        </button>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchWbsPlaceholder}
          className="h-9 min-w-[12rem] flex-1 bg-white text-sm"
        />
      </div>

      {activitiesError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {activitiesError}
        </p>
      ) : null}

      {activities.length === 0 && !activitiesError ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          {t.noWorkshopPackages}
        </p>
      ) : null}

      {eligible.length === 0 && activities.length > 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          {t.noEligibleToday}
        </p>
      ) : displaySections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          {searchQuery.trim()
            ? t.noSearchResults
            : timingFilter === 'current'
              ? t.noCurrentPeriod
              : timingFilter === 'past'
                ? t.noPreviousLeft
                : t.noEligible}
        </p>
      ) : (
        <div className="space-y-3">
          {displaySections.map((section) =>
            section.groups.length === 0 ? null : (
              <section
                key={section.timing}
                className={cn('space-y-2 rounded-xl border p-2.5', section.shellClass)}
              >
                <div>
                  <h2 className={cn('text-sm font-bold', section.titleClass)}>{section.title}</h2>
                  <p className="mt-0.5 text-[11px] text-slate-600">{section.description}</p>
                </div>
                <ul className="space-y-3">
                  {section.groups.map((group) => (
                    <li key={`${section.timing}-${group.key}`} className="space-y-2">
                      <div
                        className={cn(
                          'rounded-lg border px-3 py-1.5 shadow-sm',
                          section.timing === 'past'
                            ? 'border-amber-200 bg-amber-50/80'
                            : section.timing === 'upcoming'
                              ? 'border-slate-200 bg-white'
                              : section.timing === 'all'
                                ? 'border-slate-200 bg-slate-50/80'
                                : 'border-[#1e3a5f]/25 bg-[#1e3a5f]/8'
                        )}
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span
                            className={cn(
                              'text-[10px] font-semibold',
                              section.timing === 'past'
                                ? 'text-amber-800/70'
                                : section.timing === 'upcoming'
                                  ? 'text-slate-500'
                                  : 'text-[#1e3a5f]/70'
                            )}
                          >
                            {t.activityHeader}
                          </span>
                          {group.parentTaskWbs ? (
                            <span
                              className={cn(
                                'font-mono text-xs font-bold tabular-nums',
                                section.timing === 'past'
                                  ? 'text-amber-900'
                                  : section.timing === 'upcoming'
                                    ? 'text-slate-600'
                                    : 'text-[#1e3a5f]'
                              )}
                            >
                              {group.parentTaskWbs}
                            </span>
                          ) : null}
                          <h3 className="text-sm font-bold text-slate-900">{group.parentTaskName}</h3>
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {group.activities.map((activity) => (
                          <ActivityProgressRow
                            key={activity.id}
                            activity={activity}
                            history={history}
                            reportDate={reportDate}
                            timing={
                              section.timing === 'all'
                                ? classifyDailyReportTiming(activity, history, reportDate, activities)
                                : section.timing
                            }
                            value={formValues[activity.id]}
                            onChange={(pct) =>
                              setFormValues((prev) => ({ ...prev, [activity.id]: pct }))
                            }
                            onSave={() => handleSaveSingle(activity.id)}
                            onSaveDay={(date, percent) => handleSaveDay(activity.id, date, percent)}
                            saving={savingActivityId === activity.id}
                          />
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}
        </div>
      )}

      {savedActivityId ? (
        <p className="text-sm font-medium text-emerald-700">{t.itemRecorded}</p>
      ) : null}

      {eligible.length > 0 ? (
        <div className="sticky bottom-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? t.submitting : t.submitTodayAll}
            </Button>
            <p className="text-xs text-slate-500">
              {t.orSaveEach}
            </p>
            {submitOk ? (
              <p className="text-sm font-medium text-emerald-700">{t.todayReportSaved}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="daily-report-note" className="text-sm font-semibold text-slate-800">
            {t.dailyNoteLabel}
          </Label>
          <VoiceToTextButton
            size="sm"
            disabled={organizeLoading}
            prompt={t.voicePrompt}
            onTranscript={(text) => void handleVoiceOrganize(text)}
          />
        </div>

        {organizeLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t.organizingVoice}
          </div>
        ) : null}

        {organizeError ? <p className="text-sm text-rose-700">{organizeError}</p> : null}

        {voiceParsed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-950">{t.organizedPreview}</p>
            <Textarea
              rows={6}
              value={organizedDraft}
              onChange={(e) => setOrganizedDraft(e.target.value)}
              className="text-sm leading-relaxed bg-white"
            />
            {voiceParsed.activities.some((a) => a.percentComplete != null) ? (
              <p className="text-xs text-slate-600">
                {t.detectedPercents}{' '}
                {voiceParsed.activities
                  .filter((a) => a.percentComplete != null)
                  .map((a) => SUPERVISOR_COPY.labeledPct(a.wbs ?? a.name, a.percentComplete!))
                  .join(SUPERVISOR_PUNCT.listSep)}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applyOrganizedReport}>
                {t.applyToForm}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setVoiceParsed(null)
                  setOrganizedDraft('')
                }}
              >
                {t.cancel}
              </Button>
            </div>
          </div>
        ) : null}

        <Textarea
          id="daily-report-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t.fieldNotePlaceholder}
          className="text-sm"
        />
      </div>

      <Button
        type="button"
        className="w-full shadow-sm"
        asChild
      >
        <Link
          href={
            projectId
              ? `/dashboard/site-supervisor/daily-reports?projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`
              : '/dashboard/site-supervisor/daily-reports'
          }
        >
          {t.previousReports}
        </Link>
      </Button>
    </div>
  )
}
