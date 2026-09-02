'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays, ClipboardList, Loader2 } from 'lucide-react'
import { useScheduleCalendar } from '@/hooks/useScheduleCalendar'
import { formatScheduleDate } from '@/lib/schedule/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormattedDate } from '@/components/schedule/formatted-date'
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
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/lib/workshop/types'
import type { ParsedDailyReportVoice } from '@/lib/supervisor/parse-daily-report-voice'
import { VoiceToTextButton } from '@/components/shared/voice-to-text-button'
import { cn } from '@/lib/utils'

function faNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function previousProgressInfo(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  reportDate: string
): { percent: number | null; date: string | null; neverReported: boolean; fromBaseline?: boolean } {
  const latestBeforeToday = getLatestProgressForActivity(activity.id, entries, reportDate)
  if (latestBeforeToday) {
    return {
      percent: latestBeforeToday.percentComplete,
      date: latestBeforeToday.reportDate,
      neverReported: false,
    }
  }
  const baseline = activity.baselinePercentComplete ?? 0
  if (baseline > 0) {
    return { percent: baseline, date: null, neverReported: false, fromBaseline: true }
  }
  return { percent: null, date: null, neverReported: true }
}

function todayProgressEntry(
  activityId: string,
  entries: DailyProgressEntry[],
  reportDate: string
): DailyProgressEntry | null {
  return entries.find((e) => e.activityId === activityId && e.reportDate === reportDate) ?? null
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

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] text-slate-600">
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
  entries,
  reportDate,
  value,
  onChange,
  onSave,
  saving,
  timing = 'current',
}: {
  activity: DailyReportActivity
  entries: DailyProgressEntry[]
  reportDate: string
  value: number | undefined
  onChange: (pct: number) => void
  onSave: () => void
  saving: boolean
  timing?: DailyReportTiming
}) {
  const theme = timingTheme(timing)
  const previous = previousProgressInfo(activity, entries, reportDate)
  const todayEntry = todayProgressEntry(activity.id, entries, reportDate)
  const reportedToday = todayEntry != null
  const displayPct = value ?? todayEntry?.percentComplete ?? previous.percent ?? 0

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
                    {faNum(activity.quantity)} {activity.uom}
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

      <div className="grid gap-3 p-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`pct-${activity.id}`} className="text-[11px] font-semibold text-slate-600">
              درصد پیشرفت امروز
            </Label>
            <span className={cn('text-2xl font-bold tabular-nums', theme.progressAccent)}>
              {faNum(displayPct)}٪
            </span>
          </div>
          <ProgressBar value={displayPct} tone="amber" />
          <div className="mt-3 flex flex-wrap items-end gap-2">
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
              className="h-12 w-28 text-center text-xl font-bold tabular-nums shrink-0"
              dir="ltr"
            />
            <Button
              type="button"
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#152a45] shrink-0"
              disabled={saving || value === undefined}
              onClick={onSave}
            >
              {saving ? '…' : reportedToday ? 'به‌روزرسانی' : 'ثبت'}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'rounded-lg border p-3',
            reportedToday
              ? 'border-emerald-200 bg-emerald-50/50'
              : 'border-dashed border-slate-200 bg-slate-50/30'
          )}
        >
          <p
            className={cn(
              'text-[11px] font-semibold uppercase tracking-wide',
              reportedToday ? 'text-emerald-800' : 'text-slate-400'
            )}
          >
            ثبت امروز
          </p>
          {reportedToday ? (
            <div className="mt-2 space-y-2">
              <p className="text-2xl font-bold tabular-nums leading-none text-emerald-800">
                {faNum(todayEntry.percentComplete)}٪
              </p>
              <p className="text-[11px] text-emerald-800/85">
                تاریخ گزارش: <FormattedDate value={todayEntry.reportDate} />
              </p>
              {todayEntry.savedAt ? (
                <p className="text-[10px] text-emerald-700/75">
                  زمان ثبت: <FormattedDate value={todayEntry.savedAt} dateTime />
                </p>
              ) : null}
              <ProgressBar value={todayEntry.percentComplete} tone="emerald" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">در انتظار ثبت امروز</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            پیشرفت قبلی
          </p>
          {previous.neverReported ? (
            <p className="mt-2 text-sm font-semibold text-amber-700">هنوز گزارش نشده</p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-2xl font-bold tabular-nums leading-none text-[#1e3a5f]">
                {faNum(previous.percent ?? 0)}٪
              </p>
              {previous.fromBaseline ? (
                <p className="text-[11px] text-slate-500">از درصد ثبت‌شده در برنامه</p>
              ) : previous.date ? (
                <p className="text-[11px] text-slate-500">
                  تاریخ: <FormattedDate value={previous.date} />
                </p>
              ) : null}
              <ProgressBar value={previous.percent ?? 0} tone="navy" />
            </div>
          )}
        </div>
      </div>
    </li>
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
  const [timingFilter, setTimingFilter] = useState<'all' | DailyReportTiming>('all')
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
            description: 'فعالیت‌هایی که امروز در بازه برنامه (شروع تا پایان) هستند یا قبلاً پیشرفت ثبت شده.',
            shellClass: 'border-sky-200 bg-sky-50/40',
            titleClass: 'text-sky-900',
          },
          {
            timing: 'past' as const,
            title: 'کارهای قبلی (عقب‌افتاده)',
            description: 'فعالیت‌های شروع‌شده که از بازه برنامه گذشته‌اند و هنوز ۱۰۰٪ نشده‌اند.',
            shellClass: 'border-amber-200 bg-amber-50/40',
            titleClass: 'text-amber-900',
          },
          {
            timing: 'upcoming' as const,
            title: 'برنامه آینده',
            description: 'فعالیت‌هایی که هنوز شروع نشده‌اند و پیشرفتی ثبت نشده.',
            shellClass: 'border-slate-200 bg-slate-50/60',
            titleClass: 'text-slate-700',
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
          title: 'همه فعالیت‌های زیر ۱۰۰٪',
          description:
            'تمام فعالیت‌های قابل گزارش در یک لیست — برای یافتن سریع WBS یا نام را جستجو کنید.',
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
      const todayEntry = entries.find(
        (e) => e.activityId === a.id && e.reportDate === reportDate
      )
      if (todayEntry) {
        initial[a.id] = todayEntry.percentComplete
      } else {
        const prev = getLatestProgressForActivity(a.id, entries, reportDate)
        initial[a.id] = prev?.percentComplete ?? a.baselinePercentComplete ?? 0
      }
    }
    setFormValues(initial)
  }, [hydrated, eligible, entries, reportDate])

  function persist(nextEntries: DailyProgressEntry[], nextNotes: Record<string, string>) {
    if (!projectId) return
    writeProjectDailyProgress(projectId, { entries: nextEntries, notesByDate: nextNotes })
    setEntries(nextEntries)
    setNotesByDate(nextNotes)
  }

  function saveEntries(newEntries: DailyProgressEntry[], nextNotes?: Record<string, string>) {
    const nextNotesFinal = nextNotes ?? notesByDate
    persist(newEntries, nextNotesFinal)
    window.dispatchEvent(
      new CustomEvent('sitepilot-daily-progress-updated', { detail: { projectId } })
    )
  }

  function handleSaveSingle(activityId: string) {
    if (!projectId) return
    setSavingActivityId(activityId)
    setSavedActivityId(null)

    const pct = formValues[activityId] ?? 0
    const nextEntries = upsertDailyEntries(entries, [
      { activityId, reportDate, percentComplete: pct },
    ])
    saveEntries(nextEntries)

    setSavingActivityId(null)
    setSavedActivityId(activityId)
    window.setTimeout(() => setSavedActivityId(null), 2500)
  }

  function handleSubmit() {
    if (!projectId) return
    setSubmitting(true)
    setSubmitOk(false)

    const newEntries: DailyProgressEntry[] = eligible.map((a) => ({
      activityId: a.id,
      reportDate,
      percentComplete: formValues[a.id] ?? 0,
    }))

    const nextEntries = upsertDailyEntries(entries, newEntries)
    const nextNotes = { ...notesByDate, [reportDate]: note.trim() }
    saveEntries(nextEntries, nextNotes)

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
          همه <strong>زیرشاخه‌های دفتر فنی</strong> و فعالیت‌های برنامه که هنوز ۱۰۰٪ نشده‌اند در سیستم
          هستند — با «همه» یا جستجو (مثلاً WBS مثل ۱.۴) پیدا کنید. درصد امروز را ثبت کنید.
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
          {timingCounts.upcoming > 0 ? (
            <button
              type="button"
              onClick={() => setTimingFilter('upcoming')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition-colors',
                timingFilter === 'upcoming'
                  ? 'border-slate-600 bg-slate-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              آینده ({faNum(timingCounts.upcoming)})
            </button>
          ) : null}
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
          همه فعالیت‌ها ۱۰۰٪ ثبت شده‌اند.
        </p>
      ) : displaySections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          {searchQuery.trim()
            ? 'فعالیتی با این جستجو پیدا نشد.'
            : 'همه فعالیت‌ها ۱۰۰٪ ثبت شده‌اند.'}
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
                            entries={entries}
                            reportDate={reportDate}
                            timing={
                              section.timing === 'all'
                                ? classifyDailyReportTiming(activity, entries, reportDate)
                                : section.timing
                            }
                            value={formValues[activity.id]}
                            onChange={(pct) =>
                              setFormValues((prev) => ({ ...prev, [activity.id]: pct }))
                            }
                            onSave={() => handleSaveSingle(activity.id)}
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
