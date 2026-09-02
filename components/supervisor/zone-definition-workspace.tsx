'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ZoneInfoForm, type ZoneInfoFormValues } from '@/components/supervisor/zone-info-form'
import { ZoneMapEditor } from '@/components/supervisor/zone-map-editor'
import { ZoneMapCanvas } from '@/components/supervisor/zone-map-svg'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { DefinedZone, PercentPoint, ZoneShapeTool } from '@/lib/supervisor/drawings-zoning-mock'
import {
  mockActivityCount,
  ZONE_COLOR_PRESETS,
} from '@/lib/supervisor/drawings-zoning-mock'
import type { ProjectDrawing } from '@/lib/technical-office/drawings-shared'

const EMPTY_FORM: ZoneInfoFormValues = {
  name: '',
  code: '',
  supervisor: '',
  contractor: '',
  description: '',
}

export type ZoneDefinitionWorkspaceProps = {
  drawings: ProjectDrawing[]
  existingZones: DefinedZone[]
  onSaveZone: (zone: DefinedZone) => void
  editZone?: DefinedZone | null
  supervisorOptions?: string[]
  contractorOptions?: string[]
  /** وقتی true، state با editZone یا حالت جدید مقداردهی می‌شود */
  active?: boolean
}

export function ZoneDefinitionWorkspace({
  drawings,
  existingZones,
  onSaveZone,
  editZone = null,
  supervisorOptions = [],
  contractorOptions = [],
  active = true,
}: ZoneDefinitionWorkspaceProps) {
  const [selectedDrawingId, setSelectedDrawingId] = useState(drawings[0]?.id ?? '')
  const [currentPoints, setCurrentPoints] = useState<PercentPoint[]>([])
  const [pendingPolygon, setPendingPolygon] = useState<PercentPoint[] | null>(null)
  const [formValues, setFormValues] = useState<ZoneInfoFormValues>(EMPTY_FORM)
  const [optionalOpen, setOptionalOpen] = useState(true)
  const [colorPresetId, setColorPresetId] = useState<string>(ZONE_COLOR_PRESETS[0].id)
  const [zoneShapeTool, setZoneShapeTool] = useState<ZoneShapeTool>('rectangle')
  const [sessionZones, setSessionZones] = useState<DefinedZone[]>([])
  const initializedRef = useRef(false)

  const selectedDrawing = useMemo(
    () => drawings.find((d) => d.id === selectedDrawingId) ?? drawings[0],
    [drawings, selectedDrawingId]
  )

  function resetForm() {
    setFormValues(EMPTY_FORM)
  }

  function patchForm(patch: Partial<ZoneInfoFormValues>) {
    setFormValues((prev) => ({ ...prev, ...patch }))
  }

  useEffect(() => {
    if (!active) {
      initializedRef.current = false
      return
    }

    if (initializedRef.current) return

    if (editZone) {
      setSelectedDrawingId(editZone.drawingId)
      setSessionZones([])
      setCurrentPoints([])
      setPendingPolygon(editZone.polygon)
      setFormValues({
        name: editZone.name,
        code: editZone.code ?? '',
        supervisor: editZone.supervisor ?? '',
        contractor: editZone.contractor ?? '',
        description: editZone.description ?? '',
      })
      const preset = ZONE_COLOR_PRESETS.find((p) => p.stroke === editZone.color)
      setColorPresetId(preset?.id ?? ZONE_COLOR_PRESETS[0].id)
      setZoneShapeTool('polygon')
      setOptionalOpen(true)
      initializedRef.current = true
      return
    }

    if (drawings.length === 0) return

    setSelectedDrawingId(drawings[0].id)
    setSessionZones([])
    setCurrentPoints([])
    setPendingPolygon(null)
    resetForm()
    setColorPresetId(ZONE_COLOR_PRESETS[0].id)
    setZoneShapeTool('rectangle')
    setOptionalOpen(true)
    initializedRef.current = true
  }, [active, editZone, drawings])

  useEffect(() => {
    if (!active || editZone) return
    setCurrentPoints([])
    setPendingPolygon(null)
  }, [selectedDrawingId, active, editZone])

  const visibleZones = useMemo(() => {
    if (!selectedDrawing) return []
    const fromExisting = existingZones.filter(
      (z) => z.drawingId === selectedDrawing.id && z.id !== editZone?.id
    )
    return [...fromExisting, ...sessionZones.filter((z) => z.drawingId === selectedDrawing.id)]
  }, [existingZones, sessionZones, selectedDrawing, editZone?.id])

  function closePolygon() {
    if (currentPoints.length < 3) return
    setPendingPolygon([...currentPoints])
    setCurrentPoints([])
  }

  function handleZoneShapeComplete(polygon: PercentPoint[]) {
    setPendingPolygon(polygon)
    setCurrentPoints([])
  }

  function undoLastPoint() {
    setCurrentPoints((pts) => pts.slice(0, -1))
  }

  function cancelCurrentDraw() {
    setCurrentPoints([])
    setPendingPolygon(null)
    resetForm()
  }

  function saveZone() {
    const name = formValues.name.trim()
    const code = formValues.code.trim()
    if (!pendingPolygon || !selectedDrawing || name.length < 2 || code.length < 1) return
    const preset = ZONE_COLOR_PRESETS.find((p) => p.id === colorPresetId) ?? ZONE_COLOR_PRESETS[0]
    const supervisor = formValues.supervisor.trim()
    const contractor = formValues.contractor.trim()
    const description = formValues.description.trim()
    const zone: DefinedZone = {
      id: editZone?.id ?? `zone-${Date.now()}`,
      name,
      code,
      supervisor: supervisor || undefined,
      contractor: contractor || undefined,
      description: description || undefined,
      color: preset.stroke,
      fillColor: preset.fill,
      drawingId: selectedDrawing.id,
      drawingTitle: selectedDrawing.title,
      polygon: pendingPolygon,
      activityCount: editZone?.activityCount ?? mockActivityCount(name),
    }
    onSaveZone(zone)
    if (editZone) return
    setSessionZones((prev) => [...prev, zone])
    setPendingPolygon(null)
    resetForm()
    setColorPresetId(ZONE_COLOR_PRESETS[(sessionZones.length + 1) % ZONE_COLOR_PRESETS.length].id)
  }

  const canSaveZone =
    pendingPolygon &&
    formValues.name.trim().length >= 1 &&
    formValues.code.trim().length >= 1

  const previewZone = pendingPolygon
    ? {
        id: 'preview',
        name: formValues.name.trim() || 'پیش‌نمایش',
        code: formValues.code,
        supervisor: formValues.supervisor,
        contractor: formValues.contractor,
        description: formValues.description,
        color:
          ZONE_COLOR_PRESETS.find((p) => p.id === colorPresetId)?.stroke ?? ZONE_COLOR_PRESETS[0].stroke,
        fillColor:
          ZONE_COLOR_PRESETS.find((p) => p.id === colorPresetId)?.fill ?? ZONE_COLOR_PRESETS[0].fill,
        drawingId: selectedDrawing?.id ?? '',
        drawingTitle: selectedDrawing?.title ?? '',
        polygon: pendingPolygon,
        activityCount: 0,
      }
    : null

  if (!selectedDrawing || drawings.length === 0) {
    return (
      <p className="text-sm text-slate-600" dir="rtl" lang="fa">
        ابتدا دفتر فنی باید نقشه PDF یا DWG بارگذاری کند.
      </p>
    )
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
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
        onClearPendingZone={() => {
          setPendingPolygon(null)
          resetForm()
        }}
        onZoneClick={(pt) => {
          if (pendingPolygon) return
          setCurrentPoints((prev) => [...prev, pt])
        }}
        onZoneDoubleClick={closePolygon}
      />

      {pendingPolygon ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-800">فرم اطلاعات زون</p>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
            <ZoneInfoForm
              values={formValues}
              onChange={patchForm}
              supervisorOptions={supervisorOptions}
              contractorOptions={contractorOptions}
              optionalOpen={optionalOpen}
              onOptionalOpenChange={setOptionalOpen}
            />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">شمای نقشه</Label>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
                <div className="aspect-[4/3] w-full">
                  {previewZone ? (
                    <ZoneMapCanvas
                      drawing={selectedDrawing}
                      zones={[previewZone]}
                      highlightZoneId="preview"
                    />
                  ) : null}
                </div>
                <p className="border-t border-slate-100 bg-white px-2.5 py-2 text-[10px] leading-snug text-slate-500">
                  {selectedDrawing.title}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200/80 pt-3">
            <Button
              type="button"
              className="bg-amber-500 text-white hover:bg-amber-600"
              disabled={!canSaveZone}
              onClick={saveZone}
            >
              ذخیره زون
            </Button>
            <Button type="button" variant="outline" onClick={cancelCurrentDraw}>
              لغو
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
          محدوده زون را روی نقشه بالا رسم کنید — بعد از رسم، فرم اطلاعات زون در همین صفحه نمایش داده می‌شود.
        </p>
      )}

      {zoneShapeTool === 'polygon' && !pendingPolygon ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPoints.length === 0}
            onClick={undoLastPoint}
          >
            حذف آخرین نقطه
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPoints.length === 0}
            onClick={() => setCurrentPoints([])}
          >
            لغو رسم
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-amber-500 text-white hover:bg-amber-600"
            disabled={currentPoints.length < 3}
            onClick={closePolygon}
          >
            پایان رسم زون
          </Button>
        </div>
      ) : null}
    </div>
  )
}
