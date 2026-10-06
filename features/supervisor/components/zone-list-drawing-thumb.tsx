'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ZoneMapCanvas } from '@/features/supervisor/components/zone-map-svg'
import { prefetchDrawingPreview } from '@/features/supervisor/components/drawing-file-preview'
import type { DefinedZone } from '@/features/supervisor/lib/drawings-zoning-mock'
import type { ProjectDrawing } from '@/features/technical-office/lib/drawings-shared'

export function ZoneListDrawingThumb({
  zone,
  drawing,
  onClick,
  onDrawingResolved,
}: {
  zone: DefinedZone
  drawing: ProjectDrawing | null
  onClick: () => void
  onDrawingResolved?: (drawing: ProjectDrawing) => void
}) {
  const [resolved, setResolved] = useState<ProjectDrawing | null>(drawing)
  const [loading, setLoading] = useState(!drawing)
  const onResolvedRef = useRef(onDrawingResolved)
  onResolvedRef.current = onDrawingResolved

  useEffect(() => {
    if (drawing) {
      setResolved(drawing)
      setLoading(false)
      prefetchDrawingPreview(drawing.id, drawing.fileName, true)
      return
    }

    let cancelled = false
    setLoading(true)
    setResolved(null)

    void fetch(
      `/api/technical-office/drawings/${encodeURIComponent(zone.drawingId)}/meta`
    )
      .then((res) => res.json().catch(() => ({})))
      .then((data: { drawing?: ProjectDrawing }) => {
        if (cancelled || !data.drawing) return
        setResolved(data.drawing)
        onResolvedRef.current?.(data.drawing)
        prefetchDrawingPreview(data.drawing.id, data.drawing.fileName, true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [drawing, zone.drawingId])

  if (loading) {
    return (
      <div
        className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-white sm:h-24 sm:w-24"
        aria-busy="true"
      >
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
      </div>
    )
  }

  if (!resolved) {
    return (
      <div
        className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 text-center text-[10px] font-medium text-rose-700 sm:h-24 sm:w-24"
        title="نقشه در دسترس نیست"
      >
        نقشه ناموجود
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group shrink-0 overflow-hidden rounded-lg border border-white bg-white shadow-sm ring-1 ring-emerald-100 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      aria-label={`بزرگنمایی شمای نقشه — ${zone.name}`}
    >
      <div className="h-[88px] w-[88px] sm:h-24 sm:w-24">
        <ZoneMapCanvas drawing={resolved} zones={[zone]} highlightZoneId={zone.id} />
      </div>
      <p className="border-t border-slate-100 bg-slate-50 px-1 py-0.5 text-[9px] font-medium text-slate-600 group-hover:text-emerald-800">
        کلیک — بزرگنمایی
      </p>
    </button>
  )
}
