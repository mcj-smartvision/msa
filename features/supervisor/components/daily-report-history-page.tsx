/**
 * @file features/supervisor/components/daily-report-history-page.tsx
 * @purpose آرشیو گزارش روزانه — فقط یادداشت و عکس (بدون درصد پیشرفت)
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
ArrowRight,
CalendarCheck,
CloudSun,
Filter,
ImageIcon,
MessageSquareText,
Search,
} from 'lucide-react'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
extractAiHighlightNote,
formatReportSavedTimestamp,
formatReportTitle,
HISTORY_PAGE_SIZE,
} from '@/features/supervisor/lib/daily-report-history'
import type { ArchivedDailyReportRow } from '@/features/supervisor/lib/daily-report-archive'
import { ArchiveA4Preview } from '@/features/supervisor/components/archive-a4-preview'
import { extractWeatherLine } from '@/features/weather/lib/report-stamp'
import { cn } from '@/shared/lib/utils'
import type { DailyReportPhotoItem } from '@/features/supervisor/lib/daily-report-photos'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'

const t = getSiteSupervisorMessages('fa')

function faNum(n: number): string {
  return n.toLocaleString('fa-IR-u-nu-latn')
}

export function DailyReportHistoryPage() {
  const searchParams = useSearchParams()
  const urlProjectId = searchParams.get('projectId')
  const projectId = useSyncedProjectId(urlProjectId) ?? urlProjectId ?? ''
  const urlName = searchParams.get('projectName') ?? ''
  const [projectName, setProjectName] = useState(urlName)
  const { calendar } = useScheduleCalendar()
  const supabase = useSupabase()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [archiveRows, setArchiveRows] = useState<ArchivedDailyReportRow[]>([])
  const [photosByDate, setPhotosByDate] = useState<Record<string, DailyReportPhotoItem[]>>({})
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
      setArchiveRows([])
      setPhotosByDate({})
      setLoadError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    try {
      const [archiveRes, photosRes] = await Promise.all([
        fetch(`/api/supervisor/daily-report-archive?projectId=${encodeURIComponent(projectId)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/supervisor/daily-report-photos?projectId=${encodeURIComponent(projectId)}`, {
          cache: 'no-store',
        }),
      ])
      const archiveJson = (await archiveRes.json().catch(() => ({}))) as {
        reports?: ArchivedDailyReportRow[]
        error?: string
        message?: string
      }
      if (!archiveRes.ok) {
        throw new Error(archiveJson.message || archiveJson.error || t.workflowLoadFailed)
      }
      setArchiveRows(Array.isArray(archiveJson.reports) ? archiveJson.reports : [])

      const photosJson = await photosRes.json().catch(() => ({}))
      if (photosRes.ok && photosJson.photosByDate && typeof photosJson.photosByDate === 'object') {
        setPhotosByDate(photosJson.photosByDate as Record<string, DailyReportPhotoItem[]>)
      } else {
        setPhotosByDate({})
      }
    } catch (e) {
      setArchiveRows([])
      setLoadError(e instanceof Error ? e.message : t.workflowLoadFailed)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase()
    return archiveRows.filter((row) => {
      if (monthFilter && !row.reportDate.startsWith(monthFilter)) return false
      if (!q) return true
      if (row.note.toLowerCase().includes(q)) return true
      if (row.reportNo.toLowerCase().includes(q)) return true
      const photos = photosByDate[row.reportDate] ?? []
      return photos.some(
        (p) =>
          p.dailyReportId === row.id ||
          p.reportNo.toLowerCase().includes(q) ||
          p.fileName.toLowerCase().includes(q)
      )
    })
  }, [archiveRows, search, monthFilter, photosByDate])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100/80" dir="rtl" lang="fa">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 pb-12">
        <div className="space-y-4">
          <Button type="button" variant="ghost" size="sm" className="-mr-2 text-slate-600" asChild>
            <Link href="/dashboard/site-supervisor?section=daily-report">
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
              {t.backToDashboard}
            </Link>
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t.historyTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {t.reportsRecorded(faNum(archiveRows.length))}
                {projectName ? (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>
                    {projectName}
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.historyHint}</p>
            </div>
            <Button type="button" size="sm" variant="outline" className="bg-white" asChild>
              <Link
                href={
                  projectId
                    ? `/dashboard/site-supervisor?section=report-background&projectId=${encodeURIComponent(projectId)}`
                    : '/dashboard/site-supervisor?section=report-background'
                }
              >
                {t.previousProgressHistory}
              </Link>
            </Button>
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
              className={cn('bg-white shrink-0', monthFilter && 'border-slate-900 text-slate-900')}
              onClick={() => {
                if (monthFilter) {
                  setMonthFilter('')
                  return
                }
                const latest = archiveRows[0]?.reportDate
                if (latest) setMonthFilter(latest.slice(0, 7))
              }}
            >
              <Filter className="h-4 w-4 ml-1" aria-hidden="true" />
              {monthFilter ? t.clearDateFilter : t.filterCurrentMonth}
            </Button>
          </div>
        </div>

        {loadError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
          </p>
        ) : null}

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
                <Skeleton className="h-20 w-full" />
              </li>
            ))}
          </ul>
        ) : filteredReports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-600">
            {archiveRows.length === 0 ? t.noReportsYet : t.noFilterResults}
          </p>
        ) : (
          <>
            <ul className="space-y-4">
              {filteredReports.slice(0, visibleCount).map((row) => {
                const { timeLabel } = formatReportSavedTimestamp(
                  row.reportDate,
                  row.submittedAt,
                  calendar
                )
                const title = formatReportTitle(row.reportDate, calendar)
                const highlightNote = extractAiHighlightNote(row.note)
                const weatherNote = row.weather?.lineFa ?? extractWeatherLine(row.note)
                const photos = (photosByDate[row.reportDate] ?? []).filter(
                  (p) => p.dailyReportId === row.id || !p.dailyReportId
                )
                const dayPhotos =
                  photos.length > 0 ? photos : (photosByDate[row.reportDate] ?? [])

                return (
                  <li
                    key={row.id}
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
                            <>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span className="font-mono">{row.reportNo}</span>
                            </>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {row.status === 'approved' ? (
                          <span className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                            {t.archiveStatusApproved}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                            {t.archiveStatusAwaitingManager}
                          </span>
                        )}
                        {dayPhotos.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-3 py-1 text-xs font-medium text-violet-800">
                            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                            {t.photosAttached(faNum(dayPhotos.length))}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {weatherNote ? (
                      <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                        <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p className="leading-relaxed">{weatherNote}</p>
                      </div>
                    ) : null}

                    {highlightNote ? (
                      <div className="mx-4 mb-4 mt-3 rounded-xl bg-orange-50 border border-orange-100/80 px-4 py-3 flex gap-3">
                        <MessageSquareText
                          className="h-5 w-5 text-orange-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-slate-700 leading-relaxed">{highlightNote}</p>
                      </div>
                    ) : (
                      <p className="mx-4 mt-3 mb-2 text-xs text-slate-400 whitespace-pre-wrap">
                        {row.note && row.note !== '—' ? row.note : t.noNoteBody}
                      </p>
                    )}

                    {dayPhotos.length > 0 ? (
                      <div className="mx-4 mb-4 space-y-2">
                        <p className="text-xs font-semibold text-slate-600">{t.photoSectionTitle}</p>
                        <ul className="grid grid-cols-3 gap-2">
                          {dayPhotos.map((photo) => (
                            <li key={photo.id} className="overflow-hidden rounded-lg border border-slate-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt={photo.fileName}
                                className="h-24 w-full object-cover"
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="mx-4 mb-4 border-t border-slate-100 pt-3">
                      <ArchiveA4Preview row={row} projectName={projectName} />
                    </div>
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
