'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays, ClipboardList, Loader2 } from 'lucide-react'
import { useScheduleCalendar } from '@/hooks/useScheduleCalendar'
import { formatScheduleDate } from '@/lib/schedule/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { UomStack } from '@/components/workshop/uom-display'
import {
  readProjectDailyProgress,
  upsertDailyEntries,
  writeProjectDailyProgress,
} from '@/lib/supervisor/daily-progress-storage'
import {
  activitiesEligibleForDailyReport,
  buildDailyReportActivitiesFromTree,
  classifyDailyReportTiming,
  countRemainingForTodayReport,
  groupDailyReportActivitiesByParent,
  getLatestProgressForActivity,
  partitionEligibleByTiming,
  type DailyReportTiming,
  type DailyProgressEntry,
  type DailyReportActivity,
} from '@/lib/supervisor/daily-report-activities'
import {
  buildActivityProgressTimeline,
  cumulativeBefore,
  cumulativeEntry,
  entryOn,
  historyFromServer,
  mergeProgressHistory,
  SITE_WEEK_DAY_LABELS,
  type ActivityProgressWeek,
  type ActivityWeekProgress,
  type ServerProgressRow,
  withLatestReports,
} from '@/lib/supervisor/weekly-activity-progress'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/lib/workshop/types'
import type { ParsedDailyReportVoice } from '@/lib/supervisor/parse-daily-report-voice'
import { VoiceToTextButton } from '@/components/shared/voice-to-text-button'
import { useScheduleViewSync } from '@/lib/schedule/schedule-view-sync'
import { postDailyProgress } from '@/lib/supervisor/daily-progress-sync'
import { cn } from '@/lib/utils'

function faNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
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

function formatTodayHeading(calendar: 'jalali' | 'gregorian'): string {
  const iso = todayIso()
  const d = new Date(`${iso}T12:00:00`)
  if (calendar === 'jalali') {
    return d.toLocaleDateString('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
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

const SHORT_DAY_LABELS = ['شنبه', 'یک', 'دو', 'سه', 'چهار', 'پنج']

function ProgressTimelineChart({ weeks }: { weeks: ActivityProgressWeek[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [boxW, setBoxW] = useState(300)
  const boxRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBoxW(Math.max(200, Math.round(entry.contentRect.width)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const dayLabels: readonly string[] = SITE_WEEK_DAY_LABELS
  const days = weeks.flatMap((w, weekIndex) =>
    w.days.map((d) => ({ ...d, weekIndex, dayIndex: dayLabels.indexOf(d.label) }))
  )
  const weekStartCol = weeks.map((_, wi) => weeks.slice(0, wi).reduce((n, w) => n + w.days.length, 0))
  const axisW = 36
  const pad = 6
  const H = 232
  const top = 74
  const bottom = H - 28
  const colW = Math.max(40, (boxW - axisW - pad * 2) / days.length)
  const W = Math.round(colW * days.length + pad * 2)
  const ticks = [0, 20, 40, 60, 80, 100]
  const yOf = (v: number) => top + ((100 - v) / 100) * (bottom - top)
  const points = days.map((d, i) => ({
    ...d,
    x: pad + colW * (i + 0.5),
    y: d.future || d.cumulative == null ? null : yOf(d.cumulative),
  }))
  const drawn = points.filter((p): p is typeof p & { y: number } => p.y != null)
  const area =
    drawn.length > 0
      ? `M${drawn[0]!.x},${yOf(0)} ` + drawn.map((p) => `L${p.x},${p.y}`).join(' ') + ` L${drawn.at(-1)!.x},${yOf(0)} Z`
      : null
  const hovered = hover == null ? null : points[hover]!
  const current = weeks[weeks.length - 1]!

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [days.length, boxW])

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <p className="text-[11px] font-semibold text-slate-600">
        روند پیشرفت تجمعی از اولین روز ثبت پیشرفت (نقطه‌ها روزهای گزارش سرپرست؛ تجمعی هر هفته روی پنجشنبه)
      </p>
      <div ref={boxRef} className="mt-1 flex" dir="ltr">
        <svg width={axisW} height={H} className="block shrink-0" aria-hidden>
          {ticks.map((t) => (
            <text key={t} x={axisW - 5} y={yOf(t) + 4} fontSize={11} fill="#475569" textAnchor="end" direction="ltr">
              {faNum(t)}٪
            </text>
          ))}
          <line x1={axisW - 0.5} x2={axisW - 0.5} y1={top - 4} y2={bottom} stroke="#94a3b8" />
        </svg>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: W }} onMouseLeave={() => setHover(null)}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="نمودار پیشرفت روزانه از اولین گزارش تا امروز">
              {weeks.map((w, wi) => {
                const x0 = pad + weekStartCol[wi]! * colW
                const weekW = colW * w.days.length
                const thuX = x0 + weekW - colW / 2
                const badgeW = Math.max(colW - 4, 40)
                return (
                  <g key={w.weekStart}>
                    {wi % 2 === 1 ? <rect x={x0} y={0} width={weekW} height={bottom} fill="#f8fafc" /> : null}
                    {wi > 0 ? <line x1={x0} x2={x0} y1={0} y2={bottom + 6} stroke="#cbd5e1" strokeDasharray="4 3" /> : null}
                    <text x={x0 + weekW / 2} y={13} textAnchor="middle" fontSize={11} fontWeight={700} fill="#475569">
                      هفته {faNum(w.index)}
                    </text>
                    <rect x={thuX - badgeW / 2} y={20} width={badgeW} height={27} rx={6} fill={w.weekComplete ? '#1e3a5f' : '#ffffff'} stroke="#1e3a5f" strokeDasharray={w.weekComplete ? undefined : '3 2'} />
                    <text x={thuX} y={31} textAnchor="middle" fontSize={9} fill={w.weekComplete ? '#cbd5e1' : '#64748b'}>
                      تجمعی
                    </text>
                    <text x={thuX} y={43} textAnchor="middle" fontSize={11} fontWeight={700} fill={w.weekComplete ? '#ffffff' : '#1e3a5f'}>
                      {w.endCumulative == null ? '—' : `${faNum(w.endCumulative)}٪`}
                    </text>
                  </g>
                )
              })}

              {ticks.map((t) => (
                <line key={t} x1={0} x2={W} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? '#94a3b8' : '#e2e8f0'} strokeDasharray={t === 0 ? undefined : '3 3'} />
              ))}

              {hovered ? (
                <rect x={hovered.x - colW / 2} y={top - 4} width={colW} height={bottom - top + 4} fill="#e2e8f0" fillOpacity={0.6} />
              ) : null}

              {area ? <path d={area} fill="#f59e0b" fillOpacity={0.12} /> : null}
              {drawn.length > 1 ? (
                <polyline points={drawn.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" />
              ) : null}

              {points.map((p, i) => (
                <g key={p.date}>
                  {p.y == null ? null : p.daily != null ? (
                    <>
                      <circle cx={p.x} cy={p.y} r={hover === i ? 6 : 4.5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
                      <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="#92400e">
                        {faNum(p.cumulative ?? 0)}٪
                      </text>
                    </>
                  ) : (
                    <circle cx={p.x} cy={p.y} r={hover === i ? 4 : 2.5} fill="#fff" stroke="#f59e0b" strokeWidth={1.2} />
                  )}
                  <line x1={p.x} x2={p.x} y1={bottom} y2={bottom + 3} stroke="#94a3b8" />
                  <text
                    x={p.x}
                    y={H - 9}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={p.dayIndex === SITE_WEEK_DAY_LABELS.length - 1 ? 700 : 400}
                    fill={p.future ? '#94a3b8' : '#334155'}
                  >
                    {colW >= 48 ? p.label : SHORT_DAY_LABELS[p.dayIndex]}
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
                className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] leading-5 shadow-lg"
                style={{ left: Math.min(W - 90, Math.max(90, hovered.x)), top: 4 }}
              >
                <p className="font-bold text-slate-800">
                  {hovered.label} <span className="font-normal text-slate-500"><FormattedDate value={hovered.date} /></span>
                </p>
                <p className="text-[10px] text-slate-500">هفته {faNum(weeks[hovered.weekIndex]!.index)}</p>
                {hovered.future ? (
                  <p className="text-slate-400">هنوز نرسیده</p>
                ) : (
                  <>
                    <p className="flex justify-between gap-2">
                      <span className="text-slate-500">پیشرفت روز</span>
                      <span className="font-bold tabular-nums text-amber-700">{hovered.daily == null ? 'ثبت نشده' : `${faNum(hovered.daily)}٪`}</span>
                    </p>
                    <p className="flex justify-between gap-2">
                      <span className="text-slate-500">تجمعی</span>
                      <span className="font-bold tabular-nums text-[#1e3a5f]">{hovered.cumulative == null ? '—' : `${faNum(hovered.cumulative)}٪`}</span>
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ol className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5 border-t border-slate-100 pt-2">
        {weeks.map((w) => {
          const isCurrent = w === current
          return (
            <li
              key={w.weekStart}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-[11px]',
                isCurrent ? 'border-[#1e3a5f]/30 bg-sky-50/60' : 'border-slate-100 bg-slate-50/60'
              )}
            >
              <p className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800">
                  هفته {faNum(w.index)}
                  {isCurrent ? <span className="mr-1 font-normal text-sky-700">(جاری)</span> : null}
                </span>
                <span className="text-[10px] text-slate-500">
                  <FormattedDate value={w.days[0]?.date ?? w.weekStart} /> تا <FormattedDate value={w.weekEnd} />
                </span>
              </p>
              <p className="mt-0.5 flex items-center justify-between gap-2 tabular-nums">
                <span className="text-slate-600">
                  پیشرفت هفته:{' '}
                  <span className="font-bold text-amber-700">{w.gain == null ? 'ثبت نشده' : `${faNum(w.gain)}٪`}</span>
                </span>
                <span className="text-slate-600">
                  تجمعی:{' '}
                  <span className="font-bold text-[#1e3a5f]">{w.endCumulative == null ? '—' : `${faNum(w.endCumulative)}٪`}</span>
                </span>
              </p>
            </li>
          )
        })}
      </ol>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <span className="text-[11px] text-slate-500">
          {current.weekComplete ? 'تجمعی پایان هفته (پنجشنبه)' : 'تجمعی تا امروز'}
        </span>
        <span className="text-base font-bold tabular-nums text-[#1e3a5f]">
          {current.endCumulative == null ? '—' : `${faNum(current.endCumulative)}٪`}
        </span>
      </div>
    </div>
  )
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-white px-2.5 py-1 text-sm font-medium text-slate-700">
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
      badge: 'عقب‌افتاده',
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
      badge: 'هنوز شروع نشده',
      badgeClass: 'bg-slate-100 text-slate-700',
      progressAccent: 'text-slate-700',
    }
  }
  return {
    card: 'border-slate-200',
    header: 'border-slate-100 bg-gradient-to-b from-slate-50 to-white',
    wbs: 'bg-[#1e3a5f]',
    accent: 'text-[#1e3a5f]',
    badge: 'ایام جاری',
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
        'overflow-hidden rounded-xl border bg-white shadow-sm transition-colors',
        reportedToday ? 'border-emerald-200/90 ring-1 ring-emerald-100' : theme.card
      )}
    >
      <div className={cn('border-b px-4 py-3', theme.header)}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {activity.wbs ? (
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-white',
                    theme.wbs
                  )}
                >
                  {activity.wbs}
                </span>
              ) : null}
              <p className="text-sm font-bold leading-snug text-slate-900">{activity.name}</p>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  theme.badgeClass
                )}
              >
                {theme.badge}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activity.quantity != null && activity.uom ? (
                <MetaPill>
                  مقدار برنامه:{' '}
                  <span className="font-semibold tabular-nums text-slate-800">
                    <span className="inline-flex items-center gap-1">
                      {faNum(activity.quantity)}
                      <UomStack uom={activity.uom} />
                    </span>
                  </span>
                </MetaPill>
              ) : null}
              <MetaPill>
                شروع: <FormattedDate value={activity.plannedStartDate} />
              </MetaPill>
              {activity.plannedFinishDate ? (
                <MetaPill>
                  پایان: <FormattedDate value={activity.plannedFinishDate} />
                </MetaPill>
              ) : null}
              {activity.location ? <MetaPill>محل: {activity.location}</MetaPill> : null}
            </div>
          </div>
          {reportedToday ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
              ثبت شده
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-[13.5rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-slate-100 bg-white p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`pct-${activity.id}`} className="text-[11px] font-semibold text-slate-600">
                درصد پیشرفت تجمعی امروز
              </Label>
              <span className={cn('text-lg font-bold tabular-nums', theme.progressAccent)}>
                {faNum(cumulativeAfter)}٪
              </span>
            </div>
            <ProgressBar value={cumulativeAfter} tone="amber" />
            <p className="mt-1 text-[10px] text-slate-500">
              قبلی: <span className="font-semibold tabular-nums text-slate-700">{faNum(base)}٪</span> — پیشرفت امروز:{' '}
              <span className={cn('font-semibold tabular-nums', gainToday < 0 ? 'text-red-600' : 'text-slate-700')}>
                {faNum(gainToday)}٪
              </span>
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Input
                id={`pct-${activity.id}`}
                type="number"
                min={0}
                max={100}
                value={value ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') return
                  const n = Math.min(100, Math.max(0, Number(raw)))
                  if (!Number.isNaN(n)) onChange(n)
                }}
                className="h-9 w-20 text-center text-base font-bold tabular-nums shrink-0"
                dir="ltr"
              />
              <Button
                type="button"
                size="sm"
                className="h-9 bg-[#1e3a5f] hover:bg-[#152a45] shrink-0"
                disabled={saving || value === undefined}
                onClick={() => void onSave()}
              >
                {saving ? '…' : 'ثبت'}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              'rounded-lg border p-2.5',
              reportedToday
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-dashed border-slate-200 bg-slate-50/30'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className={cn('text-[11px] font-semibold', reportedToday ? 'text-emerald-800' : 'text-slate-400')}>
                ثبت امروز
              </p>
              {reportedToday ? (
                <p className="text-lg font-bold tabular-nums leading-none text-emerald-800">
                  {faNum(todayEntry.percentComplete)}٪
                </p>
              ) : null}
            </div>
            {reportedToday ? (
              <div className="mt-1 space-y-1">
                <ProgressBar value={todayEntry.percentComplete} tone="emerald" />
                <p className="flex items-center justify-between gap-2 text-[10px] text-emerald-800/85">
                  <span>
                    پیشرفت امروز:{' '}
                    <span className="font-semibold tabular-nums">
                      {todayIncrement == null ? '—' : `${faNum(todayIncrement)}٪`}
                    </span>
                  </span>
                  {todayEntry.savedAt ? (
                    <span className="text-emerald-700/75">
                      <FormattedDate value={todayEntry.savedAt} dateTime />
                    </span>
                  ) : null}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">در انتظار ثبت امروز</p>
            )}
            <BoxEditor
              label="درصد تجمعی امروز (٪)"
              initial={todayEntry?.percentComplete ?? cumulativeAfter}
              min={0}
              max={100}
              hint={(v) => `پیشرفت امروز: ${faNum(Math.round((v - base) * 100) / 100)}٪`}
              saving={saving}
              onSave={(v) => onSaveDay(reportDate, v)}
            />
          </div>
        </div>

        <div className="min-w-0">
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
  hint,
  saving,
  onSave,
}: {
  label: string
  initial: number
  min: number
  max: number
  hint?: (value: number) => ReactNode
  saving: boolean
  onSave: (value: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const parsed = parseDraft(draft)
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
        className="mt-2 h-8"
        disabled={saving}
        onClick={() => {
          setDraft(String(Math.min(max, Math.max(min, initial))))
          setEditing(true)
        }}
      >
        ویرایش
      </Button>
    )
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-slate-200 bg-white p-2">
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
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
          className="h-8 bg-[#1e3a5f] hover:bg-[#152a45]"
          disabled={saving || !valid}
          onClick={() => void save()}
        >
          {saving ? '…' : 'ثبت'}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" disabled={saving} onClick={() => setEditing(false)}>
          انصراف
        </Button>
      </div>
      {parsed != null && valid ? (
        hint ? <p className="text-[10px] text-slate-500">{hint(parsed)}</p> : null
      ) : (
        <p className="text-[10px] text-red-600">
          عددی بین {faNum(min)} و {faNum(max)} وارد کنید
        </p>
      )}
    </div>
  )
}

/** Number typed in a box; accepts Persian/Arabic digits and «٫». */
function parseDraft(raw: string): number | null {
  const ascii = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
  if (ascii === '' || !/^\d+(\.\d+)?$/.test(ascii)) return null
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
      list.unshift({ date: previousDate, label: 'آخرین گزارش قبلی' })
    }
    return list.map((d) => {
      const entry = entryOn(activity.id, history, d.date)
      const before = cumulativeBefore(activity.id, history, d.date, baseline)
      return { ...d, entry, before, daily: todayIncrementOf(entry, before) }
    })
  }, [activity.id, baseline, history, previousDate, reportDate, week])

  if (days.length === 0) return null

  return (
    <div className="border-t border-slate-100 px-4 py-2">
      <button
        type="button"
        className="text-[11px] font-semibold text-[#1e3a5f] hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'بستن ویرایش روزهای قبل' : `ویرایش روزهای قبل (${faNum(days.length)})`}
      </button>
      {open ? (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => {
            const editing = editingDate === d.date
            const start = d.before ?? 0
            const parsed = parseDraft(draft)
            const valid = parsed != null && parsed <= 100
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
                  <div className="flex items-center gap-1.5">
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
                      aria-label={`درصد تجمعی ${d.label}`}
                    />
                    <span className={cn('text-[10px]', valid ? 'text-slate-500' : 'text-red-600')}>
                      {parsed != null && valid
                        ? `پیشرفت آن روز: ${faNum(Math.round((parsed - start) * 100) / 100)}٪`
                        : '۰ تا ۱۰۰'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-[#1e3a5f] hover:bg-[#152a45]"
                      disabled={saving || !valid}
                      onClick={() => void save()}
                    >
                      {saving ? '…' : 'ثبت'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={saving}
                      onClick={() => setEditingDate(null)}
                    >
                      انصراف
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <p className="text-sm font-bold tabular-nums text-slate-800">
                        {d.entry ? `${faNum(d.entry.percentComplete)}٪` : 'ثبت نشده'}
                      </p>
                      {d.entry ? (
                        <p className="text-[10px] text-slate-500">
                          پیشرفت آن روز: {d.daily == null ? '—' : `${faNum(d.daily)}٪`}
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
                      {d.entry ? 'ویرایش' : 'ثبت'}
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
  const reportDate = todayIso()
  const { calendar } = useScheduleCalendar()
  const todayHeading = formatTodayHeading(calendar)
  const todayShort = formatScheduleDate(reportDate, calendar)

  const [activities, setActivities] = useState<DailyReportActivity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)

  const [entries, setEntries] = useState<DailyProgressEntry[]>([])
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

  const loadActivities = useCallback(async () => {
    if (!projectId) {
      setActivities([])
      return
    }
    setActivitiesLoading(true)
    setActivitiesError(null)
    try {
      const res = await fetch(`/api/workshop/schedule-tree?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در بارگذاری برنامه')
      const nodes = (data.nodes ?? []) as ScheduleTreeNode[]
      const orphanPackages = (data.orphanPackages ?? []) as WorkshopPackageNode[]
      setActivities(buildDailyReportActivitiesFromTree(nodes, orphanPackages))
    } catch (e) {
      setActivities([])
      setActivitiesError(e instanceof Error ? e.message : 'خطا در بارگذاری برنامه')
    } finally {
      setActivitiesLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadActivities()
  }, [loadActivities])

  const [serverHistory, setServerHistory] = useState<DailyProgressEntry[] | null>(null)

  const loadServerHistory = useCallback(async () => {
    if (!projectId) {
      setServerHistory([])
      return
    }
    try {
      const res = await fetch(`/api/supervisor/daily-progress?projectId=${encodeURIComponent(projectId)}`, {
        cache: 'no-store',
      })
      const data = (await res.json().catch(() => ({}))) as {
        updates?: ServerProgressRow[]
        packageUpdates?: ServerProgressRow[]
      }
      setServerHistory(res.ok ? historyFromServer(data.updates ?? [], data.packageUpdates ?? []) : [])
    } catch {
      /* this browser's entries still drive the panel */
      setServerHistory([])
    }
  }, [projectId])

  useEffect(() => {
    setServerHistory(null)
    void loadServerHistory()
  }, [loadServerHistory])

  useScheduleViewSync(projectId ?? '', () => {
    void loadServerHistory()
  })

  const history = useMemo(() => mergeProgressHistory(serverHistory ?? [], entries), [serverHistory, entries])

  const hydrate = useCallback(() => {
    if (!projectId) return
    const stored = readProjectDailyProgress(projectId)
    setEntries(stored.entries)
    setNotesByDate(stored.notesByDate)
    setNote(stored.notesByDate[reportDate] ?? '')
    setHydrated(true)
  }, [projectId, reportDate])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const eligible = useMemo(
    () => activitiesEligibleForDailyReport(activities, entries, reportDate),
    [activities, entries, reportDate]
  )

  const eligibleByTiming = useMemo(
    () => partitionEligibleByTiming(activities, entries, reportDate),
    [activities, entries, reportDate]
  )

  const timingCounts = useMemo(
    () => ({
      current: eligibleByTiming.current.length,
      past: eligibleByTiming.past.length,
      upcoming: eligibleByTiming.upcoming.length,
    }),
    [eligibleByTiming]
  )

  const remainingCount = useMemo(
    () => countRemainingForTodayReport(activities, entries, reportDate),
    [activities, entries, reportDate]
  )

  const reportSections = useMemo(
    () =>
      (
        [
          {
            timing: 'current' as const,
            title: 'ایام جاری',
            description:
              'فعالیت‌هایی که امروز در بازه برنامه (از شروع تا پایان) هستند — برای ثبت درصد پیشرفت.',
            shellClass: 'border-sky-200 bg-sky-50/40',
            titleClass: 'text-sky-900',
          },
          {
            timing: 'past' as const,
            title: 'کارهای قبلی (عقب‌افتاده)',
            description: 'فعالیت‌های قبلی که هنوز ۱۰۰٪ نشده‌اند (گزارش کارگاه یا برنامه).',
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
          title: 'فعالیت‌های قابل گزارش امروز',
          description:
            'فعالیت‌های بازه امروز و کارهای قبلی تکمیل‌نشده — برای یافتن سریع WBS یا نام را جستجو کنید.',
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

  function persist(nextEntries: DailyProgressEntry[], nextNotes: Record<string, string>) {
    if (!projectId) return
    writeProjectDailyProgress(projectId, { entries: nextEntries, notesByDate: nextNotes })
    setEntries(nextEntries)
    setNotesByDate(nextNotes)
  }

  async function syncProgressToSchedule(nextEntries: DailyProgressEntry[], dates: string[] = [reportDate]) {
    if (!projectId) return
    await postDailyProgress(projectId, nextEntries, dates)
  }

  async function saveEntries(
    newEntries: DailyProgressEntry[],
    nextNotes?: Record<string, string>,
    toPost?: DailyProgressEntry[]
  ) {
    const nextNotesFinal = nextNotes ?? notesByDate
    persist(newEntries, nextNotesFinal)
    window.dispatchEvent(
      new CustomEvent('sitepilot-daily-progress-updated', { detail: { projectId } })
    )
    try {
      if (toPost) await syncProgressToSchedule(toPost, toPost.map((e) => e.reportDate))
      else await syncProgressToSchedule(newEntries)
      setActivitiesError(null)
      void loadServerHistory()
    } catch (error) {
      console.error(error)
      setActivitiesError(
        error instanceof Error
          ? error.message
          : 'ذخیره پیشرفت در برنامه زمانبندی ناموفق بود'
      )
    }
  }

  // Re-push local daily progress into Supabase after the schedule:uuid fix
  // so previously saved supervisor % lands in ویرایش/ارسال without retyping.
  // A newer server value (e.g. edited in the schedule) is not overwritten.
  const serverLoaded = serverHistory != null
  useEffect(() => {
    if (!hydrated || !projectId || !serverLoaded || entries.length === 0) return
    const pending = entries.filter((e) => {
      if (e.reportDate !== reportDate) return false
      const server = entryOn(e.activityId, serverHistory ?? [], reportDate)
      return !server || (e.savedAt ?? '') > (server.savedAt ?? '')
    })
    if (pending.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        await syncProgressToSchedule(pending)
        if (!cancelled) setActivitiesError(null)
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          setActivitiesError(
            error instanceof Error
              ? error.message
              : 'همگام‌سازی پیشرفت با برنامه زمانبندی ناموفق بود'
          )
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

    const entry = cumulativeEntry(activityId, history, date, percent)
    const nextEntries = upsertDailyEntries(entries, [entry])
    await saveEntries(nextEntries, undefined, withLatestReports([entry], upsertDailyEntries(history, [entry])))

    setSavingActivityId(null)
    setSavedActivityId(activityId)
    window.setTimeout(() => setSavedActivityId(null), 2500)
  }

  async function handleSubmit() {
    if (!projectId) return
    setSubmitting(true)
    setSubmitOk(false)

    const newEntries: DailyProgressEntry[] = eligible.map((a) =>
      cumulativeEntry(
        a.id,
        history,
        reportDate,
        formValues[a.id] ?? cumulativeBefore(a.id, history, reportDate, a.baselinePercentComplete ?? 0) ?? 0
      )
    )

    const nextEntries = upsertDailyEntries(entries, newEntries)
    const nextNotes = { ...notesByDate, [reportDate]: note.trim() }
    await saveEntries(nextEntries, nextNotes)

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
      if (!res.ok) throw new Error(data.error || 'خطا در پردازش گزارش صوتی')
      setVoiceParsed(data)
      setOrganizedDraft(data.organizedText)
    } catch (e) {
      setOrganizeError(e instanceof Error ? e.message : 'خطا در پردازش گزارش صوتی')
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
    setNote(organizedDraft.trim())
    setVoiceParsed(null)
    setOrganizedDraft('')
  }

  if (!projectId) {
    return (
      <p className="text-sm text-slate-500" dir="rtl" lang="fa">
        ابتدا یک پروژه انتخاب کنید.
      </p>
    )
  }

  if (!hydrated || activitiesLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        در حال بارگذاری برنامه و گزارش‌ها…
      </div>
    )
  }

  return (
    <div className="space-y-5" dir="rtl" lang="fa">
      <div className="rounded-xl border-2 border-[#1e3a5f] bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-[#1e3a5f]" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-slate-500">امروز — تاریخ گزارش روزانه</p>
              <p className="text-lg font-bold text-[#1e3a5f]">{todayHeading}</p>
              <p className="text-xs text-slate-500 tabular-nums mt-0.5">{todayShort}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-500">فعالیت قابل گزارش</p>
            <p className="text-2xl font-bold tabular-nums text-[#1e3a5f]">
              {faNum(eligible.length)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardList className="h-5 w-5 text-[#1e3a5f]" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">
            {faNum(remainingCount)} فعالیت باقی‌مانده برای ثبت امروز
          </p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          همه <strong>فعالیت‌های ایام جاری</strong> و کارهای قبلی که هنوز ۱۰۰٪ نشده‌اند اینجا می‌آیند.
          اگر فعالیت قبلی ۱۰۰٪ شود، فعالیت بعدی حتی قبل از تاریخ شروع برنامه‌ای هم برای ثبت درصد می‌آید.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => setTimingFilter('all')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition-colors',
              timingFilter === 'all'
                ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            همه ({faNum(eligible.length)})
          </button>
          <button
            type="button"
            onClick={() => setTimingFilter('current')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition-colors',
              timingFilter === 'current'
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100'
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
            ایام جاری ({faNum(timingCounts.current)})
          </button>
          <button
            type="button"
            onClick={() => setTimingFilter('past')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition-colors',
              timingFilter === 'past'
                ? 'border-amber-600 bg-amber-600 text-white'
                : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
            کار قبلی ({faNum(timingCounts.past)})
          </button>
        </div>
        <div className="mt-3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو با WBS یا نام فعالیت (مثلاً ۱.۴ یا فونداسیون)"
            className="h-9 bg-white text-sm"
          />
        </div>
      </div>

      {activitiesError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {activitiesError}
        </p>
      ) : null}

      {activities.length === 0 && !activitiesError ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          هنوز زیرشاخه از دفتر فنی ثبت نشده — در داشبورد دفتر فنی → «برنامه زمانبندی» زیرشاخه و مقدار تعریف کنید.
        </p>
      ) : null}

      {eligible.length === 0 && activities.length > 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          فعالیت واجد شرایطی برای امروز نیست (ایام جاری یا کار قبلی ناتمام).
        </p>
      ) : displaySections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          {searchQuery.trim()
            ? 'فعالیتی با این جستجو پیدا نشد.'
            : timingFilter === 'current'
              ? 'فعالیت ایام جاری برای ثبت امروز نیست.'
              : timingFilter === 'past'
                ? 'کار قبلی ناتمامی باقی نمانده است.'
                : 'فعالیت واجد شرایطی برای نمایش نیست.'}
        </p>
      ) : (
        <div className="space-y-6">
          {displaySections.map((section) =>
            section.groups.length === 0 ? null : (
              <section
                key={section.timing}
                className={cn('space-y-4 rounded-2xl border p-4', section.shellClass)}
              >
                <div>
                  <h2 className={cn('text-sm font-bold', section.titleClass)}>{section.title}</h2>
                  <p className="mt-1 text-xs text-slate-600">{section.description}</p>
                </div>
                <ul className="space-y-5">
                  {section.groups.map((group) => (
                    <li key={`${section.timing}-${group.key}`} className="space-y-3">
                      <div
                        className={cn(
                          'rounded-xl border px-4 py-3 shadow-sm',
                          section.timing === 'past'
                            ? 'border-amber-200 bg-amber-50/80'
                            : section.timing === 'upcoming'
                              ? 'border-slate-200 bg-white'
                              : section.timing === 'all'
                                ? 'border-slate-200 bg-slate-50/80'
                                : 'border-[#1e3a5f]/25 bg-[#1e3a5f]/8'
                        )}
                      >
                        <p
                          className={cn(
                            'text-[11px] font-semibold uppercase tracking-wide',
                            section.timing === 'past'
                              ? 'text-amber-800/70'
                              : section.timing === 'upcoming'
                                ? 'text-slate-500'
                                : 'text-[#1e3a5f]/70'
                          )}
                        >
                          سرتیتر فعالیت
                        </p>
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          {group.parentTaskWbs ? (
                            <span
                              className={cn(
                                'font-mono text-sm font-bold tabular-nums',
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
                          <h3 className="text-base font-bold text-slate-900">{group.parentTaskName}</h3>
                        </div>
                      </div>
                      <ul className="space-y-3">
                        {group.activities.map((activity) => (
                          <ActivityProgressRow
                            key={activity.id}
                            activity={activity}
                            history={history}
                            reportDate={reportDate}
                            timing={
                              section.timing === 'all'
                                ? classifyDailyReportTiming(activity, entries, reportDate, activities)
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
        <p className="text-sm font-medium text-emerald-700">این مورد ثبت شد.</p>
      ) : null}

      {eligible.length > 0 ? (
        <div className="sticky bottom-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="bg-[#1e3a5f] hover:bg-[#152a45]"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'در حال ثبت…' : 'ثبت گزارش امروز (همه)'}
            </Button>
            <p className="text-xs text-slate-500">
              یا برای هر فعالیت دکمه «ثبت» کنار درصد را بزنید.
            </p>
            {submitOk ? (
              <p className="text-sm font-medium text-emerald-700">گزارش امروز با موفقیت ثبت شد.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="daily-report-note" className="text-sm font-semibold text-slate-800">
            یادداشت گزارش روزانه (اختیاری)
          </Label>
          <VoiceToTextButton
            size="sm"
            disabled={organizeLoading}
            prompt="گزارش روزانه کارگاه. درصد پیشرفت، مشکلات، کمبود مصالح، HSE."
            onTranscript={(text) => void handleVoiceOrganize(text)}
          />
        </div>

        {organizeLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            در حال تبدیل و مرتب‌سازی گزارش صوتی…
          </div>
        ) : null}

        {organizeError ? <p className="text-sm text-rose-700">{organizeError}</p> : null}

        {voiceParsed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-950">پیش‌نمایش گزارش مرتب‌شده:</p>
            <Textarea
              rows={6}
              value={organizedDraft}
              onChange={(e) => setOrganizedDraft(e.target.value)}
              className="text-sm leading-relaxed bg-white"
            />
            {voiceParsed.activities.some((a) => a.percentComplete != null) ? (
              <p className="text-xs text-slate-600">
                درصد شناسایی‌شده:{' '}
                {voiceParsed.activities
                  .filter((a) => a.percentComplete != null)
                  .map((a) => `${a.wbs ?? a.name}: ${a.percentComplete}٪`)
                  .join('، ')}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applyOrganizedReport}>
                اعمال روی فرم
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
                لغو
              </Button>
            </div>
          </div>
        ) : null}

        <Textarea
          id="daily-report-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="مثلاً تأخیر تحویل میلگرد، کمبود نیرو، یا یادداشت میدانی…"
          className="text-sm"
        />
      </div>

      <Button
        type="button"
        className="w-full bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
        asChild
      >
        <Link
          href={
            projectId
              ? `/dashboard/site-supervisor/daily-reports?projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`
              : '/dashboard/site-supervisor/daily-reports'
          }
        >
          گزارش‌های ثبت‌شده قبلی
        </Link>
      </Button>
    </div>
  )
}
