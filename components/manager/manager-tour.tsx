'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { faNumber } from '@/lib/manager/format'

export interface ManagerTourStep {
  /** Matches `data-tour` on the target; the first visible match is used. */
  target: string
  title: string
  body: string
}

const TOUR_STORAGE_PREFIX = 'msa.manager.tour.v1:'

export function readTourSeen(userId: string): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_PREFIX + userId) != null
  } catch {
    return true
  }
}

export function markTourSeen(userId: string, value: 'done' | 'dismissed') {
  try {
    window.localStorage.setItem(TOUR_STORAGE_PREFIX + userId, value)
  } catch {
    // Private mode / storage disabled — the intro simply shows again next visit.
  }
}

function findTarget(target: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
  for (const node of Array.from(nodes)) {
    const rect = node.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return node
  }
  return null
}

const CARD_WIDTH = 340
const PAD = 6

export function ManagerTour({
  open,
  steps,
  onClose,
}: {
  open: boolean
  steps: ManagerTourStep[]
  onClose: (completed: boolean) => void
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  const measure = useCallback(() => {
    if (!step) return
    const el = findTarget(step.target)
    setRect(el ? el.getBoundingClientRect() : null)
    setViewport({ w: window.innerWidth, h: window.innerHeight })
  }, [step])

  useLayoutEffect(() => {
    if (!open || !step) return
    const el = findTarget(step.target)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    measure()
    const timer = window.setTimeout(measure, reduced ? 0 : 350)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step, measure])

  useEffect(() => {
    if (!open) return
    cardRef.current?.focus()
  }, [open, index])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(false)
      if (event.key === 'ArrowLeft' && !last) setIndex((i) => i + 1)
      if (event.key === 'ArrowRight' && index > 0) setIndex((i) => i - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, index, last, onClose])

  if (!open || !step) return null

  const mobile = viewport.w > 0 && viewport.w < 640
  let cardStyle: React.CSSProperties
  if (mobile || !rect) {
    cardStyle = mobile
      ? { left: 12, right: 12, bottom: 12 }
      : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: CARD_WIDTH }
  } else if (rect.height > viewport.h * 0.5 && rect.left > CARD_WIDTH + 28) {
    const top = Math.min(Math.max(12, rect.top + 16), viewport.h - 240)
    cardStyle = { top, left: rect.left - CARD_WIDTH - 20, width: CARD_WIDTH }
  } else {
    const below = viewport.h - rect.bottom
    const top =
      below >= 230
        ? rect.bottom + PAD + 10
        : rect.top >= 230
          ? rect.top - PAD - 10 - 200
          : Math.max(12, viewport.h - 230)
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - CARD_WIDTH / 2),
      viewport.w - CARD_WIDTH - 12
    )
    cardStyle = { top: Math.max(12, top), left, width: CARD_WIDTH }
  }

  return (
    <div className="fixed inset-0 z-[80]" dir="rtl">
      <div className="absolute inset-0" aria-hidden onClick={(event) => event.stopPropagation()} />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-transparent transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-slate-900/55" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-tour-title"
        aria-describedby="manager-tour-body"
        tabIndex={-1}
        className="fixed rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl outline-none animate-in fade-in-0 duration-150 motion-reduce:animate-none"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-primary">
              مرحلهٔ {faNumber(index + 1)} از {faNumber(steps.length)}
            </p>
            <h2 id="manager-tour-title" className="mt-0.5 text-sm font-bold text-slate-900">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="بستن تور"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p id="manager-tour-body" className="mt-2 text-xs leading-6 text-slate-600">
          {step.body}
        </p>

        <div className="mt-3 flex items-center gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.target}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-slate-200'}`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            رد کردن
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              قبلی
            </button>
            {last ? (
              <button
                type="button"
                onClick={() => onClose(true)}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1"
              >
                پایان
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1"
              >
                بعدی
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
