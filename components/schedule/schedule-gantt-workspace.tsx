'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calculator, CheckCircle2, GitBranch, RefreshCw } from 'lucide-react'
import { addDaysIso, diffDaysIso, formatScheduleDate, toIsoDateOnly } from '@/lib/schedule/dates'
import {
  durationDaysFromRange,
  resizeRangeEdge,
  shiftRangeByDays,
} from '@/lib/schedule/gantt-parent-expand'
import { ganttBarClassName, ganttBarShowsFloat } from '@/lib/schedule/gantt-tone'
import {
  GANTT_FLOAT_DISPLAY_CAP_DAYS,
  type GanttRowDto,
} from '@/lib/schedule/gantt-service'
import {
  buildAllGanttLinkPaths,
  type GanttBarAnchor,
  type GanttLinkDto,
} from '@/lib/schedule/gantt-link-paths'
import {
  publishScheduleViewSync,
  useScheduleViewSync,
} from '@/lib/schedule/schedule-view-sync'
import { cn } from '@/lib/utils'

const DAY_PX = 14
const ROW_H = 32
const LABEL_W = 280
const RECALC_TOAST = 'برای اعمال روی مسیر بحرانی، محاسبه‌ی مجدد را اجرا کنید'

type DragMode = 'move' | 'resize-start' | 'resize-finish'

function barSpanDays(start: string, finish: string): number {
  // Inclusive span so a 1-day task still has visible width; 0-day = milestone.
  const diff = diffDaysIso(start, finish)
  if (diff < 0) return 1
  if (diff === 0) return 0
  return Math.max(1, diff)
}

export function ScheduleGanttWorkspace() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const forceReadOnly = searchParams.get('as') === 'supervisor'

  const [rows, setRows] = useState<GanttRowDto[]>([])
  const [links, setLinks] = useState<GanttLinkDto[]>([])
  const [readOnly, setReadOnly] = useState(forceReadOnly)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, { startDate: string; finishDate: string }>>({})
  const [showDependencies, setShowDependencies] = useState(false)

  const labelScrollRef = useRef<HTMLDivElement>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const syncingScroll = useRef(false)

  const dragRef = useRef<{
    taskId: string
    mode: DragMode
    originX: number
    startDate: string
    finishDate: string
    pendingStart: string
    pendingFinish: string
  } | null>(null)

  const workshopTab = searchParams.get('workshopTab') ?? 'schedule'
  const ganttTabActive = workshopTab === 'gantt'

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule/gantt?projectId=${projectId}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'بارگذاری گانت ناموفق بود')
      setRows(data.rows ?? [])
      setLinks(Array.isArray(data.links) ? data.links : [])
      setReadOnly(forceReadOnly || Boolean(data.readOnly))
      setDraft({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری')
    } finally {
      setLoading(false)
    }
  }, [projectId, forceReadOnly])

  useEffect(() => {
    void load()
  }, [load])

  useScheduleViewSync(
    projectId,
    () => {
      void load()
    },
    { active: ganttTabActive }
  )

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(t)
  }, [toast])

  const displayRows = useMemo(() => {
    return rows.map((r) => {
      const d = draft[r.id]
      if (!d) return r
      const span = barSpanDays(d.startDate, d.finishDate)
      return {
        ...r,
        startDate: d.startDate,
        finishDate: d.finishDate,
        durationDays: durationDaysFromRange(d.startDate, d.finishDate),
        isMilestone: r.isMilestone || span === 0,
      }
    })
  }, [rows, draft])

  const timeline = useMemo(() => {
    let min: string | null = null
    let max: string | null = null
    for (const r of displayRows) {
      const s = toIsoDateOnly(r.startDate)
      const f = toIsoDateOnly(r.finishDate)
      if (s && (!min || s < min)) min = s
      if (f && (!max || f > max)) max = f
    }
    if (!min || !max) {
      const today = new Date().toISOString().slice(0, 10)
      return { min: today, max: addDaysIso(today, 30), days: 31, widthPx: 31 * DAY_PX }
    }
    // Pad a little; do NOT inflate by total_float (that pushed late bars off-screen).
    min = addDaysIso(min, -3)
    max = addDaysIso(max, 7)
    const days = Math.max(1, diffDaysIso(min, max) + 1)
    return { min, max, days, widthPx: days * DAY_PX }
  }, [displayRows])

  function dateToX(iso: string | null | undefined): number {
    const d = toIsoDateOnly(iso)
    if (!d) return 0
    return Math.max(0, diffDaysIso(timeline.min, d) * DAY_PX)
  }

  function syncVertical(from: 'label' | 'chart') {
    if (syncingScroll.current) return
    syncingScroll.current = true
    const src = from === 'label' ? labelScrollRef.current : chartScrollRef.current
    const dst = from === 'label' ? chartScrollRef.current : labelScrollRef.current
    if (src && dst) dst.scrollTop = src.scrollTop
    requestAnimationFrame(() => {
      syncingScroll.current = false
    })
  }

  function syncHeaderHorizontal() {
    const chart = chartScrollRef.current
    const header = headerScrollRef.current
    if (chart && header) header.scrollLeft = chart.scrollLeft
  }

  async function persistChange(taskId: string, startDate: string, finishDate: string) {
    const res = await fetch('/api/schedule/gantt-task', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, taskId, startDate, finishDate }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'ذخیره تاریخ ناموفق بود')

    const updated = (data.updated ?? []) as Array<{
      id: string
      startDate: string
      finishDate: string
      durationDays: number
    }>
    setRows((prev) =>
      prev.map((r) => {
        const u = updated.find((x) => x.id === r.id)
        if (!u) return r
        return {
          ...r,
          startDate: u.startDate,
          finishDate: u.finishDate,
          durationDays: u.durationDays,
          isMilestone: Boolean(r.isMilestone) && u.durationDays === 0,
        }
      })
    )
  }

  async function commitFinalGantt() {
    if (!projectId || readOnly) return
    const entries = Object.entries(draft)
    if (entries.length === 0) {
      setToast('تغییر جدیدی برای ثبت نیست')
      return
    }
    setSaving(true)
    setError(null)
    try {
      for (const [taskId, range] of entries) {
        await persistChange(taskId, range.startDate, range.finishDate)
      }
      setDraft({})
      try {
        const cpmRes = await fetch(
          `/api/schedule/calculate?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const cpmData = await cpmRes.json()
        if (cpmRes.ok) {
          setToast(
            `ثبت نهایی شد — شناوری‌ها به‌روز شد (مدت پروژه ${cpmData.projectDurationDays} روز)`
          )
        } else {
          setToast('ثبت نهایی شد — تاریخ‌ها ذخیره شد · ' + RECALC_TOAST)
        }
      } catch {
        setToast('ثبت نهایی شد — تاریخ‌ها ذخیره شد · ' + RECALC_TOAST)
      }
      publishScheduleViewSync(projectId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت نهایی')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function runCpm() {
    if (!projectId) return
    setCalculating(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule/calculate?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'محاسبه CPM ناموفق بود')
      publishScheduleViewSync(projectId)
      setToast(
        `محاسبه انجام شد — طول پروژه ${data.projectDurationDays} روز، هشدار: ${data.saved?.alertsCreated ?? 0}`
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در محاسبه')
    } finally {
      setCalculating(false)
    }
  }

  function onPointerDown(e: React.PointerEvent, row: GanttRowDto, mode: DragMode) {
    if (readOnly || row.isSummary || row.kind === 'package' || saving) return
    const start = toIsoDateOnly(row.startDate)
    const finish = toIsoDateOnly(row.finishDate)
    if (!start || !finish) return
    if (row.isMilestone && mode !== 'move') return

    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = {
      taskId: row.id,
      mode,
      originX: e.clientX,
      startDate: start,
      finishDate: finish,
      pendingStart: start,
      pendingFinish: finish,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const deltaDays = Math.round((e.clientX - drag.originX) / DAY_PX)
    let next: { start: string; finish: string } | null = null
    if (drag.mode === 'move') {
      next = shiftRangeByDays(drag.startDate, drag.finishDate, deltaDays)
    } else if (drag.mode === 'resize-start') {
      next = resizeRangeEdge(drag.startDate, drag.finishDate, 'start', deltaDays)
    } else {
      next = resizeRangeEdge(drag.startDate, drag.finishDate, 'finish', deltaDays)
    }
    if (!next) return
    drag.pendingStart = next.start
    drag.pendingFinish = next.finish
    setDraft((prev) => ({
      ...prev,
      [drag.taskId]: { startDate: next!.start, finishDate: next!.finish },
    }))
  }

  function onPointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    const { taskId, startDate, finishDate, pendingStart, pendingFinish } = drag
    if (pendingStart === startDate && pendingFinish === finishDate) {
      setDraft((prev) => {
        const copy = { ...prev }
        delete copy[taskId]
        return copy
      })
      return
    }
    // Keep draft until «ثبت نهایی» so برنامه can stay in sync after one commit.
    setDraft((prev) => ({
      ...prev,
      [taskId]: { startDate: pendingStart, finishDate: pendingFinish },
    }))
  }

  const headerTicks = useMemo(() => {
    const ticks: { iso: string; label: string }[] = []
    const step = timeline.days > 180 ? 14 : 7
    for (let i = 0; i < timeline.days; i += step) {
      const iso = addDaysIso(timeline.min, i)
      ticks.push({ iso, label: formatScheduleDate(iso, 'jalali') })
    }
    return ticks
  }, [timeline])

  const linkDrawings = useMemo(() => {
    const anchors = new Map<string, GanttBarAnchor>()
    displayRows.forEach((row, rowIndex) => {
      if (row.kind === 'package') return
      const start = toIsoDateOnly(row.startDate)
      const finish = toIsoDateOnly(row.finishDate)
      if (!start || !finish) return
      const span = barSpanDays(start, finish)
      const left = Math.max(0, diffDaysIso(timeline.min, start) * DAY_PX)
      const finishDayX = Math.max(0, diffDaysIso(timeline.min, finish) * DAY_PX)
      const widthPx =
        span === 0 ? 0 : Math.max(DAY_PX, Math.max(1, span) * DAY_PX)
      const startX = span === 0 ? finishDayX : left
      const finishX = span === 0 ? finishDayX : left + widthPx
      anchors.set(row.id, {
        id: row.id,
        rowIndex,
        startX,
        finishX,
        midY: rowIndex * ROW_H + ROW_H / 2,
        isMilestone: span === 0 || row.isMilestone,
      })
    })
    return buildAllGanttLinkPaths(links, anchors)
  }, [displayRows, links, timeline.min])

  const missingDates = displayRows.filter((r) => !r.startDate || !r.finishDate).length
  const chartHeight = displayRows.length * ROW_H

  if (!projectId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        ابتدا یک پروژه را انتخاب کنید.
      </div>
    )
  }

  return (
    <div className="space-y-3" dir="rtl" lang="fa">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void commitFinalGantt()}
          disabled={readOnly || saving || loading || Object.keys(draft).length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          ثبت نهایی
          {Object.keys(draft).length > 0 ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
              {Object.keys(draft).length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => void runCpm()}
          disabled={calculating || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <Calculator className="h-4 w-4" />
          {calculating ? 'در حال محاسبه…' : 'محاسبه مسیر بحرانی'}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          بروزرسانی
        </button>
        <button
          type="button"
          onClick={() => setShowDependencies((v) => !v)}
          disabled={links.length === 0}
          title={
            links.length === 0
              ? 'پیوند وابستگی‌ای برای این پروژه نیست'
              : showDependencies
                ? 'مخفی کردن خطوط وابستگی'
                : 'نمایش خطوط وابستگی مثل MSP'
          }
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50',
            showDependencies
              ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          )}
        >
          <GitBranch className="h-4 w-4" />
          {showDependencies ? 'مخفی کردن وابستگی‌ها' : 'فعال کردن وابستگی‌ها'}
          {links.length > 0 ? (
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px]',
                showDependencies ? 'bg-white/20' : 'bg-slate-100 text-slate-600'
              )}
            >
              {links.length}
            </span>
          ) : null}
        </button>
        {saving ? <span className="text-xs text-slate-500">در حال ثبت…</span> : null}
        <span className="text-xs text-slate-500">
          {displayRows.length} فعالیت
          {links.length > 0 ? ` · ${links.length} پیوند` : ''}
          {missingDates > 0 ? ` · ${missingDates} بدون تاریخ` : ''}
        </span>
        {readOnly ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">فقط مشاهده</span>
        ) : (
          <span className="text-xs text-slate-500">
            کشیدن میله = جابه‌جایی · لبه = تغییر مدت · سپس «ثبت نهایی»
          </span>
        )}
      </div>

      {toast ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-950 shadow-sm">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        onPointerMove={onPointerMove}
        onPointerUp={() => void onPointerUp()}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        {/* Header */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <div
            className="shrink-0 border-l border-slate-200 px-3 py-2 text-xs font-medium text-slate-600"
            style={{ width: LABEL_W }}
          >
            فعالیت
          </div>
          <div
            ref={headerScrollRef}
            className="min-w-0 flex-1 overflow-hidden py-2"
            dir="ltr"
          >
            <div className="relative h-5" style={{ width: timeline.widthPx }}>
              {headerTicks.map((t) => (
                <span
                  key={t.iso}
                  className="absolute top-0 whitespace-nowrap text-[10px] text-slate-500"
                  style={{ left: dateToX(t.iso) }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Body: sticky labels + scrollable chart, synced vertically */}
        <div className="flex" style={{ height: 'min(70vh, 720px)' }}>
          <div
            ref={labelScrollRef}
            className="shrink-0 overflow-y-auto overflow-x-hidden border-l border-slate-200"
            style={{ width: LABEL_W }}
            onScroll={() => syncVertical('label')}
          >
            {loading && rows.length === 0 ? (
              <div className="px-3 py-6 text-sm text-slate-500">در حال بارگذاری…</div>
            ) : (
              displayRows.map((row) => (
                <div
                  key={`l-${row.id}`}
                  className="flex items-center border-b border-slate-100 px-2"
                  style={{ height: ROW_H, paddingInlineStart: 8 + row.depth * 10 }}
                  title={row.wbs ?? undefined}
                >
                  <div
                      className={cn(
                        'truncate text-[12px] leading-tight',
                        row.isSummary ? 'font-semibold text-slate-900' : 'text-slate-800',
                        row.kind === 'package' && 'text-emerald-800'
                      )}
                    >
                      {row.wbs ? (
                        <span className="ml-1 font-mono text-[9px] text-slate-400">{row.wbs}</span>
                      ) : null}
                      {row.kind === 'package' ? '↳ ' : ''}
                      {row.name}
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            ref={chartScrollRef}
            className="min-w-0 flex-1 overflow-auto"
            dir="ltr"
            onScroll={() => {
              syncVertical('chart')
              syncHeaderHorizontal()
            }}
          >
            {displayRows.length === 0 && !loading ? (
              <div className="px-4 py-8 text-sm text-slate-500">فعالیتی نیست.</div>
            ) : (
              <div className="relative" style={{ width: timeline.widthPx, height: chartHeight }}>
                {/* MSP-style dependency arrows */}
                {showDependencies && linkDrawings.length > 0 ? (
                  <svg
                    className="pointer-events-none absolute inset-0 z-[15]"
                    width={timeline.widthPx}
                    height={chartHeight}
                    aria-hidden
                  >
                    <defs>
                      <marker
                        id="gantt-dep-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
                      </marker>
                    </defs>
                    {linkDrawings.map((link) => (
                      <g key={link.key}>
                        <path
                          d={link.d}
                          fill="none"
                          stroke="#334155"
                          strokeWidth={1.35}
                          markerEnd="url(#gantt-dep-arrow)"
                        >
                          <title>{link.label}</title>
                        </path>
                      </g>
                    ))}
                  </svg>
                ) : null}

                {displayRows.map((row) => {
                  const start = toIsoDateOnly(row.startDate)
                  const finish = toIsoDateOnly(row.finishDate)
                  const hasDates = Boolean(start && finish)
                  const span = hasDates ? barSpanDays(start!, finish!) : 0
                  const left = hasDates ? dateToX(start) : 0
                  // Inclusive visual width: at least 1 day for normal bars
                  const widthPx = hasDates
                    ? Math.max(DAY_PX, (span === 0 ? 0 : Math.max(1, span)) * DAY_PX)
                    : 0
                  const rawFloat = Number(row.totalFloat) || 0
                  const showFloat =
                    hasDates && span > 0 && ganttBarShowsFloat(row.tone, rawFloat) && rawFloat > 0
                  const floatDays = showFloat
                    ? Math.min(rawFloat, GANTT_FLOAT_DISPLAY_CAP_DAYS)
                    : 0
                  const floatW = floatDays * DAY_PX
                  const editable = !readOnly && !row.isSummary && hasDates && row.kind !== 'package'
                  const asMilestone = Boolean(row.isMilestone || span === 0)

                  return (
                    <div
                      key={`c-${row.id}`}
                      className="relative border-b border-slate-100"
                      style={{ height: ROW_H, width: timeline.widthPx }}
                    >
                      {headerTicks.map((t) => (
                        <div
                          key={`g-${row.id}-${t.iso}`}
                          className="absolute top-0 bottom-0 border-l border-slate-100"
                          style={{ left: dateToX(t.iso) }}
                        />
                      ))}

                      {!hasDates ? (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                          بدون تاریخ
                        </span>
                      ) : null}

                      {hasDates && asMilestone ? (
                        <button
                          type="button"
                          disabled={!editable}
                          className={cn(
                            'absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-base leading-none',
                            row.tone === 'critical' || row.tone === 'negative'
                              ? 'text-rose-600'
                              : row.tone === 'near_critical'
                                ? 'text-amber-500'
                                : row.tone === 'fast_consumption'
                                  ? 'text-orange-500'
                                  : 'text-slate-600',
                            editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                          )}
                          style={{ left: dateToX(finish) }}
                          title={`${row.name} · مایلستون · ${formatScheduleDate(finish, 'jalali')}`}
                          onPointerDown={(e) =>
                            onPointerDown(e, { ...row, startDate: start!, finishDate: finish! }, 'move')
                          }
                        >
                          ◆
                        </button>
                      ) : null}

                      {hasDates && !asMilestone ? (
                        <div
                          className="absolute top-[7px] z-10"
                          style={{ left, height: ROW_H - 14, width: widthPx + floatW }}
                        >
                          <div
                            className={cn(
                              'relative h-full rounded-sm border',
                              ganttBarClassName(row.tone),
                              row.isSummary && 'opacity-45',
                              editable && 'cursor-grab active:cursor-grabbing'
                            )}
                            style={{ width: widthPx }}
                            title={`${row.name}\n${formatScheduleDate(start, 'jalali')} → ${formatScheduleDate(finish, 'jalali')}\n${row.durationDays} روز`}
                            onPointerDown={(e) =>
                              onPointerDown(e, { ...row, startDate: start!, finishDate: finish! }, 'move')
                            }
                          >
                            {editable ? (
                              <>
                                <span
                                  className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-black/15"
                                  onPointerDown={(e) =>
                                    onPointerDown(
                                      e,
                                      { ...row, startDate: start!, finishDate: finish! },
                                      'resize-start'
                                    )
                                  }
                                />
                                <span
                                  className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-black/15"
                                  onPointerDown={(e) =>
                                    onPointerDown(
                                      e,
                                      { ...row, startDate: start!, finishDate: finish! },
                                      'resize-finish'
                                    )
                                  }
                                />
                              </>
                            ) : null}
                          </div>
                          {showFloat ? (
                            <div
                              className="absolute top-1/2 h-px -translate-y-1/2 bg-slate-300"
                              style={{ left: widthPx, width: floatW }}
                              title={`شناوری ${rawFloat} روز`}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded bg-rose-500" /> بحرانی / منفی
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded bg-amber-400" /> نزدیک‌بحرانی
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded bg-orange-500" /> مصرف سریع
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded bg-slate-400" /> عادی
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="18" height="8" aria-hidden>
            <defs>
              <marker id="legend-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
              </marker>
            </defs>
            <line x1="0" y1="4" x2="14" y2="4" stroke="#334155" strokeWidth="1.5" markerEnd="url(#legend-arrow)" />
          </svg>
          پیوند وابستگی (مثل MSP)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-6 bg-slate-300" /> شناوری (حداکثر {GANTT_FLOAT_DISPLAY_CAP_DAYS} روز نمایشی)
        </span>
        <span>◆ مایلستون</span>
      </div>
    </div>
  )
}
