/**
 * @file features/workshop/components/flags-workspace.tsx
 * @purpose کامپوننت UI — بسته‌های اجرایی و تأیید کارگاه (flags-workspace)
 * @safe-to-edit CAREFUL
 * @affects بسته‌های اجرایی و تأیید کارگاه
 * @depends-on features/admin/components/shared
 */

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/features/admin/components/shared'
import { WORKSHOP_COPY } from '@/features/workshop/lib/ui-copy'

export function FlagsWorkspace({ showBanner = true }: { showBanner?: boolean }) {
  const projectId = useSearchParams().get('projectId') ?? ''
  const [flags, setFlags] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    if (!projectId) return
    void fetch(`/api/workshop/flags?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => setFlags(d.flags ?? []))
  }, [projectId])

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        showBanner={showBanner}
        title={WORKSHOP_COPY.flags.title}
        description={WORKSHOP_COPY.flags.description}
      />
      {flags.length === 0 ? (
        <p className="text-sm text-slate-600 rounded-2xl border border-dashed bg-white p-6">
          {WORKSHOP_COPY.flags.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {flags.map((f) => (
            <li key={String(f.id)} className="rounded-xl border bg-white px-4 py-3 text-sm">
              <span className="font-medium">{String(f.reason_code)}</span>
              <span className="ms-2 text-amber-800">{String(f.severity)}</span>
              {f.note ? <p className="text-slate-600 mt-1">{String(f.note)}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
