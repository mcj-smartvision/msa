'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProjectsControlHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string
  eyebrow: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#667085]">{eyebrow}</p>
        <h1 className="text-xl font-semibold tracking-tight text-[#17202A] sm:text-2xl">{title}</h1>
        <p className="max-w-2xl text-sm text-[#667085]">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function ControlKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  tone?: 'neutral' | 'warning' | 'success' | 'info'
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

  return (
    <div className={cn('rounded-lg border border-s-4 px-3 py-3 shadow-sm', toneMap[tone])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-[#667085]">{label}</p>
        <Icon className={cn('h-4 w-4 shrink-0', iconTone[tone])} aria-hidden />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#17202A]">{value}</p>
      <p className="mt-0.5 text-[11px] text-[#667085]">{hint}</p>
    </div>
  )
}
