'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Download,
  FileText,
  Layers,
  MapPinned,
  Pencil,
  Trash2,
  Zap,
  Building2,
  Cog,
  PenTool,
} from 'lucide-react'
import { ZoneCreatePanel } from '@/components/supervisor/zone-create-panel'
import { ZoneLightboxModal } from '@/components/supervisor/zone-lightbox-modal'
import { ZoneListDrawingThumb } from '@/components/supervisor/zone-list-drawing-thumb'
import { formatZoneLevels } from '@/components/supervisor/zone-levels-field'
import { Button } from '@/components/ui/button'
import type { DefinedZone, DrawingDiscipline } from '@/lib/supervisor/drawings-zoning-mock'
import { drawingDisciplineLabel } from '@/lib/technical-office/drawing-discipline'
import {
  readProjectZoneState,
  writeProjectZoneState,
} from '@/lib/supervisor/zone-project-storage'
import type { ProjectDrawing } from '@/lib/technical-office/drawings-shared'
import { cn } from '@/lib/utils'

const DISCIPLINES: Array<{
  id: DrawingDiscipline
  label: string
  icon: typeof Building2
}> = [
  { id: 'structure', label: 'سازه', icon: Building2 },
  { id: 'architecture', label: 'معماری', icon: PenTool },
  { id: 'electrical', label: 'برق', icon: Zap },
  { id: 'mechanical', label: 'مکانیک', icon: Cog },
]

function formatDrawingDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fa-IR', { dateStyle: 'short' })
}

function DrawingList({
  drawings,
  onDownload,
}: {
  drawings: ProjectDrawing[]
  onDownload: (id: string) => void
}) {
  if (drawings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">نقشه‌ای در این دسته ثبت نشده است.</p>
    )
  }

  return (
    <ul className="divide-y divide-slate-100">
      {drawings.map((d) => (
        <li
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{d.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                <span>{drawingDisciplineLabel(d.discipline)}</span>
                <span className="text-slate-300">·</span>
                <span className="font-mono">{d.fileName}</span>
                <span className="text-slate-300">·</span>
                <span>{d.format.toUpperCase()}</span>
                <span className="text-slate-300">·</span>
                <span>بارگذاری {formatDrawingDate(d.createdAt)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            onClick={() => onDownload(d.id)}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            دانلود
          </button>
        </li>
      ))}
    </ul>
  )
}

function ZoneListRow({
  zone,
  drawing,
  onThumbnailClick,
  onEdit,
  onDelete,
  onDrawingResolved,
}: {
  zone: DefinedZone
  drawing: ProjectDrawing | null
  onThumbnailClick: () => void
  onEdit: () => void
  onDelete: () => void
  onDrawingResolved?: (drawing: ProjectDrawing) => void
}) {
  const levelsText = formatZoneLevels(zone.levels)
  const discipline = drawing ? drawingDisciplineLabel(drawing.discipline) : null

  return (
    <article
      className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/95 p-3 shadow-sm sm:gap-4 sm:p-4"
    >
      <ZoneListDrawingThumb
        zone={zone}
        drawing={drawing}
        onClick={onThumbnailClick}
        onDrawingResolved={onDrawingResolved}
      />

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-lg font-bold text-slate-900">{zone.name}</p>
          <p className="font-mono text-base font-semibold text-[#1e3a5f]">{zone.code?.trim() || '—'}</p>
          {levelsText !== '—' ? (
            <span
              className="rounded-full px-3 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: zone.fillColor.replace(/[\d.]+\)$/, '0.35)'),
                color: zone.color,
              }}
            >
              تراز {levelsText}
            </span>
          ) : null}
          {zone.contractor?.trim() ? (
            <p className="text-sm font-semibold text-slate-800">
              پیمانکار: <span className="font-medium text-slate-700">{zone.contractor}</span>
            </p>
          ) : null}
        </div>

        <div
          className="w-full rounded-lg border border-emerald-100/90 bg-white/75 px-3 py-2.5 sm:px-4 sm:py-3"
          dir="rtl"
        >
          <p className="text-sm leading-relaxed text-slate-700 sm:text-[15px]">
            <span className="font-semibold text-slate-800">{zone.drawingTitle}</span>
            {discipline ? (
              <>
                <span className="mx-2 text-emerald-300">·</span>
                <span>{discipline}</span>
              </>
            ) : null}
            <span className="mx-2 text-emerald-300">·</span>
            <span>{zone.activityCount.toLocaleString('fa-IR')} فعالیت متصل</span>
          </p>
          {zone.description?.trim() ? (
            <p className="mt-2 border-t border-emerald-100 pt-2 text-sm leading-relaxed text-slate-800 sm:text-[15px]">
              {zone.description.trim()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 border-slate-200 bg-white"
          onClick={onEdit}
          aria-label={`ویرایش زون ${zone.name}`}
        >
          <Pencil className="h-4 w-4 text-slate-600" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 border-slate-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          onClick={onDelete}
          aria-label={`حذف زون ${zone.name}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  )
}

export function SupervisorDrawingsZoningPanel({ projectId }: { projectId: string | null }) {
  const [openDiscipline, setOpenDiscipline] = useState<DrawingDiscipline | null>(null)
  const [zonesOpen, setZonesOpen] = useState(false)
  const [projectUsesZones, setProjectUsesZones] = useState<boolean | null>(null)
  const [definedZones, setDefinedZones] = useState<DefinedZone[]>([])
  const [zoneFormOpen, setZoneFormOpen] = useState(false)
  const [zoneDraftNonce, setZoneDraftNonce] = useState(0)
  const [zoneSaveHint, setZoneSaveHint] = useState(false)
  const [editZone, setEditZone] = useState<DefinedZone | null>(null)
  const [lightboxZone, setLightboxZone] = useState<DefinedZone | null>(null)
  const [drawingById, setDrawingById] = useState<Record<string, ProjectDrawing>>({})
  const [drawings, setDrawings] = useState<ProjectDrawing[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const loadedProjectIdRef = useRef<string | null>(null)

  function persistZoneState(zones: DefinedZone[], usesZones: boolean | null) {
    if (!projectId || loadedProjectIdRef.current !== projectId) return
    writeProjectZoneState(projectId, { usesZones, zones })
  }

  function updateProjectUsesZones(value: boolean) {
    setProjectUsesZones(value)
    persistZoneState(definedZones, value)
  }

  useEffect(() => {
    loadedProjectIdRef.current = null
    if (!projectId) {
      setDefinedZones([])
      setProjectUsesZones(null)
      setZonesOpen(false)
      return
    }
    const stored = readProjectZoneState(projectId)
    setDefinedZones(stored.zones)
    if (stored.zones.length > 0) {
      setProjectUsesZones(true)
      setZonesOpen(true)
    } else {
      setProjectUsesZones(stored.usesZones)
    }
    loadedProjectIdRef.current = projectId
  }, [projectId])

  const loadDrawings = useCallback(async () => {
    if (!projectId) {
      setDrawings([])
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/technical-office/drawings?projectId=${encodeURIComponent(projectId)}`)
      const data = (await res.json().catch(() => ({}))) as { drawings?: ProjectDrawing[]; error?: string }
      if (!res.ok) {
        setLoadError(data.error || 'بارگذاری نقشه‌ها انجام نشد.')
        setDrawings([])
        return
      }
      setDrawings(data.drawings ?? [])
    } catch {
      setLoadError('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.')
      setDrawings([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadDrawings()
  }, [loadDrawings])

  const activeDrawings =
    openDiscipline !== null ? drawings.filter((d) => d.discipline === openDiscipline) : []

  async function handleDownload(drawingId: string) {
    const res = await fetch(`/api/technical-office/drawings/${encodeURIComponent(drawingId)}`)
    const data = (await res.json().catch(() => ({}))) as { url?: string; fileName?: string; error?: string }
    if (!res.ok || !data.url) return
    const a = document.createElement('a')
    a.href = data.url
    a.download = data.fileName || 'drawing.pdf'
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.click()
  }

  function handleSaveZone(zone: DefinedZone, closeForm = false) {
    setDefinedZones((prev) => {
      const exists = prev.some((z) => z.id === zone.id)
      const next = exists
        ? prev.map((z) => (z.id === zone.id ? zone : z))
        : [...prev, zone]
      persistZoneState(next, true)
      return next
    })
    setEditZone(null)
    if (closeForm) {
      setZoneFormOpen(false)
    } else {
      setProjectUsesZones(true)
      setZonesOpen(true)
      setZoneDraftNonce((n) => n + 1)
      setZoneSaveHint(true)
      window.setTimeout(() => setZoneSaveHint(false), 5000)
    }
  }

  function closeZoneForm() {
    setZoneFormOpen(false)
    setEditZone(null)
  }

  function openZoneForm() {
    setEditZone(null)
    setZoneFormOpen(true)
    setZonesOpen(true)
    setProjectUsesZones(true)
    setZoneDraftNonce((n) => n + 1)
  }

  function deleteZone(zoneId: string) {
    setDefinedZones((prev) => {
      const next = prev.filter((z) => z.id !== zoneId)
      persistZoneState(next, projectUsesZones)
      return next
    })
  }

  function cacheDrawing(drawing: ProjectDrawing) {
    setDrawingById((prev) => {
      if (prev[drawing.id]) return prev
      return { ...prev, [drawing.id]: drawing }
    })
  }

  function drawingForZone(zone: DefinedZone): ProjectDrawing | null {
    return drawings.find((d) => d.id === zone.drawingId) ?? drawingById[zone.drawingId] ?? null
  }

  const lightboxDrawing = lightboxZone ? drawingForZone(lightboxZone) : null

  if (!projectId) {
    return (
      <p className="text-sm text-slate-500" dir="rtl" lang="fa">
        ابتدا یک پروژه انتخاب کنید.
      </p>
    )
  }

  return (
    <div className="space-y-5" dir="rtl" lang="fa">
      {loadError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-sm font-semibold text-slate-800">نقشه‌ها به تفکیک رشته</p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="رشته نقشه">
          {DISCIPLINES.map((item) => {
            const selected = openDiscipline === item.id
            const Icon = item.icon
            const count = drawings.filter((d) => d.discipline === item.id).length
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setOpenDiscipline(selected ? null : item.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  selected
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                    selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {count.toLocaleString('fa-IR')}
                </span>
              </button>
            )
          })}
        </div>

        {openDiscipline !== null ? (
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4" role="tabpanel">
            <p className="mb-3 text-xs font-medium text-slate-600">
              نقشه‌های رشته {DISCIPLINES.find((d) => d.id === openDiscipline)?.label ?? ''}
            </p>
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">در حال بارگذاری نقشه‌ها...</p>
            ) : (
              <DrawingList drawings={activeDrawings} onDownload={handleDownload} />
            )}
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-slate-500">
            برای مشاهده لیست نقشه‌ها، یکی از رشته‌ها را انتخاب کنید.
          </p>
        )}
      </section>

      {definedZones.length > 0 ? (
        <section
          className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm sm:p-5"
          aria-label="زون‌های تعریف‌شده"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              زون‌های تعریف‌شده ({definedZones.length.toLocaleString('fa-IR')})
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-900 hover:bg-amber-50"
              onClick={openZoneForm}
            >
              افزودن زون دیگر
            </Button>
          </div>
          <div className="space-y-3">
            {definedZones.map((zone) => (
              <ZoneListRow
                key={zone.id}
                zone={zone}
                drawing={drawingForZone(zone)}
                onThumbnailClick={() => setLightboxZone(zone)}
                onDrawingResolved={cacheDrawing}
                onEdit={() => {
                  setEditZone(zone)
                  setZoneFormOpen(true)
                  setZonesOpen(true)
                  setProjectUsesZones(true)
                  setZoneDraftNonce((n) => n + 1)
                }}
                onDelete={() => deleteZone(zone.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {zoneFormOpen ? (
        <ZoneCreatePanel
          key={zoneDraftNonce}
          drawings={drawings}
          drawingsLoading={loading}
          existingZones={definedZones}
          editZone={editZone}
          active={zoneFormOpen}
          onSave={(zone) => handleSaveZone(zone, Boolean(editZone))}
          onCancel={closeZoneForm}
        />
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setZonesOpen((open) => !open)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors',
            zonesOpen ? 'bg-amber-600 hover:bg-amber-700' : 'bg-amber-500 hover:bg-amber-600'
          )}
          aria-expanded={zonesOpen}
        >
          <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
          زون‌بندی پروژه
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', zonesOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {zonesOpen ? (
          <section
            className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            aria-label="زون‌بندی پروژه"
          >
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-[#1e3a5f]" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">این پروژه به زون تقسیم می‌شود؟</p>
              </div>
              <div className="flex gap-2" role="group" aria-label="تقسیم به زون">
                <button
                  type="button"
                  onClick={() => updateProjectUsesZones(true)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    projectUsesZones === true
                      ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  بله
                </button>
                <button
                  type="button"
                  onClick={() => updateProjectUsesZones(false)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    projectUsesZones === false
                      ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  خیر
                </button>
              </div>
            </div>

            {projectUsesZones === false ? (
              <p className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                این پروژه بدون زون‌بندی مدیریت می‌شود.
              </p>
            ) : null}

            {projectUsesZones === true ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {!zoneFormOpen ? (
                    <Button
                      type="button"
                      className="bg-amber-500 text-white hover:bg-amber-600"
                      onClick={openZoneForm}
                    >
                      تعریف زون
                    </Button>
                  ) : null}
                  {definedZones.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-300 text-amber-900 hover:bg-amber-50"
                      onClick={openZoneForm}
                    >
                      افزودن زون دیگر
                    </Button>
                  ) : null}
                </div>

                {zoneSaveHint ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    زون ذخیره شد. می‌توانید زون‌های بیشتری اضافه کنید.
                  </p>
                ) : null}

                {!zoneFormOpen && definedZones.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">
                    هنوز زونی تعریف نشده — روی «تعریف زون» کلیک کنید.
                  </p>
                ) : null}
              </div>
            ) : null}

            {projectUsesZones === null ? (
              <p className="text-center text-sm text-slate-500">
                یکی از گزینه‌های بله یا خیر را انتخاب کنید.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <ZoneLightboxModal
        open={lightboxZone !== null}
        zone={lightboxZone}
        drawing={lightboxDrawing}
        onClose={() => setLightboxZone(null)}
        onDownload={handleDownload}
      />
    </div>
  )
}
