/**
 * @file features/workshop/components/approvals-workspace.tsx
 * @purpose کامپوننت UI — بسته‌های اجرایی و تأیید کارگاه (approvals-workspace)
 * @safe-to-edit CAREFUL
 * @affects بسته‌های اجرایی و تأیید کارگاه
 * @depends-on features/workshop/lib/approvals, features/admin/components/shared, features/workshop/components/proposed-change-view, features/workshop/components/uom-display
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { approvalStatusFa } from '@/features/workshop/lib/approvals'
import { PageHeader } from '@/features/admin/components/shared'
import { ProposedChangeView } from '@/features/workshop/components/proposed-change-view'
import { QtyWithUom } from '@/features/workshop/components/uom-display'
import { WORKSHOP_COPY } from '@/features/workshop/lib/ui-copy'

type InboxItem = {
  id: string
  name: string
  location: string | null
  quantity: number
  uom: string
  crew: string | null
  note: string | null
  approval_status: string
  last_pm_comment: string | null
  pending_change: Record<string, unknown> | null
  updated_at: string
}

export function ApprovalsWorkspace({ showBanner = true }: { showBanner?: boolean }) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const [items, setItems] = useState<InboxItem[]>([])
  const [canDecide, setCanDecide] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('focus'))
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workshop/approvals?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || WORKSHOP_COPY.genericError)
      setItems(data.items ?? [])
      setCanDecide(Boolean(data.canDecide))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : WORKSHOP_COPY.genericError)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener('workshop-refresh', onRefresh)
    return () => window.removeEventListener('workshop-refresh', onRefresh)
  }, [load])

  const selected = items.find((i) => i.id === selectedId) ?? null

  async function act(path: string, body?: Record<string, unknown>) {
    if (!selectedId) return
    setMessage(null)
    const res = await fetch(`/api/workshop/packages/${selectedId}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || WORKSHOP_COPY.approvals.actionFailed)
      return
    }
    setComment('')
    setMessage(WORKSHOP_COPY.approvals.saved)
    setSelectedId(null)
    await load()
  }

  if (!projectId) {
    return <p className="text-sm text-slate-600">{WORKSHOP_COPY.selectProjectTop}</p>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        showBanner={showBanner}
        title={WORKSHOP_COPY.approvals.title}
        description={WORKSHOP_COPY.approvals.description}
      />

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">{message}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {loading && <p className="p-4 text-sm text-slate-500">{WORKSHOP_COPY.loading}</p>}
          {!loading && items.length === 0 && (
            <p className="p-6 text-sm text-slate-500">{WORKSHOP_COPY.approvals.empty}</p>
          )}
          <ul className="divide-y">
            {items.map((item) => {
              const active = item.id === selectedId
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-right px-4 py-3 hover:bg-slate-50 ${
                      active ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-[11px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                        {approvalStatusFa(item.approval_status as never)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.location ?? '—'} · <QtyWithUom qty={item.quantity} uom={item.uom} />
                      {item.crew ? ` · ${item.crew}` : ''}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 h-fit space-y-3">
          {!selected ? (
            <p className="text-sm text-slate-500">{WORKSHOP_COPY.approvals.pickItem}</p>
          ) : (
            <>
              <h2 className="font-semibold">{selected.name}</h2>
              <dl className="text-sm space-y-1 text-slate-700">
                <div>{WORKSHOP_COPY.approvals.locationPrefix} {selected.location ?? '—'}</div>
                <div>
                  {WORKSHOP_COPY.approvals.qtyPrefix} <QtyWithUom qty={selected.quantity} uom={selected.uom} />
                </div>
                <div>{WORKSHOP_COPY.approvals.crewPrefix} {selected.crew ?? '—'}</div>
                {selected.note && <div>{WORKSHOP_COPY.approvals.notePrefix} {selected.note}</div>}
              </dl>

              {selected.pending_change && (
                <ProposedChangeView
                  isFa
                  current={{
                    name: selected.name,
                    location: selected.location,
                    quantity: selected.quantity,
                    uom: selected.uom,
                    crew: selected.crew,
                    note: selected.note,
                  }}
                  proposed={selected.pending_change}
                />
              )}

              <label className="block text-sm">
                {WORKSHOP_COPY.approvals.pmComment}
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm min-h-[80px]"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={WORKSHOP_COPY.approvals.commentPlaceholder}
                />
              </label>

              {canDecide && selected.approval_status === 'pending_approval' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void act('approve', { comment })}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
                  >
                    {WORKSHOP_COPY.approvals.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act('reject', { comment })}
                    className="rounded-lg border border-rose-300 text-rose-800 px-3 py-2 text-sm"
                  >
                    {WORKSHOP_COPY.approvals.rejectWithComment}
                  </button>
                </div>
              )}

              {canDecide && selected.approval_status === 'change_requested' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void act('change-decide', { decision: 'approve', comment })}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
                  >
                    {WORKSHOP_COPY.approvals.approveChange}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act('change-decide', { decision: 'reject', comment })}
                    className="rounded-lg border border-rose-300 text-rose-800 px-3 py-2 text-sm"
                  >
                    {WORKSHOP_COPY.approvals.rejectChange}
                  </button>
                </div>
              )}

              {!canDecide && (
                <p className="text-xs text-slate-500">
                  {WORKSHOP_COPY.approvals.onlyPm}
                </p>
              )}

              <button
                type="button"
                onClick={() => void act('comment', { comment })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {WORKSHOP_COPY.approvals.postComment}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
