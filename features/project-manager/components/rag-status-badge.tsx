/**
 * @file features/project-manager/components/rag-status-badge.tsx
 * @purpose کامپوننت UI — اتاق فرمان مدیر پروژه و کارتابل (rag-status-badge)
 * @safe-to-edit CAREFUL
 * @affects اتاق فرمان مدیر پروژه و کارتابل
 * @depends-on shared/lib/utils, features/evm/lib/rag-status, features/project-manager/config
 */

'use client'

import { useId } from 'react'
import { cn } from '@/shared/lib/utils'
import type { RagResult, RagStatus } from '@/features/evm/lib/rag-status'
import { RAG_STATUS_COPY } from '@/features/project-manager/config'

const STATUS_STYLE: Record<RagStatus, { chip: string; dot: string }> = {
  GREEN: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  AMBER: {
    chip: 'border-amber-200 bg-amber-50 text-amber-900',
    dot: 'bg-amber-500',
  },
  RED: {
    chip: 'border-red-200 bg-red-50 text-red-800',
    dot: 'bg-red-600',
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
        title={RAG_STATUS_COPY.unevaluatedTitle}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden />
        {RAG_STATUS_COPY.unevaluatedLabel}
      </span>
    )
  }

  const style = STATUS_STYLE[rag.status]
  const copy = RAG_STATUS_COPY[rag.status]

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
        {RAG_STATUS_COPY.projectStatus(copy.label)}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full z-30 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-right text-xs font-normal leading-6 text-slate-700 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ltr:left-0 rtl:right-0"
      >
        <span className="block font-semibold text-slate-900">{copy.hint}</span>
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
