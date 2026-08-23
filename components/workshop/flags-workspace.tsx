'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/admin/shared'

export function FlagsWorkspace() {
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
        title="پرچم‌ها / نیاز به بررسی"
        description="صف بررسی دفتر فنی — ثبت کارگاه را متوقف نمی‌کند."
      />
      {flags.length === 0 ? (
        <p className="text-sm text-slate-600 rounded-2xl border border-dashed bg-white p-6">
          پرچم باز ندارید.
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
