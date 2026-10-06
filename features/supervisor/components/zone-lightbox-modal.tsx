'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { ModalOverlay } from '@/features/supervisor/components/modal-overlay'
import { ZoneMapCanvas } from '@/features/supervisor/components/zone-map-svg'
import { formatZoneLevels } from '@/features/supervisor/components/zone-levels-field'
import { prefetchDrawingPreview } from '@/features/supervisor/components/drawing-file-preview'
import { Button } from '@/shared/components/ui/button'
import type { DefinedZone } from '@/features/supervisor/lib/drawings-zoning-mock'
import type { ProjectDrawing } from '@/features/technical-office/lib/drawings-shared'

type ZoneLightboxModalProps = {
  open: boolean
  zone: DefinedZone | null
  drawing: ProjectDrawing | null
  onClose: () => void
  onDownload: (drawingId: string) => void
}

export function ZoneLightboxModal({
  open,
  zone,
  drawing,
  onClose,
  onDownload,
}: ZoneLightboxModalProps) {
  const [resolvedDrawing, setResolvedDrawing] = useState<ProjectDrawing | null>(drawing)
  const [loadingMeta, setLoadingMeta] = useState(false)

  useEffect(() => {
    if (!open || !zone) {
      setResolvedDrawing(null)
      return
    }

    if (drawing) {
      setResolvedDrawing(drawing)
      prefetchDrawingPreview(drawing.id, drawing.fileName, true)
      return
    }

    let cancelled = false
    setLoadingMeta(true)
    setResolvedDrawing(null)

    void fetch(
      `/api/technical-office/drawings/${encodeURIComponent(zone.drawingId)}/meta`
    )
      .then((res) => res.json().catch(() => ({})))
      .then((data: { drawing?: ProjectDrawing }) => {
        if (cancelled || !data.drawing) return
        setResolvedDrawing(data.drawing)
        prefetchDrawingPreview(data.drawing.id, data.drawing.fileName, true)
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, zone, drawing])

  if (!open || !zone) return null

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title={zone.name}
      className="sm:max-w-[min(98vw,1280px)] sm:rounded-xl"
      overlayClassName="p-1 sm:p-3"
    >
      <div className="space-y-4" dir="rtl" lang="fa">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="aspect-[16/10] min-h-[min(60vh,560px)] w-full bg-slate-50">
              {loadingMeta ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  بارگذاری نقشه…
                </div>
              ) : resolvedDrawing ? (
                <ZoneMapCanvas
                  drawing={resolvedDrawing}
                  zones={[zone]}
                  highlightZoneId={zone.id}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-sm text-rose-700">
                  نقشه این زون در دسترس نیست.
                </div>
              )}
            </div>
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              شمای نقشه — محدوده علامت‌گذاری‌شده
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">عملیات نقشه</p>
            <Button
              type="button"
              className="w-full gap-2 bg-[#1e3a5f] hover:bg-[#152a45]"
              disabled={!resolvedDrawing}
              onClick={() => {
                if (resolvedDrawing) onDownload(resolvedDrawing.id)
              }}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              دانلود نقشه
            </Button>
            {resolvedDrawing ? (
              <p className="text-xs leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-800">{resolvedDrawing.title}</span>
                <br />
                <span className="font-mono text-[11px]">{resolvedDrawing.fileName}</span>
              </p>
            ) : null}
          </div>
        </div>

        <dl className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">نام زون</dt>
            <dd className="font-semibold text-slate-900">{zone.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">کد زون</dt>
            <dd className="font-mono font-semibold text-[#1e3a5f]">{zone.code?.trim() || '—'}</dd>
          </div>
          {zone.contractor?.trim() ? (
            <div>
              <dt className="text-[11px] font-semibold text-slate-500">نام پیمانکار زون</dt>
              <dd className="text-slate-700">{zone.contractor}</dd>
            </div>
          ) : null}
          {zone.levels?.some((l) => l.trim()) ? (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold text-slate-500">تراز زون</dt>
              <dd className="text-slate-700">{formatZoneLevels(zone.levels)}</dd>
            </div>
          ) : null}
          {zone.supervisor?.trim() ? (
            <div>
              <dt className="text-[11px] font-semibold text-slate-500">مسئول زون</dt>
              <dd className="text-slate-700">{zone.supervisor}</dd>
            </div>
          ) : null}
          {zone.description?.trim() ? (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold text-slate-500">توضیحات</dt>
              <dd className="text-slate-700">{zone.description}</dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold text-slate-500">نقشه مبدأ</dt>
            <dd className="font-medium text-slate-900">{zone.drawingTitle}</dd>
          </div>
        </dl>
      </div>
    </ModalOverlay>
  )
}
