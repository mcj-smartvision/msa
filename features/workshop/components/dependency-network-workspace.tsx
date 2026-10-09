'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GitBranch, RefreshCw } from 'lucide-react'
import { formatScheduleDate } from '@/features/schedule/lib/dates'
import {
buildDependencyNetwork,
type DependencyNetwork,
} from '@/features/schedule/lib/dependency-network'
import { DEP_AXIS_H, layoutDependencyNetwork } from '@/features/schedule/lib/dependency-network-layout'
import { cn } from '@/shared/lib/utils'

export function DependencyNetworkWorkspace() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const workshopTab = searchParams.get('workshopTab') ?? 'schedule'
  const active = workshopTab === 'dependencies'

  const [network, setNetwork] = useState<DependencyNetwork | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function load() {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule/dependency-network?projectId=${projectId}`, {
        cache: 'no-store',
      })
      const data = (await res.json()) as DependencyNetwork & { error?: string }
      if (!res.ok) throw new Error(data.error || 'خواندن شبکه وابستگی ممکن نشد')
      setNetwork(buildDependencyNetwork(data.nodes, data.links))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در خواندن وابستگی‌ها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!projectId || !active) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, active])

  useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener('workshop-refresh', onRefresh)
    return () => window.removeEventListener('workshop-refresh', onRefresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const layout = useMemo(
    () => (network ? layoutDependencyNetwork(network) : null),
    [network]
  )

  const selected = network?.nodes.find((node) => node.id === selectedId) ?? null
  const related = useMemo(() => {
    if (!network || !selectedId) return new Set<string>()
    const ids = new Set<string>([selectedId])
    for (const link of network.links) {
      if (link.fromId === selectedId) ids.add(link.toId)
      if (link.toId === selectedId) ids.add(link.fromId)
    }
    return ids
  }, [network, selectedId])
  const criticalIds = useMemo(
    () => new Set((network?.nodes ?? []).filter((node) => node.critical).map((node) => node.id)),
    [network]
  )

  if (!projectId) {
    return (
      <p className="text-sm text-slate-500">برای دیدن شبکه وابستگی، پروژه را انتخاب کنید.</p>
    )
  }

  return (
    <div className="space-y-3" dir="rtl" lang="fa">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <GitBranch className="h-4 w-4" />
            شبکه وابستگی فعالیت‌ها
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            ستون‌ها از راست به چپ مسیر پیش‌نیاز → پس‌نیاز است. فعالیت بدون پیوند پایین صفحه جدا می‌ماند.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          نوسازی
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {network && network.isolatedIds.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {network.isolatedIds.length} فعالیت هنوز به شبکه وصل نشده‌اند (بدون پیش‌نیاز و پس‌نیاز).
        </p>
      ) : null}

      {selected ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">{selected.wbs ? `${selected.wbs} — ` : ''}</span>
          {selected.name}
          <span className="mx-2 text-slate-400">|</span>
          شروع {formatScheduleDate(selected.start, 'jalali')}
          <span className="mx-2 text-slate-400">|</span>
          پایان {formatScheduleDate(selected.finish, 'jalali')}
          <span className="mx-2 text-slate-400">|</span>
          {selected.predCount} پیش‌نیاز · {selected.succCount} پس‌نیاز
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-5 rounded border-2 border-rose-600 bg-rose-50" /> بحرانی
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-5 rounded border border-slate-300 bg-white" /> عادی
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-5 rounded border border-amber-500 bg-amber-50" /> بدون وابستگی
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-5 bg-rose-600" /> پیوند روی مسیر بحرانی
        </span>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        {loading && !layout ? (
          <p className="p-6 text-sm text-slate-500">در حال بارگذاری شبکه…</p>
        ) : !layout || layout.boxes.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">فعالیت برگی برای رسم شبکه نیست.</p>
        ) : (
          <div className="min-w-full" style={{ width: layout.width, height: layout.height }}>
            <svg
              width={layout.width}
              height={layout.height}
              className="block"
              direction="ltr"
              style={{ direction: 'ltr' }}
              onClick={() => setSelectedId(null)}
            >
              <rect width={layout.width} height={layout.height} fill="#f8fafc" />
              {layout.ticks.map((tick) => (
                <g key={`${tick.label}-${tick.x}`}>
                  <line
                    x1={tick.x}
                    y1={DEP_AXIS_H}
                    x2={tick.x}
                    y2={layout.isolatedBandY ?? layout.height}
                    stroke="#e2e8f0"
                    strokeDasharray="3 5"
                  />
                  <text
                    x={tick.x}
                    y={18}
                    textAnchor="middle"
                    className="fill-slate-500"
                    style={{ fontSize: 11 }}
                  >
                    {tick.label}
                  </text>
                </g>
              ))}
              <line
                x1={0}
                y1={DEP_AXIS_H}
                x2={layout.width}
                y2={DEP_AXIS_H}
                stroke="#cbd5e1"
              />

              {layout.isolatedBandY != null ? (
                <text
                  x={layout.width - 20}
                  y={layout.isolatedBandY + 16}
                  textAnchor="end"
                  className="fill-amber-800"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  فعالیت‌های بدون پیوند
                </text>
              ) : null}

              {layout.edges.map((edge) => {
                const dim = Boolean(selectedId) && !related.has(edge.fromId) && !related.has(edge.toId)
                const criticalEdge = criticalIds.has(edge.fromId) && criticalIds.has(edge.toId)
                return (
                  <g key={edge.key} opacity={dim ? 0.12 : 1}>
                    <path
                      d={edge.d}
                      fill="none"
                      stroke={criticalEdge ? '#e11d48' : '#334155'}
                      strokeWidth={criticalEdge ? 2.2 : 1.6}
                      markerEnd={criticalEdge ? 'url(#dep-arrow-critical)' : 'url(#dep-arrow)'}
                    />
                    <text
                      x={edge.labelX}
                      y={edge.labelY}
                      textAnchor="middle"
                      className={criticalEdge ? 'fill-rose-700' : 'fill-slate-600'}
                      style={{ fontSize: 10 }}
                    >
                      {edge.label}
                    </text>
                  </g>
                )
              })}

              <defs>
                <marker
                  id="dep-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
                </marker>
                <marker
                  id="dep-arrow-critical"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#e11d48" />
                </marker>
              </defs>

              {layout.boxes.map((box) => {
                const dim = Boolean(selectedId) && !related.has(box.id)
                const activeBox = selectedId === box.id
                const critical = box.node.critical
                const fullName = `${box.node.wbs ? `${box.node.wbs} — ` : ''}${box.node.name}${critical ? ' (بحرانی)' : ''}`
                return (
                  <g
                    key={box.id}
                    opacity={dim ? 0.28 : 1}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedId(box.id)
                    }}
                    className="cursor-pointer"
                    aria-label={fullName}
                  >
                    <title>{fullName}</title>
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.w}
                      height={box.h}
                      rx={10}
                      fill={critical ? '#fff1f2' : box.node.isolated ? '#fffbeb' : '#ffffff'}
                      stroke={
                        activeBox
                          ? '#0f172a'
                          : critical
                            ? '#e11d48'
                            : box.node.isolated
                              ? '#f59e0b'
                              : '#cbd5e1'
                      }
                      strokeWidth={activeBox ? 2.5 : critical ? 2 : 1}
                    />
                    <text
                      x={box.x + box.w - 10}
                      y={box.y + 20}
                      textAnchor="end"
                      className="fill-slate-500"
                      style={{ fontSize: 10 }}
                    >
                      {box.node.wbs ?? '—'}
                    </text>
                    <text
                      x={box.x + box.w - 10}
                      y={box.y + 38}
                      textAnchor="end"
                      className="fill-slate-900"
                      style={{ fontSize: 12, fontWeight: 600 }}
                    >
                      {box.node.name.length > 18 ? `${box.node.name.slice(0, 18)}…` : box.node.name}
                    </text>
                    <text
                      x={box.x + box.w - 10}
                      y={box.y + 56}
                      textAnchor="end"
                      className="fill-slate-500"
                      style={{ fontSize: 10 }}
                    >
                      {formatScheduleDate(box.start, 'jalali')} → {formatScheduleDate(box.finish, 'jalali')}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
