'use client'

import { useEffect, useState } from 'react'
import type { DrawingFormat } from '@/lib/technical-office/drawings-shared'
import { projectDrawingPreviewPath } from '@/lib/technical-office/drawings-shared'
import { fetchDrawingBytes, sniffDrawingKind } from '@/lib/qc-engine/drawing-file'
import { renderPdfPage } from '@/lib/qc-engine/pdfjs'
import { cn } from '@/lib/utils'

/** کیفیت سریع برای علامت‌گذاری — ابتدا نمایش، بعد ارتقا */
const MARKING_QUICK_DIM = 640
const MARKING_FULL_DIM = 1200
const THUMB_DIM = 200
const DEFAULT_DIM = 1200

const rasterCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()
const bytesInflight = new Map<
  string,
  Promise<{ bytes: Uint8Array; fileName: string; contentType: string }>
>()

function cacheKey(drawingId: string, maxDim: number) {
  return `${drawingId}@${maxDim}`
}

function findCachedRaster(drawingId: string, minDim: number): string | null {
  let bestUrl: string | null = null
  let bestDim = 0
  for (const [key, url] of rasterCache) {
    if (!key.startsWith(`${drawingId}@`)) continue
    const dim = Number(key.split('@')[1])
    if (dim >= minDim && dim > bestDim) {
      bestDim = dim
      bestUrl = url
    }
  }
  return bestUrl
}

async function getDrawingFile(drawingId: string) {
  const pending = bytesInflight.get(drawingId)
  if (pending) return pending
  const promise = fetchDrawingBytes(drawingId)
  bytesInflight.set(drawingId, promise)
  try {
    return await promise
  } finally {
    bytesInflight.delete(drawingId)
  }
}

async function loadRasterPreview(drawingId: string, fileName: string, maxDim: number) {
  const key = cacheKey(drawingId, maxDim)
  const cached = rasterCache.get(key)
  if (cached) return cached

  const inflightKey = key
  const pending = inflight.get(inflightKey)
  if (pending) return pending

  const promise = (async () => {
    const name = fileName.toLowerCase()
    if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
      const url = projectDrawingPreviewPath(drawingId)
      rasterCache.set(key, url)
      return url
    }

    const file = await getDrawingFile(drawingId)
    const kind = sniffDrawingKind(file.bytes, file.fileName, file.contentType)
    if (kind === 'image') {
      const url = URL.createObjectURL(new Blob([new Uint8Array(file.bytes)]))
      rasterCache.set(key, url)
      return url
    }
    if (kind === 'pdf') {
      const canvas = document.createElement('canvas')
      const quality = maxDim <= MARKING_QUICK_DIM ? 0.72 : 0.82
      await renderPdfPage(file.bytes, canvas, 1, maxDim)
      const url = canvas.toDataURL('image/jpeg', quality)
      rasterCache.set(key, url)
      return url
    }
    return null
  })()

  inflight.set(inflightKey, promise)
  try {
    return await promise
  } finally {
    inflight.delete(inflightKey)
  }
}

/** پیش‌بارگذاری قبل از باز شدن ویرایشگر نقشه */
export function prefetchDrawingPreview(
  drawingId: string,
  fileName: string,
  overlay = true
) {
  if (overlay) {
    void loadRasterPreview(drawingId, fileName, MARKING_QUICK_DIM)
    void loadRasterPreview(drawingId, fileName, MARKING_FULL_DIM)
  } else {
    void loadRasterPreview(drawingId, fileName, THUMB_DIM)
  }
}

function isImageFormat(format: DrawingFormat, fileName: string): boolean {
  if (/\.(png|jpe?g|webp|gif)$/i.test(fileName)) return true
  return false
}

export function DrawingFilePreview({
  drawingId,
  format,
  fileName,
  className,
  title,
  overlayMode = false,
  thumbnail = false,
  defer = false,
  onMediaAspect,
}: {
  drawingId: string
  format: DrawingFormat
  fileName: string
  className?: string
  title?: string
  overlayMode?: boolean
  thumbnail?: boolean
  defer?: boolean
  onMediaAspect?: (aspect: number) => void
}) {
  const isPdf = format === 'pdf' || fileName.toLowerCase().endsWith('.pdf')
  const useRaster = overlayMode || thumbnail || isPdf
  const targetDim = thumbnail ? THUMB_DIM : overlayMode ? MARKING_FULL_DIM : DEFAULT_DIM
  const quickDim = overlayMode ? MARKING_QUICK_DIM : targetDim

  const initialSrc =
    rasterCache.get(cacheKey(drawingId, targetDim)) ??
    findCachedRaster(drawingId, quickDim) ??
    rasterCache.get(cacheKey(drawingId, quickDim)) ??
    null

  const [rasterSrc, setRasterSrc] = useState<string | null>(initialSrc)
  const [loading, setLoading] = useState(useRaster && !defer && !initialSrc)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!useRaster || defer) return

    let cancelled = false

    const cached =
      rasterCache.get(cacheKey(drawingId, targetDim)) ??
      findCachedRaster(drawingId, targetDim) ??
      rasterCache.get(cacheKey(drawingId, quickDim))

    if (cached) {
      setRasterSrc(cached)
      setLoading(false)
      setFailed(false)
      if (!rasterCache.has(cacheKey(drawingId, targetDim)) && targetDim > quickDim) {
        loadRasterPreview(drawingId, fileName, targetDim).then((url) => {
          if (!cancelled && url) setRasterSrc(url)
        })
      }
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    setFailed(false)

    const load = async () => {
      if (overlayMode && targetDim > quickDim) {
        const quick = await loadRasterPreview(drawingId, fileName, quickDim)
        if (cancelled) return
        if (quick) {
          setRasterSrc(quick)
          setLoading(false)
        }
        const full = await loadRasterPreview(drawingId, fileName, targetDim)
        if (cancelled) return
        if (full) setRasterSrc(full)
        else if (!quick) setFailed(true)
      } else {
        const url = await loadRasterPreview(drawingId, fileName, targetDim)
        if (cancelled) return
        if (url) setRasterSrc(url)
        else setFailed(true)
      }
    }

    load()
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [drawingId, fileName, targetDim, quickDim, overlayMode, useRaster, defer])

  useEffect(() => {
    if (defer) setLoading(false)
  }, [defer])

  useEffect(() => {
    if (!rasterSrc || !onMediaAspect) return
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        onMediaAspect(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = rasterSrc
  }, [rasterSrc, onMediaAspect])

  const blockPointer =
    overlayMode || thumbnail ? ({ pointerEvents: 'none' as const }) : undefined
  const mediaClass = cn(
    'h-full w-full border-0 bg-white pointer-events-none select-none',
    overlayMode ? 'object-contain' : thumbnail ? 'object-contain' : 'object-contain',
    className
  )

  if (useRaster) {
    if (defer && !rasterSrc) {
      return (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center bg-slate-100 text-[10px] text-slate-400',
            className
          )}
          style={blockPointer}
        >
          انتخاب
        </div>
      )
    }

    if (loading && !rasterSrc) {
      return (
        <div
          className={cn(
            'flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 text-xs text-slate-500',
            className
          )}
          style={blockPointer}
        >
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
          بارگذاری نقشه…
        </div>
      )
    }

    if (failed || format === 'dwg' || (!rasterSrc && !isImageFormat(format, fileName))) {
      return (
        <div
          className={cn(
            'flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-4 text-center text-sm text-slate-600',
            className
          )}
          style={blockPointer}
        >
          <p className="font-medium text-slate-800">پیش‌نمایش DWG در مرورگر پشتیبانی نمی‌شود</p>
          <p className="text-xs text-slate-500">
            فایل بارگذاری‌شده ذخیره شده — برای زون‌بندی از نقشه PDF استفاده کنید.
          </p>
        </div>
      )
    }

    if (rasterSrc) {
      return (
        <div
          className={cn('relative h-full w-full overflow-hidden', overlayMode && 'pointer-events-none')}
          style={blockPointer}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rasterSrc}
            alt={title ?? 'نقشه'}
            className={mediaClass}
            style={blockPointer}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget
              if (onMediaAspect && img.naturalWidth > 0 && img.naturalHeight > 0) {
                onMediaAspect(img.naturalWidth / img.naturalHeight)
              }
            }}
          />
          {loading ? (
            <div
              className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[10px] text-slate-600 shadow-sm"
              style={blockPointer}
            >
              در حال بهبود کیفیت…
            </div>
          ) : null}
        </div>
      )
    }
  }

  const src = projectDrawingPreviewPath(drawingId)

  if (isImageFormat(format, fileName)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title ?? 'نقشه'}
        className={cn(mediaClass, 'object-contain')}
        style={blockPointer}
        draggable={false}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-4 text-center text-sm text-slate-600',
        className
      )}
      style={blockPointer}
    >
      <p className="font-medium text-slate-800">پیش‌نمایش در دسترس نیست</p>
    </div>
  )
}
