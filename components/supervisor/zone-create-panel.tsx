'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPinned } from 'lucide-react'
import { ZoneMapCanvas } from '@/components/supervisor/zone-map-svg'
import { prefetchDrawingPreview } from '@/components/supervisor/drawing-file-preview'
import { ZoneMapEditor } from '@/components/supervisor/zone-map-editor'
import { ZoneLightboxModal } from '@/components/supervisor/zone-lightbox-modal'
import { ZoneLevelsField } from '@/components/supervisor/zone-levels-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DefinedZone, PercentPoint, ZoneShapeTool } from '@/lib/supervisor/drawings-zoning-mock'
import {
  mockActivityCount,
  pickStructureDrawing,
  ZONE_COLOR_PRESETS,
} from '@/lib/supervisor/drawings-zoning-mock'
import type { ProjectDrawing } from '@/lib/technical-office/drawings-shared'

type ZoneCreatePanelProps = {
  drawings: ProjectDrawing[]
  drawingsLoading?: boolean
  existingZones: DefinedZone[]
  editZone?: DefinedZone | null
  active: boolean
  onSave: (zone: DefinedZone) => void
  onCancel: () => void
}

export function ZoneCreatePanel({
  drawings,
  drawingsLoading = false,
  existingZones,
  editZone = null,
  active,
  onSave,
  onCancel,
}: ZoneCreatePanelProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [contractor, setContractor] = useState('')
  const [description, setDescription] = useState('')
  const [levels, setLevels] = useState<string[]>([''])
  const [polygon, setPolygon] = useState<PercentPoint[] | null>(null)
  const [selectedDrawingId, setSelectedDrawingId] = useState(
    () => pickStructureDrawing(drawings)?.id ?? drawings[0]?.id ?? ''
  )
  const [mapOpen, setMapOpen] = useState(false)
  const [colorPresetId, setColorPresetId] = useState<string>(ZONE_COLOR_PRESETS[0].id)
  const [zoneShapeTool, setZoneShapeTool] = useState<ZoneShapeTool>('rectangle')
  const [currentPoints, setCurrentPoints] = useState<PercentPoint[]>([])
  const [pendingPolygon, setPendingPolygon] = useState<PercentPoint[] | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const initializedRef = useRef(false)
  const mapSectionRef = useRef<HTMLDivElement>(null)
  const sessionZoneCountRef = useRef(0)

  const selectedDrawing = useMemo(
    () => drawings.find((d) => d.id === selectedDrawingId) ?? drawings[0],
    [drawings, selectedDrawingId]
  )

  const colorPreset =
    ZONE_COLOR_PRESETS.find((p) => p.id === colorPresetId) ?? ZONE_COLOR_PRESETS[0]

  useEffect(() => {
    if (!active) {
      initializedRef.current = false
      return
    }
    if (initializedRef.current) return

    if (editZone) {
      setName(editZone.name)
      setCode(editZone.code ?? '')
      setContractor(editZone.contractor ?? '')
      setDescription(editZone.description ?? '')
      setLevels(editZone.levels?.length ? [...editZone.levels] : [''])
      setPolygon(editZone.polygon)
      setSelectedDrawingId(editZone.drawingId)
      const preset = ZONE_COLOR_PRESETS.find((p) => p.stroke === editZone.color)
      setColorPresetId(preset?.id ?? ZONE_COLOR_PRESETS[0].id)
      setMapOpen(false)
      setPendingPolygon(editZone.polygon)
      initializedRef.current = true
      return
    }

    if (drawings.length === 0) return
    setName('')
    setCode('')
    setContractor('')
    setDescription('')
    setLevels([''])
    setPolygon(null)
    setSelectedDrawingId(
      pickStructureDrawing(drawings)?.id ?? drawings[0]?.id ?? ''
    )
    setColorPresetId(ZONE_COLOR_PRESETS[0].id)
    setZoneShapeTool('rectangle')
    setCurrentPoints([])
    setPendingPolygon(null)
    setMapOpen(false)
    initializedRef.current = true
  }, [active, editZone, drawings])

  useEffect(() => {
    if (!mapOpen) return
    const el = mapSectionRef.current
    if (!el) return
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [mapOpen])

  const visibleZones = useMemo(() => {
    if (!selectedDrawing) return []
    return existingZones.filter(
      (z) => z.drawingId === selectedDrawing.id && z.id !== editZone?.id
    )
  }, [existingZones, selectedDrawing, editZone?.id])

  useEffect(() => {
    if (!mapOpen || !selectedDrawing) return
    prefetchDrawingPreview(selectedDrawing.id, selectedDrawing.fileName, true)
    import('@/lib/qc-engine/pdfjs').then((m) => m.loadPdfJs()).catch(() => undefined)
  }, [mapOpen, selectedDrawing?.id, selectedDrawing?.fileName])

  function openMapMarking() {
    const defaultDrawing = pickStructureDrawing(drawings)
    if (defaultDrawing) {
      setSelectedDrawingId(defaultDrawing.id)
      prefetchDrawingPreview(defaultDrawing.id, defaultDrawing.fileName, true)
    }
    setMapOpen(true)
    setPendingPolygon(polygon)
    setCurrentPoints([])
  }

  function confirmMapMarking() {
    if (!pendingPolygon || pendingPolygon.length < 3) return
    setPolygon(pendingPolygon)
    setMapOpen(false)
  }

  const canConfirmMap = Boolean(pendingPolygon && pendingPolygon.length >= 3)

  function handleZoneShapeComplete(pts: PercentPoint[]) {
    setPendingPolygon(pts)
    setCurrentPoints([])
  }

  function resetDraft() {
    setName('')
    setCode('')
    setContractor('')
    setDescription('')
    setLevels([''])
    setPolygon(null)
    setPendingPolygon(null)
    setCurrentPoints([])
    setMapOpen(false)
    setPreviewOpen(false)
    const colorIndex =
      (existingZones.length + sessionZoneCountRef.current) % ZONE_COLOR_PRESETS.length
    setColorPresetId(ZONE_COLOR_PRESETS[colorIndex].id)
  }

  function handleSave() {
    const trimmedName = name.trim()
    const trimmedCode = code.trim()
    const trimmedContractor = contractor.trim()
    if (!selectedDrawing || trimmedName.length < 1 || trimmedCode.length < 1 || !polygon) return

    const trimmedLevels = levels.map((l) => l.trim()).filter(Boolean)
    const trimmedDescription = description.trim()

    const zone: DefinedZone = {
      id: editZone?.id ?? `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      code: trimmedCode,
      contractor: trimmedContractor || undefined,
      description: trimmedDescription || undefined,
      levels: trimmedLevels.length > 0 ? trimmedLevels : undefined,
      color: colorPreset.stroke,
      fillColor: colorPreset.fill,
      drawingId: selectedDrawing.id,
      drawingTitle: selectedDrawing.title,
      polygon,
      activityCount: editZone?.activityCount ?? mockActivityCount(trimmedName),
    }
    onSave(zone)
    if (editZone) return
    sessionZoneCountRef.current += 1
    resetDraft()
  }

  const canSave =
    name.trim().length >= 1 && code.trim().length >= 1 && polygon !== null && polygon.length >= 3

  const previewZone =
    polygon && selectedDrawing
      ? {
          id: 'draft-preview',
          name: name.trim() || 'پیش‌نمایش',
          code: code.trim(),
          contractor: contractor.trim(),
          levels: levels.map((l) => l.trim()).filter(Boolean),
          color: colorPreset.stroke,
          fillColor: colorPreset.fill,
          drawingId: selectedDrawing.id,
          drawingTitle: selectedDrawing.title,
          polygon,
          activityCount: 0,
        }
      : null

  if (drawings.length === 0) {
    return (
      <p className="text-sm text-slate-600" dir="rtl" lang="fa">
        {drawingsLoading
          ? 'در حال بارگذاری نقشه‌ها...'
          : 'ابتدا دفتر فنی باید نقشه بارگذاری کند.'}
      </p>
    )
  }

  if (!selectedDrawing) return null

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4" dir="rtl" lang="fa">
      <p className="text-sm font-semibold text-slate-800">فرم تعریف زون</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="zone-draft-name">نام زون</Label>
          <Input
            id="zone-draft-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-draft-code">کد زون</Label>
          <Input
            id="zone-draft-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-10 bg-white font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-draft-contractor">نام پیمانکار زون</Label>
          <Input
            id="zone-draft-contractor"
            value={contractor}
            onChange={(e) => setContractor(e.target.value)}
            className="h-10 bg-white"
          />
        </div>
      </div>

      <ZoneLevelsField levels={levels} onChange={setLevels} idPrefix="zone-draft-level" />

      <div className="space-y-1.5">
        <Label htmlFor="zone-draft-description">توضیحات</Label>
        <Textarea
          id="zone-draft-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="یادداشت یا توضیح تکمیلی درباره این زون..."
          rows={3}
          className="min-h-[80px] resize-y bg-white text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
          onClick={openMapMarking}
        >
          <MapPinned className="h-4 w-4" aria-hidden="true" />
          افزودن نقشه زون
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          لغو
        </Button>
      </div>

      {mapOpen ? (
        <section
          ref={mapSectionRef}
          className="space-y-3 rounded-xl border border-sky-200 bg-white p-3 shadow-sm"
          aria-label="علامت‌گذاری نقشه زون"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <p className="text-sm font-semibold text-slate-800">علامت‌گذاری روی نقشه</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMapOpen(false)}
            >
              بستن
            </Button>
          </div>

          <ZoneMapEditor
            drawings={drawings}
            selectedDrawing={selectedDrawing}
            selectedDrawingId={selectedDrawingId}
            onSelectDrawing={setSelectedDrawingId}
            zones={visibleZones}
            highlightZoneId={editZone?.id}
            currentPoints={currentPoints}
            pendingZonePolygon={pendingPolygon}
            zoneShapeTool={zoneShapeTool}
            onZoneShapeToolChange={setZoneShapeTool}
            zoneColorPresetId={colorPresetId}
            onZoneColorPresetChange={setColorPresetId}
            onZoneShapeComplete={handleZoneShapeComplete}
            onClearPendingZone={() => setPendingPolygon(null)}
            zoneMarkingOnly
          />

          <div className="space-y-3 border-t border-slate-100 pt-3">
            <Button
              type="button"
              size="sm"
              className="bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40"
              disabled={!canConfirmMap}
              onClick={confirmMapMarking}
            >
              ذخیره نقشه زون
            </Button>
            <p className="text-xs text-slate-500">
              {canConfirmMap
                ? 'محدوده آماده است — «ذخیره نقشه زون» را بزنید.'
                : 'ابتدا با قلم دور محدوده زون روی نقشه بکشید.'}
            </p>
          </div>
        </section>
      ) : null}

      {polygon && !mapOpen && previewZone ? (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex flex-wrap items-start gap-4">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="w-[min(100%,120px)] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              aria-label="بزرگنمایی شمای نقشه زون"
            >
              <div className="aspect-square w-full pointer-events-none">
                <ZoneMapCanvas
                  drawing={selectedDrawing}
                  zones={[previewZone]}
                  highlightZoneId="draft-preview"
                />
              </div>
            </button>
            <p className="text-sm text-emerald-900">
              نقشه زون انتخاب شد — {selectedDrawing.title}
            </p>
          </div>

          <div className="border-t border-emerald-200/80 pt-4">
            <Button
              type="button"
              size="lg"
              className="min-w-[200px] bg-amber-500 px-8 text-base font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
              disabled={!canSave}
              onClick={handleSave}
            >
              ذخیره زون
            </Button>
            {!canSave ? (
              <p className="mt-2 text-xs text-slate-600">
                نام زون، کد زون و نقشه زون را تکمیل کنید.
              </p>
            ) : (
              <p className="mt-2 text-xs text-emerald-800">
                همه اطلاعات آماده است — «ذخیره زون» را بزنید.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <ZoneLightboxModal
        open={previewOpen}
        zone={previewZone}
        drawing={selectedDrawing}
        onClose={() => setPreviewOpen(false)}
      />

      {!polygon && !mapOpen ? (
        <p className="text-xs text-slate-500">
          برای تکمیل زون، روی «افزودن نقشه زون» کلیک کنید و محدوده را روی نقشه علامت بزنید.
        </p>
      ) : null}
    </div>
  )
}
