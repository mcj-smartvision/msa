'use client'

import { useId } from 'react'
import { cn } from '@/shared/lib/utils'
import type { RagResult, RagStatus } from '@/features/evm/lib/rag-status'

const STATUS_STYLE: Record<RagStatus, { label: string; chip: string; dot: string; hint: string }> = {
  GREEN: {
    label: 'سبز — در مسیر',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dot: 'bg-emerald-500',
    hint: 'SPI و CPI حداقل 0.95 و شناوری مسیر بحرانی نامنفی است.',
  },
  AMBER: {
    label: 'زرد — نیازمند توجه',
    chip: 'border-amber-200 bg-amber-50 text-amber-900',
    dot: 'bg-amber-500',
    hint: 'یکی از شاخص‌ها بین 0.85 و 0.95 است یا بیش از 75٪ شناوری مصرف شده.',
  },
  RED: {
    label: 'قرمز — بحرانی',
    chip: 'border-red-200 bg-red-50 text-red-800',
    dot: 'bg-red-600',
    hint: 'SPI یا CPI کمتر از 0.85 است یا مسیر بحرانی شناوری منفی دارد.',
  },
}

export function RagStatusBadge({ rag, className }: { rag: RagResult; className?: string }) {
  const tooltipId = useId()

  if (!rag.evaluated) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600',
          className
        )}
        title="برای ارزیابی، قیمت واحد/وزن فعالیت‌ها، پیشرفت فیزیکی و محاسبهٔ CPM لازم است."
      >
        <span className="h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden />
        وضعیت پروژه: داده ناکافی
      </span>
    )
  }

  const style = STATUS_STYLE[rag.status]

  return (
    <span className={cn('group relative inline-flex', className)}>
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        className={cn(
          'inline-flex cursor-help items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          style.chip
        )}
      >
        <span
          className={cn('h-2.5 w-2.5 rounded-full', style.dot, rag.status === 'RED' && 'animate-pulse')}
          aria-hidden
        />
        وضعیت پروژه: {style.label}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full z-30 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-right text-xs font-normal leading-6 text-slate-700 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ltr:left-0 rtl:right-0"
      >
        <span className="block font-semibold text-slate-900">{style.hint}</span>
        {rag.reasons.length > 0 ? (
          <span className="mt-1.5 block space-y-1">
            {rag.reasons.map((reason) => (
              <span key={reason.code} className="flex items-start gap-1.5">
                <span
                  className={cn(
                    'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                    reason.level === 'RED' ? 'bg-red-600' : 'bg-amber-500'
                  )}
                  aria-hidden
                />
                <span>{reason.messageFa}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </span>
  )
}
