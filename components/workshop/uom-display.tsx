'use client'

import { useEffect, useRef, useState } from 'react'
import { WORKSHOP_UOMS, workshopUomParts } from '@/lib/workshop/types'
import { cn } from '@/lib/utils'

export function UomStack({
  uom,
  className,
}: {
  uom?: string | null
  className?: string
}) {
  const { fa, en } = workshopUomParts(uom)
  if (!uom?.trim()) return <span className="text-slate-400">—</span>
  return (
    <span
      className={cn('inline-flex flex-col items-center justify-center leading-none', className)}
      title={`${fa} (${en})`}
    >
      <span className="text-[9px] font-medium text-slate-700">{fa}</span>
      {en ? (
        <span className="mt-0.5 text-[8px] text-slate-500" dir="ltr">
          {en}
        </span>
      ) : null}
    </span>
  )
}

export function QtyWithUom({
  qty,
  uom,
  className,
}: {
  qty: string | number | null | undefined
  uom?: string | null
  className?: string
}) {
  if (qty == null || qty === '') return <span className="text-slate-400">—</span>
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="tabular-nums">{qty}</span>
      <UomStack uom={uom} />
    </span>
  )
}

export function UomSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        title="واحد"
        className="flex h-full min-h-[28px] w-full items-center justify-center rounded border border-slate-200 bg-white px-0.5 py-0.5 disabled:opacity-50"
        onClick={() => setOpen((current) => !current)}
      >
        <UomStack uom={value} />
      </button>
      {open ? (
        <div className="absolute start-1/2 top-full z-50 mt-0.5 min-w-[5.5rem] -translate-x-1/2 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          {WORKSHOP_UOMS.map((code) => (
            <button
              key={code}
              type="button"
              className={cn(
                'flex w-full flex-col items-center px-2 py-1.5 hover:bg-orange-50',
                code === value ? 'bg-orange-50' : 'bg-white'
              )}
              onClick={() => {
                onChange(code)
                setOpen(false)
              }}
            >
              <UomStack uom={code} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
