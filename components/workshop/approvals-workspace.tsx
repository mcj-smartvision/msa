'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { approvalStatusFa } from '@/lib/workshop/approvals'
import { PageHeader } from '@/components/admin/shared'
import { ProposedChangeView } from '@/components/workshop/proposed-change-view'
import { QtyWithUom } from '@/components/workshop/uom-display'

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
  const projectId = useSearchParams().get('projectId') ?? ''
  const [items, setItems] = useState<InboxItem[]>([])
  const [canDecide, setCanDecide] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workshop/approvals?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا')
      setItems(data.items ?? [])
      setCanDecide(Boolean(data.canDecide))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطا')
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
      setMessage(data.error || 'عملیات انجام نشد')
      return
    }
    setComment('')
    setMessage('ثبت شد')
    setSelectedId(null)
    await load()
  }

  if (!projectId) {
    return <p className="text-sm text-slate-600">پروژه را از بالا انتخاب کنید.</p>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        showBanner={showBanner}
        title="تأییدات"
        description="مدیر پروژه موارد ارسالی دفتر فنی را تأیید، رد یا با کامنت برمی‌گرداند."
      />

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">{message}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {loading && <p className="p-4 text-sm text-slate-500">در حال بارگذاری…</p>}
          {!loading && items.length === 0 && (
            <p className="p-6 text-sm text-slate-500">موردی در صف تأیید نیست.</p>
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
            <p className="text-sm text-slate-500">یک مورد را از لیست انتخاب کنید.</p>
          ) : (
            <>
              <h2 className="font-semibold">{selected.name}</h2>
              <dl className="text-sm space-y-1 text-slate-700">
                <div>محل: {selected.location ?? '—'}</div>
                <div>
                  مقدار: <QtyWithUom qty={selected.quantity} uom={selected.uom} />
                </div>
                <div>گروه: {selected.crew ?? '—'}</div>
                {selected.note && <div>یادداشت: {selected.note}</div>}
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
                کامنت مدیر پروژه
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm min-h-[80px]"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="توضیح برای دفتر فنی…"
                />
              </label>

              {canDecide && selected.approval_status === 'pending_approval' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void act('approve', { comment })}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
                  >
                    تأیید
                  </button>
                  <button
                    type="button"
                    onClick={() => void act('reject', { comment })}
                    className="rounded-lg border border-rose-300 text-rose-800 px-3 py-2 text-sm"
                  >
                    رد با کامنت
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
                    تأیید تغییر
                  </button>
                  <button
                    type="button"
                    onClick={() => void act('change-decide', { decision: 'reject', comment })}
                    className="rounded-lg border border-rose-300 text-rose-800 px-3 py-2 text-sm"
                  >
                    رد درخواست تغییر
                  </button>
                </div>
              )}

              {!canDecide && (
                <p className="text-xs text-slate-500">
                  فقط مدیر پروژه می‌تواند تأیید/رد کند. دفتر فنی با کامنت اصلاح می‌کند.
                </p>
              )}

              <button
                type="button"
                onClick={() => void act('comment', { comment })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                ثبت کامنت
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
