'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CircleSlash, Info, Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { SectionResult } from '@/features/manager/lib/overview-types'

/** Contextual help: opens on click or keyboard focus, closes on Escape / outside click. */
export function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`دربارهٔ ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!wrapRef.current?.contains(event.relatedTarget as Node)) setOpen(false)
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-lg border border-slate-200 bg-white p-3 text-right text-xs font-normal leading-6 text-slate-700 shadow-elevated animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

export function SectionCard({
  title,
  icon,
  hint,
  action,
  className,
  children,
  tourId,
}: {
  title: string
  icon?: ReactNode
  hint?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
  tourId?: string
}) {
  const headingId = useId()
  return (
    <section
      data-tour={tourId}
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500">
              {icon}
            </span>
          ) : null}
          <h2 id={headingId} className="truncate text-[15px] font-bold tracking-tight text-slate-800">
            {title}
          </h2>
          {hint ? <InfoHint label={title}>{hint}</InfoHint> : null}
        </div>
        {action}
      </header>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3 leading-relaxed">{children}</div>
    </section>
  )
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100/80 motion-reduce:animate-none" />
      ))}
    </div>
  )
}

export function EmptyNote({
  icon,
  title,
  description,
  tone = 'neutral',
}: {
  icon?: ReactNode
  title: string
  description?: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-dashed px-3.5 py-3 text-xs leading-relaxed',
        tone === 'error'
          ? 'border-rose-200 bg-rose-50/60 text-rose-800'
          : 'border-slate-200 bg-slate-50/60 text-slate-600'
      )}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon ??
          (tone === 'error' ? <AlertCircle className="h-4 w-4" /> : <CircleSlash className="h-4 w-4" />)}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {description ? <p className="mt-0.5 text-slate-500">{description}</p> : null}
      </div>
    </div>
  )
}

/** Renders loading / not-connected / error states so a section never shows a misleading zero. */
export function SectionBody<T>({
  result,
  loading,
  rows,
  children,
}: {
  result: SectionResult<T> | undefined
  loading: boolean
  rows?: number
  children: (data: T) => ReactNode
}) {
  if (!result) {
    return loading ? <LoadingRows rows={rows} /> : <EmptyNote title="داده هنوز بارگذاری نشده است" />
  }
  if (result.status === 'unavailable') {
    return <EmptyNote title="داده هنوز متصل نشده" description={result.reason} />
  }
  if (result.status === 'error') {
    return <EmptyNote tone="error" title="بارگذاری این بخش ناموفق بود" description={result.message} />
  }
  return <>{children(result.data)}</>
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin motion-reduce:animate-none', className)} aria-hidden />
}
