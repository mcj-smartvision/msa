'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser, Pencil, Type, Undo2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { fetchDrawingBytes, fetchDrawingBytesFromUrl, sniffDrawingKind } from '@/features/qc/engine/drawing-file'
import { renderPdfPage } from '@/features/qc/engine/pdfjs'
import { cn } from '@/shared/lib/utils'

type Tool = 'pen' | 'eraser' | 'text'

export const QC_SUPERVISOR_PEN_COLOR = '#2563eb'
export const QC_INSPECTOR_PEN_COLOR = '#dc2626'

const SIZES = [3, 6, 12] as const
const FONT = 'Tahoma, "Segoe UI", Arial, sans-serif'

function cssTextSize(size: (typeof SIZES)[number]) {
  return size * 4
}

function hasPersian(value: string) {
  return /[\u0600-\u06FF]/.test(value)
}

export type QcDrawingMarkupHandle = {
  exportPng: () => Promise<File>
  canExport: () => boolean
}

function pointerPos(canvas: HTMLCanvasElement, event: React.PointerEvent) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  }
}

async function renderImage(bytes: Uint8Array, canvas: HTMLCanvasElement, maxDim = 2200) {
  const blob = new Blob([Uint8Array.from(bytes)])
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(maxDim / image.width, maxDim / image.height, 1)
    canvas.width = Math.max(1, Math.floor(image.width * scale))
    canvas.height = Math.max(1, Math.floor(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const QcDrawingMarkup = forwardRef<
  QcDrawingMarkupHandle,
  {
    drawingId: string
    drawingTitle: string
    fileUrl?: string | null
    labels: {
      pen: string
      eraser: string
      text: string
      textPlaceholder: string
      undo: string
      clear: string
      page: string
      unsupported: string
      saving: string
    }
    onError: (message: string) => void
    penColor?: string
  }
>(function QcDrawingMarkup({ drawingId, drawingTitle, fileUrl, labels, onError, penColor = QC_SUPERVISOR_PEN_COLOR }, ref) {
  const baseRef = useRef<HTMLCanvasElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const bytesRef = useRef<Uint8Array | null>(null)
  const errorRef = useRef(onError)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const history = useRef<ImageData[]>([])
  const inkByPage = useRef<Map<number, ImageData>>(new Map())

  const iframeObjectUrl = useRef<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [size, setSize] = useState<(typeof SIZES)[number]>(6)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [hasPage, setHasPage] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; left: number; top: number; value: string } | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const textDraftRef = useRef(textDraft)
  const ignoreTextBlur = useRef(false)
  textDraftRef.current = textDraft

  errorRef.current = onError

  const syncInkSize = useCallback(() => {
    const base = baseRef.current
    const ink = inkRef.current
    if (!base || !ink) return
    if (ink.width !== base.width || ink.height !== base.height) {
      ink.width = base.width
      ink.height = base.height
    }
  }, [])

  const snapshotInk = useCallback(() => {
    const ink = inkRef.current
    const ctx = ink?.getContext('2d')
    if (!ink || !ctx || ink.width === 0) return
    history.current.push(ctx.getImageData(0, 0, ink.width, ink.height))
    if (history.current.length > 30) history.current.shift()
  }, [])

  const commitText = useCallback(() => {
    const draft = textDraftRef.current
    const ink = inkRef.current
    const ctx = ink?.getContext('2d')
    const value = draft?.value.trim() ?? ''
    textDraftRef.current = null
    setTextDraft(null)
    if (!draft || !ink || !ctx || !value) return
    snapshotInk()
    const displayWidth = ink.getBoundingClientRect().width || ink.width
    const fontPx = cssTextSize(size) * (ink.width / Math.max(1, displayWidth))
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = penColor
    ctx.font = `700 ${fontPx}px ${FONT}`
    ctx.textBaseline = 'top'
    ctx.direction = hasPersian(value) ? 'rtl' : 'ltr'
    ctx.textAlign = 'left'
    ctx.fillText(value, draft.x, draft.y)
    ctx.restore()
  }, [penColor, size, snapshotInk])

  const placeText = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const ink = inkRef.current
      const wrap = wrapRef.current
      if (!ink || !wrap) return
      event.preventDefault()
      commitText()
      syncInkSize()
      const canvasPoint = pointerPos(ink, event)
      const box = wrap.getBoundingClientRect()
      const next = {
        x: canvasPoint.x,
        y: canvasPoint.y,
        left: event.clientX - box.left,
        top: event.clientY - box.top,
        value: '',
      }
      ignoreTextBlur.current = true
      textDraftRef.current = next
      setTextDraft(next)
      window.setTimeout(() => {
        textInputRef.current?.focus()
        textInputRef.current?.select()
        window.setTimeout(() => {
          ignoreTextBlur.current = false
        }, 250)
      }, 30)
    },
    [commitText, syncInkSize]
  )

  const replaceIframe = useCallback((url: string | null) => {
    if (iframeObjectUrl.current) URL.revokeObjectURL(iframeObjectUrl.current)
    iframeObjectUrl.current = url
    setIframeUrl(url)
  }, [])

  const loadPage = useCallback(async (nextPage: number) => {
    const base = baseRef.current
    const ink = inkRef.current
    const bytes = bytesRef.current
    if (!base || !ink || !bytes) return
    const kind = sniffDrawingKind(bytes)
    if (kind === 'pdf') {
      try {
        const rendered = await renderPdfPage(bytes, base, nextPage)
        setPageCount(rendered.pageCount)
        replaceIframe(null)
      } catch {
        replaceIframe(URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })))
        setUnsupported(true)
        return
      }
    } else if (kind === 'image') {
      await renderImage(bytes, base)
      setPageCount(1)
    } else {
      setUnsupported(true)
      return
    }
    ink.width = base.width
    ink.height = base.height
    const ctx = ink.getContext('2d')
    const saved = inkByPage.current.get(nextPage)
    if (ctx && saved) ctx.putImageData(saved, 0, 0)
    history.current = []
    setHasPage(true)
  }, [replaceIframe])

  useEffect(() => {
    if (!textDraft) return
    const id = window.setTimeout(() => textInputRef.current?.focus(), 30)
    return () => window.clearTimeout(id)
  }, [textDraft?.x, textDraft?.y])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setHasPage(false)
    setUnsupported(false)
    replaceIframe(null)
    setPage(1)
    inkByPage.current = new Map()
    history.current = []
    void (async () => {
      try {
        const file = fileUrl
          ? await fetchDrawingBytesFromUrl(fileUrl, drawingTitle)
          : await fetchDrawingBytes(drawingId)
        if (cancelled) return
        bytesRef.current = file.bytes
        const kind = sniffDrawingKind(file.bytes, file.fileName, file.contentType)
        if (kind === 'unsupported') {
          setUnsupported(true)
          setLoading(false)
          return
        }
        await loadPage(1)
        if (!cancelled) setLoading(false)
      } catch (error) {
        if (!cancelled) {
          setLoading(false)
          errorRef.current(error instanceof Error ? error.message : labels.unsupported)
        }
      }
    })()
    return () => {
      cancelled = true
      if (iframeObjectUrl.current) {
        URL.revokeObjectURL(iframeObjectUrl.current)
        iframeObjectUrl.current = null
      }
    }
  }, [drawingId, drawingTitle, fileUrl, labels.unsupported, loadPage, replaceIframe])

  useImperativeHandle(ref, () => ({
    canExport: () => {
      const base = baseRef.current
      return Boolean(base && base.width > 0 && hasPage && !unsupported)
    },
    exportPng: async () => {
      commitText()
      const base = baseRef.current
      const ink = inkRef.current
      if (!base || !ink || base.width === 0) throw new Error(labels.unsupported)
      if (ink.width !== base.width || ink.height !== base.height) {
        ink.width = base.width
        ink.height = base.height
      }
      const out = document.createElement('canvas')
      out.width = base.width
      out.height = base.height
      const ctx = out.getContext('2d')
      if (!ctx) throw new Error(labels.unsupported)
      ctx.drawImage(base, 0, 0)
      ctx.drawImage(ink, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => {
        out.toBlob((value) => (value ? resolve(value) : reject(new Error(labels.unsupported))), 'image/png')
      })
      const safeTitle = drawingTitle.replace(/[^\w.\u0600-\u06FF-]+/g, '_').slice(0, 40) || 'drawing'
      return new File([blob], `${safeTitle}-marked.png`, { type: 'image/png' })
    },
  }))

  async function changePage(nextPage: number) {
    commitText()
    const ink = inkRef.current
    const ctx = ink?.getContext('2d')
    if (ink && ctx && ink.width > 0) {
      inkByPage.current.set(page, ctx.getImageData(0, 0, ink.width, ink.height))
    }
    setPage(nextPage)
    setLoading(true)
    await loadPage(nextPage)
    setLoading(false)
  }

  function paint(event: React.PointerEvent<HTMLCanvasElement>) {
    const ink = inkRef.current
    const ctx = ink?.getContext('2d')
    if (!ink || !ctx || !drawing.current) return
    const point = pointerPos(ink, event)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * (tool === 'eraser' ? 3 : 1)
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = penColor
    }
    ctx.beginPath()
    if (last.current) ctx.moveTo(last.current.x, last.current.y)
    else ctx.moveTo(point.x, point.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    last.current = point
  }

  function undo() {
    const ink = inkRef.current
    const ctx = ink?.getContext('2d')
    if (!ink || !ctx) return
    const prev = history.current.pop()
    ctx.clearRect(0, 0, ink.width, ink.height)
    if (prev) ctx.putImageData(prev, 0, 0)
  }

  function clearMarks() {
    const ink = inkRef.current
    const ctx = ink?.getContext('2d')
    if (!ink || !ctx) return
    snapshotInk()
    ctx.clearRect(0, 0, ink.width, ink.height)
  }

  const ready = hasPage && !unsupported

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-slate-200 bg-white p-2">
        <Button
          type="button"
          size="sm"
          variant={tool === 'pen' ? 'default' : 'outline'}
          className={tool === 'pen' ? '' : 'bg-white text-slate-800'}
          disabled={!ready}
          onClick={() => {
            commitText()
            setTool('pen')
          }}
        >
          <Pencil className="h-4 w-4" />
          {labels.pen}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === 'eraser' ? 'default' : 'outline'}
          className={tool === 'eraser' ? '' : 'bg-white text-slate-800'}
          disabled={!ready}
          onClick={() => {
            commitText()
            setTool('eraser')
          }}
        >
          <Eraser className="h-4 w-4" />
          {labels.eraser}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === 'text' ? 'default' : 'outline'}
          className={tool === 'text' ? '' : 'bg-white text-slate-800'}
          disabled={!ready}
          onClick={() => setTool('text')}
        >
          <Type className="h-4 w-4" />
          {labels.text}
        </Button>
        <div className="flex items-center gap-1">
          {SIZES.map((value) => (
            <button
              key={value}
              type="button"
              disabled={!ready}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-[8px] border',
                size === value ? 'border-slate-800 bg-slate-800' : 'border-slate-200 bg-white'
              )}
              onClick={() => setSize(value)}
              aria-label={`${value}`}
            >
              <span
                className="rounded-full"
                style={{
                  width: value + 4,
                  height: value + 4,
                  backgroundColor: size === value ? '#ffffff' : penColor,
                }}
              />
            </button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-white text-slate-800"
          disabled={!ready}
          onClick={() => {
            if (textDraft) {
              setTextDraft(null)
              return
            }
            undo()
          }}
        >
          <Undo2 className="h-4 w-4" />
          {labels.undo}
        </Button>
        <Button type="button" size="sm" variant="outline" className="bg-white text-slate-800" disabled={!ready} onClick={() => { setTextDraft(null); clearMarks() }}>
          {labels.clear}
        </Button>
        {pageCount > 1 ? (
          <div className="ms-auto flex items-center gap-2 text-sm text-slate-700">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white text-slate-800"
              disabled={page <= 1 || loading}
              onClick={() => void changePage(page - 1)}
            >
              ‹
            </Button>
            <span>
              {labels.page} {page} / {pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white text-slate-800"
              disabled={page >= pageCount || loading}
              onClick={() => void changePage(page + 1)}
            >
              ›
            </Button>
          </div>
        ) : null}
      </div>

      {iframeUrl ? (
        <iframe
          src={iframeUrl}
          title={drawingTitle}
          className="h-[70vh] w-full rounded-[10px] border border-slate-200 bg-white"
        />
      ) : unsupported ? (
        <p className="rounded-[10px] border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-600">
          {labels.unsupported}
        </p>
      ) : null}
      <div className={iframeUrl || unsupported ? 'hidden' : 'overflow-auto rounded-[10px] border border-slate-200 bg-slate-200'} dir="ltr">
        <div ref={wrapRef} className="relative inline-block min-h-[240px] w-full">
          {loading && !hasPage && !iframeUrl && !unsupported ? (
            <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-600">
              {labels.saving}
            </p>
          ) : null}
          <canvas ref={baseRef} className="block h-auto w-full max-w-full bg-white" />
          <canvas
            ref={inkRef}
            className="absolute inset-0 z-[1] h-full w-full touch-none"
            style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}
            onPointerDown={(event) => {
              if (unsupported) return
              if (tool === 'text') {
                event.preventDefault()
                return
              }
              if (!ready) return
              event.currentTarget.setPointerCapture(event.pointerId)
              syncInkSize()
              snapshotInk()
              drawing.current = true
              last.current = pointerPos(event.currentTarget, event)
              paint(event)
            }}
            onPointerMove={paint}
            onPointerUp={(event) => {
              if (tool === 'text' && !unsupported) {
                placeText(event)
              }
              drawing.current = false
              last.current = null
            }}
            onPointerCancel={() => {
              drawing.current = false
              last.current = null
            }}
          />
          {textDraft ? (
            <input
              ref={textInputRef}
              dir={hasPersian(textDraft.value) || !textDraft.value ? 'rtl' : 'ltr'}
              value={textDraft.value}
              placeholder={labels.textPlaceholder}
              className="absolute z-30 min-w-[10rem] rounded-[6px] border-2 border-red-600 bg-white px-2 py-1 font-bold text-red-600 shadow-md outline-none"
              style={{
                left: textDraft.left,
                top: textDraft.top,
                fontSize: cssTextSize(size),
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => {
                const value = event.target.value
                const next = { ...textDraft, value }
                textDraftRef.current = next
                setTextDraft(next)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitText()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  textDraftRef.current = null
                  setTextDraft(null)
                }
              }}
              onBlur={() => {
                if (ignoreTextBlur.current) {
                  textInputRef.current?.focus()
                  return
                }
                commitText()
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
})

QcDrawingMarkup.displayName = 'QcDrawingMarkup'
