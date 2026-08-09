'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { SeverityBadge, StatusBadge } from '@/components/hse/badges'
import { formatDateTime } from '@/components/hse/format'
import { getSupervisorSafetyActions, type SupervisorSafetyAction } from '@/lib/hse/workflow-feed'
import { Button } from '@/components/ui/button'

export const SUPERVISOR_SAFETY_ACK_KEY = 'hse_supervisor_ack_actions'

export function loadSupervisorSafetyAcked(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SUPERVISOR_SAFETY_ACK_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function countOpenSupervisorSafetyActions(ackedIds?: string[]): number {
  const acked = ackedIds ?? loadSupervisorSafetyAcked()
  return getSupervisorSafetyActions(20).filter((a) => !acked.includes(a.id)).length
}

/** Field queue for site supervisor — confirmed / critical HSE camera incidents. */
export function SupervisorSafetyActionsPanel({
  embedded = false,
  onQueueChange,
}: {
  embedded?: boolean
  onQueueChange?: (openCount: number) => void
}) {
  const [acked, setAcked] = useState<string[]>([])
  const actions = useMemo(() => getSupervisorSafetyActions(12), [])

  useEffect(() => {
    setAcked(loadSupervisorSafetyAcked())
  }, [])

  const open = actions.filter((a) => !acked.includes(a.id))
  const done = actions.filter((a) => acked.includes(a.id))

  useEffect(() => {
    onQueueChange?.(open.length)
  }, [open.length, onQueueChange])

  function persist(next: string[]) {
    setAcked(next)
    localStorage.setItem(SUPERVISOR_SAFETY_ACK_KEY, JSON.stringify(next))
    onQueueChange?.(actions.filter((a) => !next.includes(a.id)).length)
  }

  function acknowledge(id: string) {
    persist([...new Set([...acked, id])])
  }

  function restore(id: string) {
    persist(acked.filter((x) => x !== id))
  }

  return (
    <div className="space-y-3" dir="rtl" lang="fa">
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">اخطارها و اقدامات ایمنی</p>
          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
            {open.length}
          </span>
        </div>
      ) : null}

      <p className="text-xs text-slate-600">
        پس از تأیید مسئول ایمنی، موارد برای اقدام میدانی اینجا می‌آیند. روی هر مورد اقدام کنید یا
        جزئیات و شواهد را ببینید.
      </p>

      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
          اخطار بازی برای اقدام میدانی نیست.
        </p>
      ) : (
        <div className="space-y-2">
          {open.map((item) => (
            <ActionCard key={item.id} item={item} onAck={() => acknowledge(item.id)} />
          ))}
        </div>
      )}

      {done.length > 0 ? (
        <div className="pt-1">
          <p className="mb-2 text-[11px] font-semibold text-slate-500">پیگیری‌شده در این نشست</p>
          <ul className="space-y-1.5">
            {done.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {item.code} — {item.title}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => restore(item.id)}>
                  بازگردانی
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ActionCard({
  item,
  onAck,
}: {
  item: SupervisorSafetyAction
  onAck: () => void
}) {
  return (
    <article className="rounded-lg border border-rose-200/70 bg-rose-50/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-slate-500">{item.code}</span>
        <SeverityBadge value={item.severity} />
        <StatusBadge value={item.status} />
      </div>
      <h3 className="mt-1.5 text-sm font-semibold text-slate-900">{item.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{item.aiSummary}</p>
      <p className="mt-2 text-[11px] text-slate-500">
        {item.zoneName} · {item.cameraName}
        {item.contractorName ? ` · ${item.contractorName}` : ''} · {formatDateTime(item.detectedAt)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onAck}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          اقدام میدانی انجام شد
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={item.href}>
            جزئیات و شواهد
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </article>
  )
}
