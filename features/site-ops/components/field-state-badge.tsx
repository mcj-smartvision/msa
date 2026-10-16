/**
 * @file features/site-ops/components/field-state-badge.tsx
 * @purpose کامپوننت UI — عملیات کارگاه، دستورکار و برنامه روزانه (field-state-badge)
 * @safe-to-edit CAREFUL
 * @affects عملیات کارگاه، دستورکار و برنامه روزانه
 * @depends-on features/site-ops/config
 */

'use client'

import { FIELD_STATE_COPY } from '@/features/site-ops/config'

export function FieldStateBadge({ state }: { state?: string }) {
  const s = (state ?? 'MISSING').toUpperCase()
  const tone =
    s === 'VALID'
      ? 'bg-emerald-100 text-emerald-800'
      : s === 'MISSING'
        ? 'bg-slate-100 text-slate-700'
        : s === 'UNUSABLE'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-rose-100 text-rose-800'
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {FIELD_STATE_COPY[s as keyof typeof FIELD_STATE_COPY] ?? s}
    </span>
  )
}
