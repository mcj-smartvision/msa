/**
 * @file features/supervisor/components/daily-report-history-page.tsx
 * @purpose کامپوننت UI — سرپرست کارگاه و گزارش روزانه (daily-report-history-page)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on shared/hooks/use-synced-project-id, shared/hooks/use-supabase, features/schedule/hooks/use-schedule-calendar, shared/components/ui/button, shared/components/ui/input, shared/components/ui/skeleton, features/supervisor/lib/daily-report-history, features/supervisor/lib/daily-progress-storage, features/weather/lib/report-stamp, features/weather/lib/types
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import { useSupabase } from '@/shared/hooks/use-supabase'
import {
AlertTriangle,
ArrowRight,
CalendarCheck,
CloudSun,
Filter,
MessageSquareText,
Search,
} from 'lucide-react'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
buildDayReports,
extractAiHighlightNote,
formatReportSavedTimestamp,
formatReportTitle,
HISTORY_PAGE_SIZE,
progressDeltaLabel,
REPORT_PROGRESS_BAR_COLORS,
} from '@/features/supervisor/lib/daily-report-history'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import { ensureWeatherLine, extractWeatherLine, parseWeatherSnapshot } from '@/features/weather/lib/report-stamp'
import type { DailyWeatherSnapshot } from '@/features/weather/lib/types'
import { useStoreProgress } from '@/features/project-store/use-store-progress'
import {
buildDailyReportActivitiesFromTree,
getLatestProgressForActivity,
type DailyProgressEntry,
type DailyReportActivity,
} from '@/features/supervisor/lib/daily-report-activities'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import { cn } from '@/shared/lib/utils'
import { SUPERVISOR_COPY } from '@/features/supervisor/config'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'

const t = getSiteSupervisorMessages('fa')

function faNum(n: number): string {
  return n.toLocaleString('fa-IR-u-nu-latn')
}

function activityLabel(act: DailyReportActivity | undefined, fallbackId: string): string {
  if (!act) return fallbackId
  return act.name
}

function prevPercentBeforeDay(
  activityId: string,
  reportDate: string,
  allEntries: DailyProgressEntry[]
): number | null {
  const prev = getLatestProgressForActivity(activityId, allEntries, reportDate)
  return prev?.percentComplete ?? null
}

const DROP_TITLE = t.dropTitle

function ReportProgressRow({
  name,
  previousPct,
  currentPct,
  barColor,
}: {
  name: string
  /** null for the activity's first report. */
  previousPct: number | null
  currentPct: number
  barColor: string
}) {
  const shownPrevious = previousPct ?? 0
  const dropped = previousPct != null && currentPct < previousPct
  return (
    <div className="py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <p className="text-sm font-medium text-slate-800 leading-snug">{name}</p>
        <div className="flex items-center gap-1.5 text-sm tabular-nums shrink-0">
          {dropped ? (
            <span title={DROP_TITLE} aria-label={DROP_TITLE} className="inline-flex">
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
            </span>
          ) : null}
          <span className={cn('font-bold', dropped ? 'text-red-600' : 'text-slate-900')}>
            {SUPERVISOR_COPY.pct(faNum(currentPct))}
          </span>
          {shownPrevious !== currentPct ? (
            <>
              <span className="text-slate-300" aria-hidden="true">←</span>
              <span className="text-slate-400">{SUPERVISOR_COPY.pct(faNum(shownPrevious))}</span>
            </>
          ) : null}
        </div>
      </div>
      {previousPct != null ? (
        <p className={cn('mb-1.5 text-[11px] tabular-nums', dropped ? 'text-red-600' : 'text-slate-500')} dir="rtl">
          {progressDeltaLabel(previousPct, currentPct)}
        </p>
      ) : null}
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, currentPct)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

export function DailyReportHistoryPage() {
  const searchParams = useSearchParams()
  const urlProjectId = searchParams.get('projectId')
  const projectId = useSyncedProjectId(urlProjectId) ?? urlProjectId ?? ''
  const storeProgress = useStoreProgress(projectId || null)
  const urlName = searchParams.get('projectName') ?? ''
  const [projectName, setProjectName] = useState(urlName)
  const { calendar } = useScheduleCalendar()
  const supabase = useSupabase()

  const [activities, setActivities] = useState<DailyReportActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<DailyProgressEntry[]>([])
  const [notesByDate, setNotesByDate] = useState<Record<string, string>>({})
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DailyWeatherSnapshot>>({})
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE)
  }, [search, monthFilter, projectId])

  useEffect(() => {
    if (!projectId) {
      setProjectName('')
      return
    }
    if (urlProjectId === projectId && urlName) {
      setProjectName(urlName)
    }
    let cancelled = false
    void supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name) setProjectName(String(data.name))
      })
    return () => {
      cancelled = true
    }
  }, [projectId, urlName, urlProjectId, supabase])

  const load = useCallback(async () => {
    if (!projectId) {
      setActivities([])
      setEntries([])
      setNotesByDate({})
      setWeatherByDate({})
      setLoading(false)
      return
    }
    const stored = readProjectDailyProgress(projectId)
    setEntries(storeProgress.entries ?? stored.entries)
    setNotesByDate(stored.notesByDate)

    setLoading(true)
    try {
      const [treeRes, progressRes] = await Promise.all([
        fetch(`/api/workshop/schedule-tree?projectId=${projectId}`),
        fetch(`/api/supervisor/daily-progress?projectId=${encodeURIComponent(projectId)}`, {
          cache: 'no-store',
        }),
      ])
      const data = await treeRes.json()
      if (treeRes.ok) {
        const nodes = (data.nodes ?? []) as ScheduleTreeNode[]
        const orphanPackages = (data.orphanPackages ?? []) as WorkshopPackageNode[]
        setActivities(buildDailyReportActivitiesFromTree(nodes, orphanPackages))
      }
      const progressJson = await progressRes.json().catch(() => ({}))
      if (progressRes.ok) {
        const remoteNotes =
          progressJson.notes && typeof progressJson.notes === 'object'
            ? (progressJson.notes as Record<string, string>)
            : {}
        const remoteWeather =
          progressJson.weather && typeof progressJson.weather === 'object'
            ? (progressJson.weather as Record<string, unknown>)
            : {}
        const parsedWeather: Record<string, DailyWeatherSnapshot> = {}
        const notesWithWeather = { ...stored.notesByDate, ...remoteNotes }
        for (const [date, value] of Object.entries(remoteWeather)) {
          const snap = parseWeatherSnapshot(value)
          if (!snap) continue
          parsedWeather[date] = snap
          notesWithWeather[date] = ensureWeatherLine(notesWithWeather[date] ?? '', snap.lineFa)
        }
        setWeatherByDate(parsedWeather)
        setNotesByDate(notesWithWeather)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId, storeProgress.entries])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (storeProgress.entries) setEntries(storeProgress.entries)
  }, [storeProgress.entries])

  const activityById = useMemo(
    () => new Map(activities.map((a) => [a.id, a])),
    [activities]
  )

  const dayReports = useMemo(
    () => buildDayReports(entries, notesByDate),
    [entries, notesByDate]
  )

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dayReports.filter((day) => {
      if (monthFilter && !day.reportDate.startsWith(monthFilter)) return false
      if (!q) return true
      if (day.note.toLowerCase().includes(q)) return true
      return day.entries.some((entry) => {
        const act = activityById.get(entry.activityId)
        if (!act) return entry.activityId.toLowerCase().includes(q)
        return (
          act.name.toLowerCase().includes(q) ||
          (act.wbs?.toLowerCase().includes(q) ?? false)
        )
      })
    })
  }, [dayReports, search, monthFilter, activityById])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100/80" dir="rtl" lang="fa">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 pb-12">
        <div className="space-y-4">
          <Button type="button" variant="ghost" size="sm" className="-mr-2 text-slate-600" asChild>
            <Link href="/dashboard/site-supervisor">
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
              {t.backToDashboard}
            </Link>
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t.historyTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {t.reportsRecorded(faNum(dayReports.length))}
                {projectName ? (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>
                    {projectName}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t.searchActivity}
                className="pr-9 bg-white border-slate-200"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'bg-white shrink-0',
                monthFilter && 'border-slate-900 text-slate-900'
              )}
              onClick={() => {
                if (monthFilter) {
                  setMonthFilter('')
                  return
                }
                const latest = dayReports[0]?.reportDate
                if (latest) setMonthFilter(latest.slice(0, 7))
              }}
            >
              <Filter className="h-4 w-4 ml-1" aria-hidden="true" />
              {monthFilter ? t.clearDateFilter : t.filterCurrentMonth}
            </Button>
          </div>
        </div>

        {!projectId ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-600">
            {t.projectUnknown}
          </p>
        ) : loading ? (
          <ul className="space-y-4" aria-busy="true" aria-label={t.loading}>
            {[0, 1, 2].map((i) => (
              <li key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-1.5 w-full" />
              </li>
            ))}
          </ul>
        ) : filteredReports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-600">
            {dayReports.length === 0
              ? t.noReportsYet
              : t.noFilterResults}
          </p>
        ) : (
          <>
          <ul className="space-y-4">
            {filteredReports.slice(0, visibleCount).map((day) => {
              const { timeLabel } = formatReportSavedTimestamp(
                day.reportDate,
                day.savedAt,
                calendar
              )
              const title = formatReportTitle(day.reportDate, calendar)
              const highlightNote = extractAiHighlightNote(day.note)
              const weatherNote = weatherByDate[day.reportDate]?.lineFa ?? extractWeatherLine(day.note)
              const sortedEntries = [...day.entries].sort((a, b) => {
                const aw = activityById.get(a.activityId)?.wbs ?? ''
                const bw = activityById.get(b.activityId)?.wbs ?? ''
                return aw.localeCompare(bw, undefined, { numeric: true })
              })

              return (
                <li
                  key={day.reportDate}
                  className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm"
                        aria-hidden="true"
                      >
                        <CalendarCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{title}</p>
                        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {timeLabel ?? '—'}
                          <span className="mx-1.5 text-slate-300">·</span>
                          {t.supervisorRole}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-sky-50 border border-sky-100 px-3 py-1 text-xs font-medium text-sky-800 shrink-0">
                      {t.itemsReported(faNum(day.entries.length))}
                    </span>
                  </div>

                  {weatherNote ? (
                    <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                      <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p className="leading-relaxed">{weatherNote}</p>
                    </div>
                  ) : null}

                  <div className="px-4 pt-2 pb-1">
                    {sortedEntries.map((entry, idx) => {
                      const act = activityById.get(entry.activityId)
                      const prev = prevPercentBeforeDay(
                        entry.activityId,
                        day.reportDate,
                        entries
                      )
                      return (
                        <ReportProgressRow
                          key={`${entry.activityId}-${day.reportDate}`}
                          name={activityLabel(act, entry.activityId)}
                          previousPct={prev}
                          currentPct={entry.percentComplete}
                          barColor={
                            REPORT_PROGRESS_BAR_COLORS[
                              idx % REPORT_PROGRESS_BAR_COLORS.length
                            ]
                          }
                        />
                      )
                    })}
                  </div>

                  {highlightNote ? (
                    <div className="mx-4 mb-4 mt-2 rounded-xl bg-orange-50 border border-orange-100/80 px-4 py-3 flex gap-3">
                      <MessageSquareText
                        className="h-5 w-5 text-orange-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-slate-700 leading-relaxed">{highlightNote}</p>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {filteredReports.length > visibleCount ? (
            <div className="flex flex-col items-center gap-1">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 bg-white"
                onClick={() => setVisibleCount((n) => n + HISTORY_PAGE_SIZE)}
              >
                {t.showMore}
              </Button>
              <p className="text-xs text-slate-500 tabular-nums">
                {t.ofReports(
                  visibleCount.toLocaleString('en-US'),
                  filteredReports.length.toLocaleString('en-US')
                )}
              </p>
            </div>
          ) : null}
          </>
        )}
      </div>
    </div>
  )
}
