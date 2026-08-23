'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { drawingFileUrl, fetchDrawingBytes, sniffDrawingKind } from '@/lib/qc-engine/drawing-file'
import { renderPdfPage } from '@/lib/qc-engine/pdfjs'

const cache = new Map<string, string>()

async function buildThumb(drawingId: string, fileName: string) {
  const cached = cache.get(drawingId)
  if (cached) return cached
  const name = fileName.toLowerCase()
  if (name.endsWith('.dwg')) return null
  if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
    const url = drawingFileUrl(drawingId)
    cache.set(drawingId, url)
    return url
  }
  const file = await fetchDrawingBytes(drawingId)
  const kind = sniffDrawingKind(file.bytes, file.fileName, file.contentType)
  if (kind === 'image') {
    const url = URL.createObjectURL(new Blob([file.bytes]))
    cache.set(drawingId, url)
    return url
  }
  if (kind !== 'pdf') return null
  const canvas = document.createElement('canvas')
  await renderPdfPage(file.bytes, canvas, 1, 280)
  const url = canvas.toDataURL('image/jpeg', 0.7)
  cache.set(drawingId, url)
  return url
}

export function QcDrawingThumb({
  drawingId,
  fileName,
  title,
}: {
  drawingId: string
  fileName: string
  title: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(cache.get(drawingId) ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (src || failed) return
    const node = wrapRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void buildThumb(drawingId, fileName)
          .then((url) => {
            if (url) setSrc(url)
            else setFailed(true)
          })
          .catch(() => setFailed(true))
      },
      { rootMargin: '120px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [drawingId, failed, fileName, src])

  return (
    <div
      ref={wrapRef}
      className="h-16 w-[4.75rem] shrink-0 overflow-hidden rounded-[8px] border border-slate-200 bg-slate-100"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="h-full w-full object-cover object-top" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-slate-500">
          <FileText className="h-5 w-5" />
        </span>
      )}
    </div>
  )
}

export function QcMarkedThumb({
  src,
  title,
  className,
}: {
  src: string
  title: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'h-24 w-28 shrink-0 overflow-hidden rounded-[8px] border border-slate-200 bg-slate-100',
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="h-full w-full object-cover object-top" />
    </div>
  )
}

export function QcBlobThumb({ blob, title }: { blob: Blob; title: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  if (!url) {
    return <div className="h-20 w-[5.75rem] shrink-0 rounded-[8px] border border-slate-200 bg-slate-100" />
  }
  return <QcMarkedThumb src={url} title={title} />
}
