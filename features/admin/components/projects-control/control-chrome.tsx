'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleHelp, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { PageHeader } from '@/features/admin/components/shared'

export function ProjectsControlHeader({
  title,
  description,
  actions,
}: {
  title: string
  eyebrow?: string
  description: string
  actions?: ReactNode
}) {
  return <PageHeader title={title} description={description} actions={actions} />
}

export function ControlKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  help,
  extra,
}: {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  tone?: 'neutral' | 'warning' | 'success' | 'info'
  help?: string
  extra?: ReactNode
}) {
  const toneMap = {
    neutral: 'border-[#E4E7EC] bg-white',
    warning: 'border-[#E4E7EC] border-s-[#C58B20] bg-[#FFF6DF]',
    success: 'border-[#E4E7EC] border-s-[#2E8B68] bg-[#EAF6F0]',
    info: 'border-[#E4E7EC] border-s-[#4D718A] bg-[#EDF4F8]',
  } as const

  const iconTone = {
    neutral: 'text-[#667085]',
    warning: 'text-[#C58B20]',
    success: 'text-[#2E8B68]',
    info: 'text-[#4D718A]',
  } as const

  const [helpOpen, setHelpOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!helpOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!cardRef.current?.contains(event.target as Node)) setHelpOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [helpOpen])

  return (
    <div ref={cardRef} className={cn('relative rounded-lg border border-s-4 px-3 py-3 shadow-sm', toneMap[tone])}>
      {help ? (
        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          className="absolute top-1.5 start-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[#98A2B3] hover:bg-slate-100 hover:text-[#344054]"
          aria-label={`راهنمای ${label}`}
          aria-expanded={helpOpen}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div className={cn('flex items-start justify-between gap-2', help && 'ps-5')}>
        <p className="text-[11px] font-semibold text-[#667085]">{label}</p>
        <Icon className={cn('h-4 w-4 shrink-0', iconTone[tone])} aria-hidden />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#17202A]">{value}</p>
      <p className="mt-0.5 text-[11px] text-[#667085]">{hint}</p>
      {extra ? <div className="mt-2">{extra}</div> : null}
      {help && helpOpen ? (
        <div
          role="tooltip"
          className="absolute z-20 top-7 start-1.5 w-[240px] rounded-md border border-[#E4E7EC] bg-white px-3 py-2 text-start text-[12px] leading-relaxed text-[#344054] shadow-md"
        >
          {help}
        </div>
      ) : null}
    </div>
  )
}
