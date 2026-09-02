'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DrawingFilePreview } from '@/components/supervisor/drawing-file-preview'
import type {
  DefinedZone,
  MapAnnotation,
  PercentPoint,
} from '@/lib/supervisor/drawings-zoning-mock'
import {
  polygonCentroid,
  pointsToSvgAttr,
} from '@/lib/supervisor/drawings-zoning-mock'
import type { ProjectDrawing } from '@/lib/technical-office/drawings-shared'
import { cn } from '@/lib/utils'

export function pointFromClientRect(
  rect: DOMRectReadOnly,
  clientX: number,
  clientY: number
): PercentPoint {
  if (rect.width <= 0 || rect.height <= 0) return { x: 50, y: 50 }
  return {
    x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
  }
}

/** Letterboxed media rect inside a container (matches CSS object-contain). */
export function letterboxInContainer(
  containerWidth: number,
  containerHeight: number,
  mediaAspect: number
) {
  const cw = containerWidth
  const ch = containerHeight
  if (cw <= 0 || ch <= 0 || !mediaAspect || mediaAspect <= 0) {
    return { drawW: cw, drawH: ch, offsetX: 0, offsetY: 0 }
  }

  const containerAspect = cw / ch
  let drawW: number
  let drawH: number
  let offsetX = 0
  let offsetY = 0

  if (mediaAspect > containerAspect) {
    drawW = cw
    drawH = cw / mediaAspect
    offsetY = (ch - drawH) / 2
  } else {
    drawH = ch
    drawW = ch * mediaAspect
    offsetX = (cw - drawW) / 2
  }

  return { drawW, drawH, offsetX, offsetY }
}

/** Map pointer to 0–100 coords inside letterboxed media (object-contain). */
export function pointFromContainedMedia(
  containerRect: DOMRectReadOnly,
  clientX: number,
  clientY: number,
  mediaAspect: number
): PercentPoint {
  const cw = containerRect.width
  const ch = containerRect.height
  if (cw <= 0 || ch <= 0) return { x: 50, y: 50 }
  if (!mediaAspect || mediaAspect <= 0) {
    return pointFromClientRect(containerRect, clientX, clientY)
  }

  const { drawW, drawH, offsetX, offsetY } = letterboxInContainer(cw, ch, mediaAspect)

  if (drawW <= 0 || drawH <= 0) {
    return pointFromClientRect(containerRect, clientX, clientY)
  }

  const relX = clientX - containerRect.left - offsetX
  const relY = clientY - containerRect.top - offsetY

  return {
    x: Math.max(0, Math.min(100, (relX / drawW) * 100)),
    y: Math.max(0, Math.min(100, (relY / drawH) * 100)),
  }
}

function MapGraphics({
  drawing,
  zones,
  highlightZoneId,
  currentPoints,
  annotations,
  previewPen,
  previewLine,
  previewZone,
  textMarker,
}: {
  drawing: ProjectDrawing
  zones: DefinedZone[]
  highlightZoneId: string | null
  currentPoints: PercentPoint[]
  annotations: MapAnnotation[]
  previewPen: PercentPoint[]
  previewLine: { from: PercentPoint; to: PercentPoint } | null
  previewZone: { points: PercentPoint[]; stroke: string; fill: string } | null
  textMarker: PercentPoint | null
}) {
  const drawingZones = zones.filter((z) => z.drawingId === drawing.id)

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-full w-full select-none"
      aria-hidden="true"
    >
      {drawingZones.map((zone) => {
        const isHighlight = highlightZoneId === zone.id
        const centroid = polygonCentroid(zone.polygon)
        return (
          <g key={zone.id}>
            <polygon
              points={pointsToSvgAttr(zone.polygon)}
              fill={zone.fillColor}
              stroke={zone.color}
              strokeWidth={isHighlight ? 0.8 : 0.5}
              opacity={highlightZoneId && !isHighlight ? 0.35 : 1}
            />
            <text
              x={centroid.x}
              y={centroid.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="3"
              fill="#1e293b"
              fontWeight="600"
              fontFamily="Vazirmatn, Tahoma, sans-serif"
            >
              {zone.name.length > 18 ? `${zone.name.slice(0, 16)}…` : zone.name}
            </text>
          </g>
        )
      })}

      {currentPoints.length > 0 ? (
        <g>
          {currentPoints.length >= 3 ? (
            <polygon
              points={pointsToSvgAttr(currentPoints)}
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#f59e0b"
              strokeWidth="0.6"
              strokeDasharray="2 1.5"
            />
          ) : null}
          {currentPoints.map((p, i) => (
            <circle key={`pt-${i}`} cx={p.x} cy={p.y} r="1.4" fill="#f59e0b" stroke="#fff" strokeWidth="0.35" />
          ))}
        </g>
      ) : null}

      {previewZone && previewZone.points.length >= 3 ? (
        <polygon
          points={pointsToSvgAttr(previewZone.points)}
          fill={previewZone.fill}
          stroke={previewZone.stroke}
          strokeWidth="0.7"
          strokeDasharray="2 1.5"
        />
      ) : null}

      {annotations.map((ann) => {
        if (ann.type === 'pen' && ann.points.length > 1) {
          return (
            <polyline
              key={ann.id}
              points={pointsToSvgAttr(ann.points)}
              fill="none"
              stroke="#dc2626"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        }
        if (ann.type === 'text') {
          return (
            <text
              key={ann.id}
              x={ann.position.x}
              y={ann.position.y}
              fontSize="5"
              fill="#1e3a5f"
              fontWeight="700"
              fontFamily="Vazirmatn, Tahoma, sans-serif"
              paintOrder="stroke"
              stroke="#ffffff"
              strokeWidth="0.5"
            >
              {ann.text}
            </text>
          )
        }
        if (ann.type === 'line' || ann.type === 'hline' || ann.type === 'vline') {
          return (
            <line
              key={ann.id}
              x1={ann.from.x}
              y1={ann.from.y}
              x2={ann.to.x}
              y2={ann.to.y}
              stroke="#2563eb"
              strokeWidth="1.8"
            />
          )
        }
        return null
      })}

      {previewPen.length > 1 ? (
        <polyline
          points={pointsToSvgAttr(previewPen)}
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.8"
          strokeDasharray="2 1.5"
          strokeLinecap="round"
        />
      ) : null}

      {previewLine ? (
        <line
          x1={previewLine.from.x}
          y1={previewLine.from.y}
          x2={previewLine.to.x}
          y2={previewLine.to.y}
          stroke="#2563eb"
          strokeWidth="1.8"
          strokeDasharray="2 1.5"
        />
      ) : null}

      {textMarker ? (
        <circle
          cx={textMarker.x}
          cy={textMarker.y}
          r="1.6"
          fill="#0ea5e9"
          stroke="#fff"
          strokeWidth="0.4"
        />
      ) : null}
    </svg>
  )
}

type ZoneMapOverlayProps = {
  drawing: ProjectDrawing
  zones?: DefinedZone[]
  highlightZoneId?: string | null
  currentPoints?: PercentPoint[]
  annotations?: MapAnnotation[]
  previewPen?: PercentPoint[]
  previewLine?: { from: PercentPoint; to: PercentPoint } | null
  previewZone?: { points: PercentPoint[]; stroke: string; fill: string } | null
  textMarker?: PercentPoint | null
  interactive?: boolean
  toolCursor?: string
  onMapDoubleClick?: () => void
  onPointerDown?: (point: PercentPoint) => void
  onPointerMove?: (point: PercentPoint) => void
  onPointerUp?: (point: PercentPoint) => void
  className?: string
}

export function ZoneMapCanvas({
  drawing,
  zones = [],
  highlightZoneId = null,
  currentPoints = [],
  annotations = [],
  previewPen = [],
  previewLine = null,
  previewZone = null,
  textMarker = null,
  interactive = false,
  toolCursor,
  onMapDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  className,
}: ZoneMapOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const mediaAspectRef = useRef(1.35)
  const [mediaAspect, setMediaAspect] = useState(1.35)
  const [mediaLayout, setMediaLayout] = useState({
    drawW: 0,
    drawH: 0,
    offsetX: 0,
    offsetY: 0,
  })
  const handlersRef = useRef({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onMapDoubleClick,
  })

  handlersRef.current = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onMapDoubleClick,
  }

  useEffect(() => {
    if (!interactive) return
    const surface = surfaceRef.current
    const container = containerRef.current
    if (!surface || !container) return

    function toPoint(clientX: number, clientY: number): PercentPoint {
      return pointFromContainedMedia(
        container!.getBoundingClientRect(),
        clientX,
        clientY,
        mediaAspectRef.current
      )
    }

    function onPointerDownNative(e: PointerEvent) {
      if (e.button !== 0) return
      const { onPointerDown: down } = handlersRef.current
      if (!down) return
      e.preventDefault()
      e.stopPropagation()
      surface!.setPointerCapture(e.pointerId)
      down(toPoint(e.clientX, e.clientY))
    }

    function onPointerMoveNative(e: PointerEvent) {
      const { onPointerMove: move } = handlersRef.current
      if (!move) return
      move(toPoint(e.clientX, e.clientY))
    }

    function onPointerUpNative(e: PointerEvent) {
      const { onPointerUp: up } = handlersRef.current
      if (surface!.hasPointerCapture(e.pointerId)) {
        surface!.releasePointerCapture(e.pointerId)
      }
      if (up) up(toPoint(e.clientX, e.clientY))
    }

    function onDoubleClickNative(e: MouseEvent) {
      e.preventDefault()
      e.stopPropagation()
      handlersRef.current.onMapDoubleClick?.()
    }

    surface.addEventListener('pointerdown', onPointerDownNative)
    surface.addEventListener('pointermove', onPointerMoveNative)
    surface.addEventListener('pointerup', onPointerUpNative)
    surface.addEventListener('pointercancel', onPointerUpNative)
    surface.addEventListener('dblclick', onDoubleClickNative)

    return () => {
      surface.removeEventListener('pointerdown', onPointerDownNative)
      surface.removeEventListener('pointermove', onPointerMoveNative)
      surface.removeEventListener('pointerup', onPointerUpNative)
      surface.removeEventListener('pointercancel', onPointerUpNative)
      surface.removeEventListener('dblclick', onDoubleClickNative)
    }
  }, [interactive, drawing.id, mediaAspect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function updateLayout() {
      const rect = container!.getBoundingClientRect()
      const layout = letterboxInContainer(rect.width, rect.height, mediaAspectRef.current)
      setMediaLayout(layout)
    }

    updateLayout()
    const ro = new ResizeObserver(updateLayout)
    ro.observe(container)
    return () => ro.disconnect()
  }, [mediaAspect, drawing.id])

  function handleMediaAspect(aspect: number) {
    if (!aspect || aspect <= 0) return
    mediaAspectRef.current = aspect
    setMediaAspect(aspect)
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden bg-slate-100', className)}
    >
      <DrawingFilePreview
        drawingId={drawing.id}
        format={drawing.format}
        fileName={drawing.fileName}
        title={drawing.title}
        overlayMode={interactive}
        thumbnail={!interactive}
        onMediaAspect={handleMediaAspect}
        className="absolute inset-0 z-0 pointer-events-none"
      />

      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: mediaLayout.offsetX,
          top: mediaLayout.offsetY,
          width: mediaLayout.drawW,
          height: mediaLayout.drawH,
        }}
      >
        <MapGraphics
          drawing={drawing}
          zones={zones}
          highlightZoneId={highlightZoneId}
          currentPoints={currentPoints}
          annotations={annotations}
          previewPen={previewPen}
          previewLine={previewLine}
          previewZone={previewZone}
          textMarker={textMarker}
        />
      </div>

      {interactive ? (
        <div
          ref={surfaceRef}
          className={cn(
            'absolute inset-0 z-[60] touch-none select-none bg-transparent',
            toolCursor ?? 'cursor-crosshair'
          )}
          style={{ pointerEvents: 'auto', touchAction: 'none' }}
          role="application"
          aria-label={drawing.title}
        />
      ) : null}
    </div>
  )
}

/** Thumbnail — نقشه واقعی دفتر فنی */
export function ZoneMapThumbnail({
  drawing,
  selected,
  onSelect,
  deferPreview = false,
}: {
  drawing: ProjectDrawing
  selected?: boolean
  onSelect?: () => void
  /** فقط نقشه انتخاب‌شده پیش‌نمایش می‌گیرد — بارگذاری سریع‌تر */
  deferPreview?: boolean
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        onSelect?.()
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSelect?.()
      }}
      className={cn(
        'flex w-[140px] shrink-0 flex-col overflow-hidden rounded-lg border bg-white text-right shadow-sm transition-all',
        selected
          ? 'border-amber-500 ring-2 ring-amber-300/60'
          : 'border-slate-200 hover:border-slate-300 hover:shadow'
      )}
    >
      <div className="pointer-events-none aspect-[4/3] w-full bg-slate-50">
        <DrawingFilePreview
          drawingId={drawing.id}
          format={drawing.format}
          fileName={drawing.fileName}
          title={drawing.title}
          thumbnail
          defer={deferPreview && !selected}
          className="h-full w-full"
        />
      </div>
      <p className="line-clamp-2 px-2 py-1.5 text-[10px] font-medium leading-snug text-slate-800">
        {drawing.title}
      </p>
    </button>
  )
}

/** @deprecated use ZoneMapCanvas */
export function ZoneMapSvg(props: ZoneMapOverlayProps & { children?: ReactNode }) {
  return <ZoneMapCanvas {...props} />
}

/** @deprecated */
export function clickToPercent(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): PercentPoint {
  return pointFromClientRect(svg.getBoundingClientRect(), clientX, clientY)
}
