'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { formatScheduleDate } from '@/features/schedule/lib/dates'
import { useScheduleViewSync } from '@/features/schedule/lib/schedule-view-sync'
import {
buildDailyReportActivitiesFromTree,
type DailyProgressEntry,
} from '@/features/supervisor/lib/daily-report-activities'
import {
readProjectDailyProgress,
upsertDailyEntries,
writeProjectDailyProgress,
} from '@/features/supervisor/lib/daily-progress-storage'
import { deleteDailyProgress, postDailyProgress } from '@/features/supervisor/lib/daily-progress-sync'
import {
buildProgressLedgerRows,
ledgerDateRange,
plannedProgressFrom,
plannedWorkdays,
type PlannedDay,
} from '@/features/supervisor/lib/progress-ledger'
import {
calendarDays,
cumulativeEntry,
historyFromServer,
latestReport,
mergeProgressHistory,
reportedDays,
type ReportedDayProgress,
type ServerProgressRow,
withLatestReports,
withoutDay,
} from '@/features/supervisor/lib/weekly-activity-progress'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import { cn } from '@/shared/lib/utils'

const WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const NAME_COL = 280
const TOTAL_COL = 64

const faNum = (n: number) => n.toLocaleString('fa-IR')
const todayIso = () => new Date().toISOString().slice(0, 10)
/** 0 = Saturday … 6 = Friday. */
const siteWeekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 1) % 7

function parseDraft(raw: string): number | null {
  const ascii = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
  if (ascii === '' || !/^\d+(\.\d+)?$/.test(ascii)) return null
  return Number(ascii)
}

/** Imported names often start with their own WBS (in Persian digits). */
const nameHasWbs = (name: string, wbs: string) =>
  name.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim().startsWith(wbs)

type Tree = { nodes: ScheduleTreeNode[]; orphanPackages: WorkshopPackageNode[] }

/**
 * Every daily-report percent of the project on one sheet: the latest schedule's rows against each
 * calendar day from the first to the last project day. A cell is that day's progress and can be edited.
 */
export function DailyReportBackgroundPanel({ projectId }: { projectId: string | null }) {
  const { calendar } = useScheduleCalendar()
  const today = todayIso()
  const [tree, setTree] = useState<Tree | null>(null)
  const [serverHistory, setServerHistory] = useState<DailyProgressEntry[]>([])
  const [localEntries, setLocalEntries] = useState<DailyProgressEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ activityId: string; date: string } | null>(null)
  const [draft, setDraft] = useState('')
  /** Unsaved cumulative percents by `activityId@date`; null removes that day's report. */
  const [drafts, setDrafts] = useState<Record<string, number | null>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledToToday = useRef(false)

  const loadHistory = useCallback(async () => {
    if (!projectId) return
    const res = await fetch(`/api/supervisor/daily-progress?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
    const data = (await res.json().catch(() => ({}))) as { updates?: ServerProgressRow[]; packageUpdates?: ServerProgressRow[]; error?: string }
    if (!res.ok) throw new Error(data.error || 'خواندن گزارش‌های روزانه ناموفق بود')
    setServerHistory(historyFromServer(data.updates ?? [], data.packageUpdates ?? []))
    setLocalEntries(readProjectDailyProgress(projectId).entries)
  }, [projectId])

  const load = useCallback(async () => {
    if (!projectId) {
      setTree(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [treeRes] = await Promise.all([
        fetch(`/api/workshop/schedule-tree?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }),
        loadHistory(),
      ])
      const data = await treeRes.json()
      if (!treeRes.ok) throw new Error(data.error || 'خطا در بارگذاری برنامه زمانبندی')
      setTree({ nodes: data.nodes ?? [], orphanPackages: data.orphanPackages ?? [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری')
    } finally {
      setLoading(false)
    }
  }, [projectId, loadHistory])

  // Loads on open and again whenever the schedule or a report is saved anywhere.
  useScheduleViewSync(projectId ?? '', () => void load())

  const activities = useMemo(
    () => (tree ? buildDailyReportActivitiesFromTree(tree.nodes, tree.orphanPackages) : []),
    [tree]
  )
  const baselineOf = useMemo(() => new Map(activities.map((a) => [a.id, a.baselinePercentComplete ?? 0])), [activities])
  const rows = useMemo(
    () => (tree ? buildProgressLedgerRows(tree.nodes, tree.orphanPackages, activities) : []),
    [tree, activities]
  )
  const history = useMemo(() => mergeProgressHistory(serverHistory, localEntries), [serverHistory, localEntries])

  /** Saved history with the drafts applied day by day, the entries they set and the days they remove. */
  const { preview, changed, removed } = useMemo(() => {
    let working = history
    const out: DailyProgressEntry[] = []
    const removed: { activityId: string; reportDate: string }[] = []
    for (const [key, value] of Object.entries(drafts).sort(([a], [b]) => a.localeCompare(b))) {
      const at = key.lastIndexOf('@')
      const activityId = key.slice(0, at)
      const date = key.slice(at + 1)
      if (value == null) {
        working = withoutDay(activityId, working, date)
        removed.push({ activityId, reportDate: date })
        continue
      }
      const entry = cumulativeEntry(activityId, working, date, value)
      working = upsertDailyEntries(working, [entry])
      out.push(entry)
    }
    return { preview: working, changed: out, removed }
  }, [history, drafts])

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

  /** Required progress of each activity over its scheduled start–finish. */
  const plannedByActivity = useMemo(() => {
    const out = new Map<string, Map<string, PlannedDay>>()
    for (const row of rows) {
      if (!row.activityId || !row.startDate) continue
      out.set(row.activityId, plannedProgressFrom(row.startDate, plannedWorkdays(row.startDate, row.finishDate)))
    }
    return out
  }, [rows])

  /** From the project's scheduled start to its scheduled finish, widened to cover reports and today. */
  const days = useMemo(() => {
    const reported = preview.filter((e) => e.percentComplete > 0).map((e) => e.reportDate)
    const range = ledgerDateRange(rows, [today, ...reported])
    return range ? calendarDays(range.from, range.to) : []
  }, [rows, preview, today])

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.wbs ?? '').toLowerCase().includes(q))
  }, [rows, query])

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
    const cumulative = cellsByActivity.get(activityId)?.get(date)?.cumulative
    setDraft(cumulative == null ? '' : String(cumulative))
    setEditing({ activityId, date })
  }

  /** Keeps the typed value as a draft; nothing is saved until «ذخیره». */
  function commitCell() {
    if (!editing) return
    const { activityId, date } = editing
    const key = `${activityId}@${date}`
    const value = parseDraft(draft)
    if (value == null ? draft.trim() !== '' : value > 100) return
    setEditing(null)
    const saved = savedCells.get(activityId)?.get(date)?.cumulative ?? null
    setDrafts((prev) => {
      const next = { ...prev }
      if (value === saved) delete next[key]
      else next[key] = value
      return next
    })
  }

  async function saveAll() {
    if (!projectId || saving || draftCount === 0) return
    setSaving(true)
    setError(null)
    setSavedMsg(null)
    try {
      const stored = readProjectDailyProgress(projectId)
      let nextLocal = stored.entries
      for (const r of removed) nextLocal = withoutDay(r.activityId, nextLocal, r.reportDate)
      nextLocal = upsertDailyEntries(nextLocal, changed)
      writeProjectDailyProgress(projectId, { ...stored, entries: nextLocal })
      setLocalEntries(nextLocal)
      window.dispatchEvent(new CustomEvent('sitepilot-daily-progress-updated', { detail: { projectId } }))
      await deleteDailyProgress(projectId, removed)
      const toPost = withLatestReports(changed, preview)
      for (const activityId of new Set(removed.map((r) => r.activityId))) {
        const latest = latestReport(activityId, preview)
        if (latest && !toPost.some((e) => e.activityId === activityId && e.reportDate === latest.reportDate)) {
          toPost.push({ ...latest, activityId })
        }
      }
      await postDailyProgress(projectId, toPost, toPost.map((r) => r.reportDate))
      await loadHistory()
      setSavedMsg(`${faNum(draftCount)} تغییر ذخیره شد.`)
      setDrafts({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره ناموفق بود')
    } finally {
      setSaving(false)
    }
  }

  if (!projectId) return <p className="text-sm text-muted-foreground">ابتدا یک پروژه انتخاب کنید.</p>
  if (!tree) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری برنامه و گزارش‌ها…
        {error ? <span className="text-red-600">{error}</span> : null}
      </div>
    )
  }

  const draftValue = parseDraft(draft)
  const draftInvalid = editing != null && draft.trim() !== '' && (draftValue == null || draftValue > 100)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">بک‌گراند گزارش‌های روزانه</h2>
          <p className="text-xs leading-5 text-slate-500">
            در هر خانه، عدد بالا درصد پیشرفت تجمعی ثبت‌شده سرپرست تا آن روز است (۰ تا ۱۰۰) و عدد کوچک آبی پایین، پیشرفت
            اجباری تجمعی طبق برنامه زمانبندی است: از تاریخ شروع فعالیت در برنامه، هر روز کاری (بدون جمعه) ۱۰۰ تقسیم بر
            روزهای کاری فعالیت اضافه می‌شود تا تاریخ پایان آن که به ۱۰۰ می‌رسد. جدول از تاریخ شروع پروژه در برنامه شروع
            می‌شود و بازهٔ هر فعالیت آبی کم‌رنگ است. ستون «تجمعی» آخرین عدد ثبت‌شده را
            نشان می‌دهد. خانه‌های تغییرکرده زرد می‌شوند؛ عددی که از روز قبلش کمتر باشد قرمز می‌شود. برای حذف گزارش یک روز،
            عدد خانه را پاک کنید و Enter بزنید. در پایان «ذخیره تغییرات»
            را بزنید تا همه با هم در برنامه زمانبندی، نمودارها و گزارش‌ها ثبت شوند.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading || saving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی WBS یا نام فعالیت"
            className="h-9 w-52 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={saving || draftCount === 0}
            onClick={() => setDrafts({})}
          >
            لغو تغییرات
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 bg-[#1e3a5f] hover:bg-[#152a45]"
            disabled={saving || draftCount === 0}
            onClick={() => void saveAll()}
          >
            {saving ? 'در حال ذخیره…' : `ذخیره تغییرات${draftCount ? ` (${faNum(draftCount)})` : ''}`}
          </Button>
        </div>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
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
                فعالیت (آخرین نسخه برنامه)
              </th>
              <th
                className="sticky z-30 border-b border-l border-slate-200 bg-slate-100 px-1 py-1.5 text-center font-semibold text-slate-700"
                style={{ right: NAME_COL, minWidth: TOTAL_COL }}
              >
                تجمعی
              </th>
              {days.map((d) => {
                const wd = siteWeekday(d)
                const label = formatScheduleDate(d, calendar).split(/[/-]/)
                return (
                  <th
                    key={d}
                    data-today={d === today ? '' : undefined}
                    className={cn(
                      'min-w-[44px] border-b border-l border-slate-200 px-0.5 py-1 text-center font-normal tabular-nums',
                      wd === 6 ? 'bg-slate-200/80 text-slate-500' : 'bg-slate-50 text-slate-600',
                      wd === 0 && 'border-r-2 border-r-slate-300',
                      d === today && 'bg-amber-100 font-bold text-amber-900'
                    )}
                    title={formatScheduleDate(d, calendar)}
                  >
                    <div>{WEEKDAY_SHORT[wd]}</div>
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
              const total = row.activityId ? cumulativeOf(row.activityId) : row.schedulePercent
              const plannedByDate = row.activityId ? plannedByActivity.get(row.activityId) : undefined
              return (
                <tr key={row.key} className="group">
                  <td
                    className={cn(
                      'sticky right-0 z-10 border-b border-l border-slate-100 py-1 pl-2 text-right',
                      editable ? 'bg-white group-hover:bg-sky-50' : 'bg-slate-50 font-semibold text-slate-800'
                    )}
                    style={{ minWidth: NAME_COL, maxWidth: NAME_COL, paddingRight: 8 + row.depth * 14 }}
                    title={row.name}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {row.wbs && !nameHasWbs(row.name, row.wbs) ? (
                        <span className="shrink-0 font-mono text-[10px] text-slate-500">{row.wbs}</span>
                      ) : null}
                      <span className="truncate">{row.name}</span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      'sticky z-10 border-b border-l border-slate-100 text-center font-bold tabular-nums',
                      editable ? 'bg-white text-[#1e3a5f] group-hover:bg-sky-50' : 'bg-slate-50 text-slate-500'
                    )}
                    style={{ right: NAME_COL, minWidth: TOTAL_COL }}
                  >
                    {total == null ? '' : `${faNum(Math.round(total * 100) / 100)}٪`}
                  </td>
                  {days.map((d) => {
                    const wd = siteWeekday(d)
                    if (!editable) {
                      return (
                        <td
                          key={d}
                          className={cn('border-b border-l border-slate-100 bg-slate-50', wd === 0 && 'border-r-2 border-r-slate-300')}
                        />
                      )
                    }
                    const cell = cells?.get(d)
                    const inWindow = row.startDate != null && d >= row.startDate && (row.finishDate == null || d <= row.finishDate)
                    const isEditing = editing?.activityId === row.activityId && editing.date === d
                    const key = `${row.activityId}@${d}`
                    const planned = plannedByDate?.get(d) ?? null
                    return (
                      <td
                        key={d}
                        data-act={row.activityId!}
                        data-date={d}
                        title={[
                          drafts[key] === null
                            ? 'گزارش این روز با «ذخیره تغییرات» حذف می‌شود'
                            : cell
                              ? `ثبت سرپرست — تجمعی: ${faNum(cell.cumulative)}٪، پیشرفت همان روز: ${cell.daily == null ? '—' : `${faNum(cell.daily)}٪`} (برای حذف، عدد را پاک کنید)`
                              : 'گزارشی ثبت نشده — برای ثبت درصد تجمعی کلیک کنید',
                          planned != null
                            ? `اجباری طبق برنامه — تجمعی: ${faNum(planned.cumulative)}٪ (روزی ${faNum(planned.daily)}٪)`
                            : null,
                        ]
                          .filter(Boolean)
                          .join('\n')}
                        className={cn(
                          'h-10 cursor-pointer border-b border-l border-slate-100 p-0 text-center align-middle tabular-nums',
                          wd === 0 && 'border-r-2 border-r-slate-300',
                          wd === 6 && 'bg-slate-100/70',
                          inWindow && wd !== 6 && 'bg-sky-50/70',
                          d === today && 'bg-amber-50',
                          cell && 'font-semibold text-amber-800',
                          cell?.daily != null && cell.daily < 0 && 'text-red-600',
                          drafts[key] != null && 'bg-amber-200 font-bold text-amber-950 ring-1 ring-inset ring-amber-500',
                          'hover:outline hover:outline-1 hover:outline-[#1e3a5f]'
                        )}
                      >
                        {isEditing ? (
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
                            title="درصد تجمعی تا این روز (۰ تا ۱۰۰)"
                          />
                        ) : (
                          <div className="flex flex-col items-center leading-tight">
                            <span className="min-h-[14px]">
                              {drafts[key] !== null && cell ? faNum(cell.cumulative) : ''}
                            </span>
                            {planned != null ? (
                              <span className="text-[9px] font-normal text-sky-700">{faNum(planned.cumulative)}</span>
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
          <span className="font-semibold text-amber-800">۴۵</span> تجمعی ثبت‌شده سرپرست
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-sky-700">۵۰</span> پیشرفت اجباری تجمعی طبق برنامه
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-200 bg-sky-50" /> بازهٔ برنامه‌ریزی‌شدهٔ فعالیت
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-200 bg-amber-50" /> امروز
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-200 bg-slate-100" /> جمعه
        </span>
        <span>ردیف‌های خاکستری سرشاخه‌اند و درصدشان از زیرشاخه‌ها حساب می‌شود.</span>
      </div>
    </div>
  )
}
