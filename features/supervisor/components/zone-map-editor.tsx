/**
 * @file features/supervisor/components/zone-map-editor.tsx
 * @purpose کامپوننت UI — سرپرست کارگاه و گزارش روزانه (zone-map-editor)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on features/supervisor/components/zone-map-svg, features/supervisor/components/drawing-file-preview, shared/components/ui/button, shared/components/ui/input, features/supervisor/lib/drawings-zoning-mock, features/technical-office/lib/drawing-discipline, features/technical-office/lib/drawings-shared, shared/lib/utils
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
Building2,
Circle,
Cog,
Eraser,
Hexagon,
Layers,
Minus,
Pencil,
PenTool,
Square,
Type,
Zap,
} from 'lucide-react'
import { ZoneMapCanvas, ZoneMapThumbnail } from '@/features/supervisor/components/zone-map-svg'
import { prefetchDrawingPreview } from '@/features/supervisor/components/drawing-file-preview'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import type {
DefinedZone,
DrawingDiscipline,
MapAnnotation,
MapEditorTool,
PercentPoint,
ZoneShapeTool,
} from '@/features/supervisor/lib/drawings-zoning-mock'
import {
EDITOR_DISCIPLINES,
circlePolygon,
closePenPolygon,
drawingsForEditorDiscipline, rectanglePolygon,
snapAxisLineEnd,
squarePolygon,
polygonBBoxSize,
ZONE_COLOR_PRESETS
} from '@/features/supervisor/lib/drawings-zoning-mock'
import { drawingDisciplineLabel } from '@/features/technical-office/lib/drawing-discipline'
import type { ProjectDrawing } from '@/features/technical-office/lib/drawings-shared'
import { ZONE_MAP_COPY } from '@/features/supervisor/config'
import { cn } from '@/shared/lib/utils'
import { siteSupervisorT } from '@/shared/lib/i18n/site-supervisor'

const t = siteSupervisorT

const DISCIPLINE_ICONS = {
  structure: Building2,
  architecture: PenTool,
  mechanical: Cog,
  electrical: Zap,
  other: Layers,
} as const

const ANNOTATION_TOOLS: Array<{
  id: MapEditorTool
  label: string
  icon: typeof Pencil
  hint: string
}> = [
  { id: 'pen', label: t.toolPen, icon: Pencil, hint: t.toolPenHint },
  { id: 'freeline', label: t.toolFreeline, icon: Minus, hint: t.toolFreelineHint },
  { id: 'line', label: t.toolLine, icon: Minus, hint: t.toolLineHint },
  { id: 'text', label: t.toolText, icon: Type, hint: t.toolTextHint },
]

const ZONE_MARKING_TOOLS: Array<{
  id: MapEditorTool
  label: string
  icon: typeof Pencil
  hint: string
}> = [
  { id: 'pen', label: t.toolPen, icon: Pencil, hint: t.toolPenZoneHint },
  { id: 'text', label: t.toolText, icon: Type, hint: t.toolTextHint },
]

const ZONE_SHAPE_TOOLS: Array<{
  id: ZoneShapeTool
  label: string
  icon: typeof Square
  hint: string
}> = [
  { id: 'rectangle', label: t.toolRectangle, icon: Square, hint: t.toolRectangleHint },
  { id: 'square', label: t.toolSquare, icon: Square, hint: t.toolSquareHint },
  { id: 'circle', label: t.toolCircle, icon: Circle, hint: t.toolCircleHint },
  { id: 'polygon', label: t.toolPolygon, icon: Hexagon, hint: t.toolPolygonHint },
]

const DRAG_ZONE_SHAPES: ZoneShapeTool[] = ['rectangle', 'square', 'circle']
const LINE_TOOLS: MapEditorTool[] = ['line', 'freeline']
const MIN_LINE_LEN = 0.35
const MIN_DRAG_LEN = 0.035

type ZoneMapEditorProps = {
  drawings: ProjectDrawing[]
  selectedDrawing: ProjectDrawing
  selectedDrawingId: string
  onSelectDrawing: (id: string) => void
  zones: DefinedZone[]
  highlightZoneId?: string | null
  currentPoints: PercentPoint[]
  pendingZonePolygon?: PercentPoint[] | null
  zoneShapeTool: ZoneShapeTool
  onZoneShapeToolChange: (tool: ZoneShapeTool) => void
  zoneColorPresetId: string
  onZoneColorPresetChange: (id: string) => void
  onZoneShapeComplete: (polygon: PercentPoint[]) => void
  onClearPendingZone?: () => void
  onZoneClick?: (point: PercentPoint) => void
  onZoneDoubleClick?: () => void
  /** فقط رسم محدوده زون — بدون ابزار علامت‌گذاری */
  zoneMarkingOnly?: boolean
}

export function ZoneMapEditor({
  drawings,
  selectedDrawing,
  selectedDrawingId,
  onSelectDrawing,
  zones,
  highlightZoneId,
  currentPoints,
  pendingZonePolygon = null,
  zoneShapeTool,
  onZoneShapeToolChange,
  zoneColorPresetId,
  onZoneColorPresetChange,
  onZoneShapeComplete,
  onClearPendingZone,
  onZoneClick,
  onZoneDoubleClick,
  zoneMarkingOnly = false,
}: ZoneMapEditorProps) {
  const [discipline, setDiscipline] = useState<DrawingDiscipline>(() =>
    zoneMarkingOnly ? 'structure' : selectedDrawing.discipline
  )
  const [annotationTool, setAnnotationTool] = useState<MapEditorTool | null>(null)
  const [annotationsByDrawing, setAnnotationsByDrawing] = useState<Record<string, MapAnnotation[]>>({})
  const [penPoints, setPenPoints] = useState<PercentPoint[]>([])
  const [isPenDrawing, setIsPenDrawing] = useState(false)
  const [lineAnchor, setLineAnchor] = useState<PercentPoint | null>(null)
  const [linePreview, setLinePreview] = useState<PercentPoint | null>(null)
  const [textAnchor, setTextAnchor] = useState<PercentPoint | null>(null)
  const [textInput, setTextInput] = useState('')
  const [shapeAnchor, setShapeAnchor] = useState<PercentPoint | null>(null)
  const [shapePreview, setShapePreview] = useState<PercentPoint | null>(null)
  const penRef = useRef(false)
  const penPointsRef = useRef<PercentPoint[]>([])
  const lineDragRef = useRef(false)
  const shapeDragRef = useRef(false)
  const [shapeHint, setShapeHint] = useState<string | null>(null)
  const zoneMarkingBootRef = useRef(false)

  const disciplineDrawings = drawingsForEditorDiscipline(drawings, discipline)
  const annotations = annotationsByDrawing[selectedDrawingId] ?? []
  const colorPreset =
    ZONE_COLOR_PRESETS.find((p) => p.id === zoneColorPresetId) ?? ZONE_COLOR_PRESETS[0]

  useEffect(() => {
    if (zoneMarkingOnly) return
    if (EDITOR_DISCIPLINES.includes(selectedDrawing.discipline)) {
      setDiscipline(selectedDrawing.discipline)
    }
  }, [zoneMarkingOnly, selectedDrawing.discipline, selectedDrawingId])

  useEffect(() => {
    if (!zoneMarkingOnly) {
      zoneMarkingBootRef.current = false
      return
    }
    if (zoneMarkingBootRef.current) return
    zoneMarkingBootRef.current = true
    setDiscipline('structure')
    const structureDrawings = drawingsForEditorDiscipline(drawings, 'structure')
    const pick = structureDrawings[0]
    if (pick) onSelectDrawing(pick.id)
  }, [zoneMarkingOnly, drawings, onSelectDrawing])

  function handleDisciplineChange(next: DrawingDiscipline) {
    setDiscipline(next)
    const inDiscipline = drawingsForEditorDiscipline(drawings, next)
    if (inDiscipline.length > 0) {
      onSelectDrawing(inDiscipline[0].id)
    }
  }

  const previewLine = lineAnchor && linePreview ? { from: lineAnchor, to: linePreview } : null

  const previewZonePolygon = (() => {
    if (!shapeAnchor || !shapePreview || !DRAG_ZONE_SHAPES.includes(zoneShapeTool)) return null
    if (zoneShapeTool === 'rectangle') return rectanglePolygon(shapeAnchor, shapePreview)
    if (zoneShapeTool === 'square') return squarePolygon(shapeAnchor, shapePreview)
    if (zoneShapeTool === 'circle') return circlePolygon(shapeAnchor, shapePreview)
    return null
  })()

  const previewZone =
    pendingZonePolygon && pendingZonePolygon.length >= 3
      ? { points: pendingZonePolygon, stroke: colorPreset.stroke, fill: colorPreset.fill }
      : zoneMarkingOnly && annotationTool === 'pen' && penPoints.length >= 3
        ? (() => {
            const closed = closePenPolygon(penPoints) ?? penPoints
            return { points: closed, stroke: colorPreset.stroke, fill: colorPreset.fill }
          })()
        : previewZonePolygon && previewZonePolygon.length >= 3
          ? { points: previewZonePolygon, stroke: colorPreset.stroke, fill: colorPreset.fill }
          : zoneShapeTool === 'polygon' && currentPoints.length >= 3
            ? { points: currentPoints, stroke: colorPreset.stroke, fill: colorPreset.fill }
            : null

  const addAnnotation = useCallback(
    (ann: MapAnnotation) => {
      setAnnotationsByDrawing((prev) => ({
        ...prev,
        [selectedDrawingId]: [...(prev[selectedDrawingId] ?? []), ann],
      }))
    },
    [selectedDrawingId]
  )

  function clearLineDraft() {
    lineDragRef.current = false
    setLineAnchor(null)
    setLinePreview(null)
  }

  function clearShapeDraft() {
    shapeDragRef.current = false
    setShapeAnchor(null)
    setShapePreview(null)
  }

  function resetPenDraft() {
    penRef.current = false
    penPointsRef.current = []
    setIsPenDrawing(false)
    setPenPoints([])
  }

  function resetAnnotationDraft() {
    clearLineDraft()
    setTextAnchor(null)
    setTextInput('')
    resetPenDraft()
  }

  function resetAllDrafts() {
    resetAnnotationDraft()
    clearShapeDraft()
  }

  function selectAnnotationTool(next: MapEditorTool) {
    setAnnotationTool(next)
    resetAnnotationDraft()
    // در حالت زون‌بندی، محدوده رسم‌شده با قلم هنگام تعویض ابزار (مثلاً متن) حفظ شود.
    if (!zoneMarkingOnly) {
      onClearPendingZone?.()
    }
  }

  function selectZoneShapeTool(next: ZoneShapeTool) {
    if (next !== zoneShapeTool) {
      onClearPendingZone?.()
    }
    onZoneShapeToolChange(next)
    setAnnotationTool(null)
    resetAllDrafts()
  }

  useEffect(() => {
    prefetchDrawingPreview(selectedDrawing.id, selectedDrawing.fileName, true)
  }, [selectedDrawing.id, selectedDrawing.fileName])

  useEffect(() => {
    if (!zoneMarkingOnly) return
    setAnnotationTool('pen')
    resetAnnotationDraft()
  }, [zoneMarkingOnly, selectedDrawingId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      resetAllDrafts()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function commitText() {
    if (!textAnchor || textInput.trim().length === 0) {
      setTextAnchor(null)
      setTextInput('')
      return
    }
    addAnnotation({
      id: `ann-${Date.now()}`,
      type: 'text',
      position: textAnchor,
      text: textInput.trim(),
    })
    setTextAnchor(null)
    setTextInput('')
  }

  function lineLength(from: PercentPoint, to: PercentPoint) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function polygonFromShapeDrag(from: PercentPoint, to: PercentPoint): PercentPoint[] {
    if (zoneShapeTool === 'rectangle') return rectanglePolygon(from, to)
    if (zoneShapeTool === 'square') return squarePolygon(from, to)
    if (zoneShapeTool === 'circle') return circlePolygon(from, to)
    return []
  }

  function buildZonePolygon(from: PercentPoint, to: PercentPoint): PercentPoint[] | null {
    const polygon = polygonFromShapeDrag(from, to)
    if (polygon.length < 3) return null
    const bbox = polygonBBoxSize(polygon)
    if (zoneMarkingOnly && bbox >= 0.012) return polygon
    const dragLen = lineLength(from, to)
    if (dragLen < MIN_DRAG_LEN) return null
    return polygon
  }

  function handlePointerDown(point: PercentPoint) {
    if (annotationTool === 'pen') {
      if (zoneMarkingOnly) onClearPendingZone?.()
      penRef.current = true
      penPointsRef.current = [point]
      setIsPenDrawing(true)
      setPenPoints([point])
      setShapeHint(null)
      return
    }

    if (annotationTool && LINE_TOOLS.includes(annotationTool)) {
      lineDragRef.current = true
      setLineAnchor(point)
      setLinePreview(point)
      return
    }

    if (annotationTool === 'text') {
      setTextAnchor(point)
      setTextInput('')
      return
    }

    if (DRAG_ZONE_SHAPES.includes(zoneShapeTool)) {
      setShapeHint(null)
      shapeDragRef.current = true
      setShapeAnchor(point)
      setShapePreview(point)
      return
    }

    if (zoneShapeTool === 'polygon' && onZoneClick) {
      onZoneClick(point)
    }
  }

  function handlePointerMove(point: PercentPoint) {
    if (annotationTool === 'pen' && penRef.current) {
      const last = penPointsRef.current[penPointsRef.current.length - 1]
      if (last) {
        const dx = point.x - last.x
        const dy = point.y - last.y
        if (dx * dx + dy * dy < 0.06) return
      }
      penPointsRef.current = [...penPointsRef.current, point]
      setPenPoints(penPointsRef.current)
      return
    }

    if (annotationTool && LINE_TOOLS.includes(annotationTool) && lineDragRef.current && lineAnchor) {
      setLinePreview(
        annotationTool === 'line' ? snapAxisLineEnd(lineAnchor, point) : point
      )
      return
    }

    if (shapeDragRef.current && shapeAnchor && DRAG_ZONE_SHAPES.includes(zoneShapeTool)) {
      setShapePreview(point)
    }
  }

  function handlePointerUp(point: PercentPoint) {
    if (annotationTool === 'pen' && penRef.current) {
      penRef.current = false
      setIsPenDrawing(false)
      const pts = penPointsRef.current
      penPointsRef.current = []
      setPenPoints([])

      if (zoneMarkingOnly) {
        const polygon = closePenPolygon(pts)
        if (polygon) {
          setShapeHint(null)
          onZoneShapeComplete(polygon)
        } else if (pts.length > 1) {
          setShapeHint(t.shapeTooSmallPen)
        }
        return
      }

      if (pts.length > 1) {
        addAnnotation({ id: `ann-${Date.now()}`, type: 'pen', points: pts })
      }
      return
    }

    if (annotationTool && LINE_TOOLS.includes(annotationTool) && lineDragRef.current && lineAnchor) {
      lineDragRef.current = false
      const to =
        annotationTool === 'line' ? snapAxisLineEnd(lineAnchor, point) : point
      if (lineLength(lineAnchor, to) >= MIN_LINE_LEN) {
        addAnnotation({
          id: `ann-${Date.now()}`,
          type: 'line',
          from: lineAnchor,
          to,
        })
      }
      clearLineDraft()
      return
    }

    if (shapeDragRef.current && shapeAnchor && DRAG_ZONE_SHAPES.includes(zoneShapeTool)) {
      shapeDragRef.current = false
      const polygon = buildZonePolygon(shapeAnchor, point)
      if (polygon) {
        clearShapeDraft()
        setShapeHint(null)
        onZoneShapeComplete(polygon)
      } else {
        const fallback = polygonFromShapeDrag(shapeAnchor, point)
        if (fallback.length >= 3 && polygonBBoxSize(fallback) >= 0.012) {
          clearShapeDraft()
          setShapeHint(null)
          onZoneShapeComplete(fallback)
        } else {
          setShapeHint(t.shapeTooSmallDrag)
          setShapePreview(point)
        }
      }
    }
  }

  function eraseAnnotations() {
    setAnnotationsByDrawing((prev) => ({ ...prev, [selectedDrawingId]: [] }))
    resetAnnotationDraft()
  }

  const activeTool = zoneMarkingOnly ? annotationTool : annotationTool ?? zoneShapeTool
  const toolCursor =
    annotationTool === 'text'
      ? 'cursor-text'
      : activeTool
        ? 'cursor-crosshair'
        : 'cursor-default'

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">{ZONE_MAP_COPY.discipline}</p>
        <div className="flex flex-wrap gap-2">
          {EDITOR_DISCIPLINES.map((d) => {
            const Icon = DISCIPLINE_ICONS[d]
            const active = discipline === d
            const count = drawings.filter((item) => item.discipline === d).length
            return (
              <button
                key={d}
                type="button"
                onClick={() => handleDisciplineChange(d)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {drawingDisciplineLabel(d)}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {count.toLocaleString('fa-IR-u-nu-latn')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">{ZONE_MAP_COPY.pickDrawing}</p>
        {disciplineDrawings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            {ZONE_MAP_COPY.noDrawingsInDiscipline}
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
            {disciplineDrawings.map((d) => (
              <ZoneMapThumbnail
                key={d.id}
                drawing={d}
                selected={d.id === selectedDrawingId}
                deferPreview
                onSelect={() => {
                  prefetchDrawingPreview(d.id, d.fileName, true)
                  onSelectDrawing(d.id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600">{ZONE_MAP_COPY.zoneColor}</span>
          {ZONE_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              onClick={() => onZoneColorPresetChange(preset.id)}
              className={cn(
                'h-7 w-7 rounded-full border-2 shadow-sm transition-transform',
                zoneColorPresetId === preset.id
                  ? 'scale-110 border-slate-900'
                  : 'border-white hover:scale-105'
              )}
              style={{ backgroundColor: preset.stroke }}
              aria-label={preset.label}
              aria-pressed={zoneColorPresetId === preset.id}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-2">
          {zoneMarkingOnly ? (
            <>
              <span className="text-[11px] font-semibold text-slate-600">{ZONE_MAP_COPY.drawTool}</span>
              {ZONE_MARKING_TOOLS.map((item) => {
                const Icon = item.icon
                const active = annotationTool === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.hint}
                    onClick={() => selectAnnotationTool(item.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </button>
                )
              })}
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold text-slate-600">{ZONE_MAP_COPY.zoneShape}</span>
              {ZONE_SHAPE_TOOLS.map((item) => {
                const Icon = item.icon
                const active = !annotationTool && zoneShapeTool === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.hint}
                    onClick={() => selectZoneShapeTool(item.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </button>
                )
              })}
            </>
          )}
        </div>

        {!zoneMarkingOnly ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-2">
          <span className="text-[11px] font-semibold text-slate-600">{ZONE_MAP_COPY.marking}</span>
          {ANNOTATION_TOOLS.map((item) => {
            const Icon = item.icon
            const active = annotationTool === item.id
            return (
              <button
                key={item.id}
                type="button"
                title={item.hint}
                onClick={() => selectAnnotationTool(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={eraseAnnotations}
            disabled={annotations.length === 0}
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            {ZONE_MAP_COPY.eraseMarks}
          </Button>
        </div>
        ) : null}

        {annotationTool === 'text' ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t.textPlaceholder}
              className="h-8 max-w-[220px] bg-white text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitText()
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 bg-sky-600 hover:bg-sky-700"
              disabled={!textAnchor || textInput.trim().length === 0}
              onClick={commitText}
            >
              {ZONE_MAP_COPY.saveText}
            </Button>
            <span className="text-[11px] text-slate-500">
              {textAnchor ? t.textPlaced : t.clickMapFirst}
            </span>
          </div>
        ) : null}

        {zoneMarkingOnly ? (
          <p className="border-t border-slate-200/80 pt-2 text-xs text-slate-600">
            {annotationTool === 'text'
              ? t.textClickWriteConfirm
              : t.penAroundEsc}
          </p>
        ) : null}
      </div>

      {shapeHint ? (
        <p className="text-xs font-medium text-amber-700">{shapeHint}</p>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
        <div className="aspect-[16/10] min-h-[320px] w-full sm:min-h-[420px]">
          <ZoneMapCanvas
            key={selectedDrawingId}
            drawing={selectedDrawing}
            zones={zones}
            highlightZoneId={highlightZoneId}
            currentPoints={zoneShapeTool === 'polygon' ? currentPoints : []}
            annotations={annotations}
            previewPen={isPenDrawing ? penPoints : []}
            previewLine={previewLine}
            previewZone={previewZone}
            textMarker={textAnchor}
            interactive
            toolCursor={toolCursor}
            onMapDoubleClick={
              zoneShapeTool === 'polygon' && !annotationTool ? onZoneDoubleClick : undefined
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {zoneMarkingOnly
          ? annotationTool === 'text'
            ? t.textClickWriteConfirmShort
            : t.penAroundEscShort
          : annotationTool === 'pen'
            ? t.penOnMapEsc
            : annotationTool === 'freeline'
              ? t.freelineEsc
              : annotationTool === 'line'
                ? t.axisLineEsc
                : annotationTool === 'text'
                  ? t.textClickWriteSave
                  : zoneShapeTool === 'polygon'
                    ? t.polygonHint
                    : t.dragShapeHint}
      </p>
    </div>
  )
}
