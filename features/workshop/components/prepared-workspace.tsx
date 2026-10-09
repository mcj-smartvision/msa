'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { approvalStatusFa } from '@/features/workshop/lib/approvals'
import { PageHeader } from '@/features/admin/components/shared'
import { QtyWithUom } from '@/features/workshop/components/uom-display'

type PreparedItem = {
  id: string
  name: string
  location: string | null
  quantity: number
  uom: string
  crew: string | null
  note: string | null
  status: string
  approval_status: string
  last_pm_comment: string | null
  approved_at: string | null
  updated_at: string
}

type CommentRow = {
  id: string
  body: string
  author_id: string
  author_name: string | null
  created_at: string
  edited_at: string | null
}

export function PreparedWorkspace({ showBanner = true }: { showBanner?: boolean }) {
  const projectId = useSearchParams().get('projectId') ?? ''
  const [items, setItems] = useState<PreparedItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workshop/prepared?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا')
      setItems(data.items ?? [])
      if (data.currentUserId) setCurrentUserId(data.currentUserId)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطا')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const loadComments = useCallback(async (packageId: string) => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/workshop/packages/${packageId}/comments`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در کامنت‌ها')
      setComments(data.comments ?? [])
      if (data.currentUserId) setCurrentUserId(data.currentUserId)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطا')
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [])

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

  useEffect(() => {
    if (selectedId) void loadComments(selectedId)
    else setComments([])
  }, [selectedId, loadComments])

  const selected = items.find((i) => i.id === selectedId) ?? null

  async function postComment() {
    if (!selectedId || !newComment.trim()) return
    setMessage(null)
    const res = await fetch(`/api/workshop/packages/${selectedId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: newComment }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'کامنت ثبت نشد')
      return
    }
    setNewComment('')
    await loadComments(selectedId)
  }

  async function saveEdit(commentId: string) {
    if (!selectedId || !editBody.trim()) return
    setMessage(null)
    const res = await fetch(`/api/workshop/packages/${selectedId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editBody }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'ویرایش نشد')
      return
    }
    setEditingId(null)
    setEditBody('')
    await loadComments(selectedId)
  }

  if (!projectId) {
    return <p className="text-sm text-slate-600">پروژه را از بالا انتخاب کنید.</p>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        showBanner={showBanner}
        title="لیست‌های تهیه‌شده"
        description="سرپرست کارگاه — نوشته‌های دفتر فنی، وضعیت تأیید مدیر پروژه، و گفتگو با کامنت."
      />

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">{message}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-2 font-medium">نام (دفتر فنی)</th>
                  <th className="px-3 py-2 font-medium">محل</th>
                  <th className="px-3 py-2 font-medium">مقدار</th>
                  <th className="px-3 py-2 font-medium">گروه</th>
                  <th className="px-3 py-2 font-medium">وضعیت تأیید PM</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      در حال بارگذاری…
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      هنوز موردی از دفتر فنی ثبت نشده.
                    </td>
                  </tr>
                )}
                {items.map((item) => {
                  const active = item.id === selectedId
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${
                        active ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.name}</p>
                        {item.note && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.note}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">{item.location ?? '—'}</td>
                      <td className="px-3 py-2 tabular-nums">
                        <QtyWithUom qty={item.quantity} uom={item.uom} />
                      </td>
                      <td className="px-3 py-2">{item.crew ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[11px] rounded-full px-2 py-0.5 ${approvalBadgeClass(item.approval_status)}`}
                        >
                          {approvalStatusFa(item.approval_status as never)}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {pmStatusLine(item.approval_status)}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 h-fit space-y-4">
          {!selected ? (
            <p className="text-sm text-slate-500">یک مورد را انتخاب کنید تا جزئیات و کامنت‌ها را ببینید.</p>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="font-semibold text-lg">{selected.name}</h2>
                <dl className="text-sm space-y-1 text-slate-700">
                  <div>محل: {selected.location ?? '—'}</div>
                  <div>
                    مقدار: <QtyWithUom qty={selected.quantity} uom={selected.uom} />
                  </div>
                  <div>گروه: {selected.crew ?? '—'}</div>
                  {selected.note && <div>یادداشت دفتر فنی: {selected.note}</div>}
                </dl>
                <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm space-y-1">
                  <p>
                    وضعیت تأیید:{' '}
                    <span className="font-medium">
                      {approvalStatusFa(selected.approval_status as never)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">{pmStatusLine(selected.approval_status)}</p>
                  {selected.last_pm_comment && (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded p-2 mt-1">
                      آخرین کامنت مدیر: {selected.last_pm_comment}
                    </p>
                  )}
                  {selected.approved_at && (
                    <p className="text-[11px] text-slate-500">
                      زمان تأیید: {new Date(selected.approved_at).toLocaleString('fa-IR-u-nu-latn')}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <h3 className="font-semibold text-sm">گفتگو / کامنت‌ها</h3>
                {commentsLoading && <p className="text-xs text-slate-500">بارگذاری کامنت…</p>}
                <ul className="space-y-2 max-h-[280px] overflow-auto">
                  {!commentsLoading && comments.length === 0 && (
                    <li className="text-xs text-slate-500">هنوز کامنتی نیست.</li>
                  )}
                  {comments.map((c) => {
                    const mine = currentUserId && c.author_id === currentUserId
                    const editing = editingId === c.id
                    return (
                      <li key={c.id} className="rounded-lg border px-3 py-2 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>{c.author_name || 'کاربر'}</span>
                          <span>
                            {new Date(c.created_at).toLocaleString('fa-IR-u-nu-latn')}
                            {c.edited_at ? ' · ویرایش‌شده' : ''}
                          </span>
                        </div>
                        {editing ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full rounded border px-2 py-1.5 text-sm min-h-[60px]"
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void saveEdit(c.id)}
                                className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                              >
                                ذخیره
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null)
                                  setEditBody('')
                                }}
                                className="rounded border px-2 py-1 text-xs"
                              >
                                انصراف
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap">{c.body}</p>
                            {mine && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(c.id)
                                  setEditBody(c.body)
                                }}
                                className="text-[11px] text-sky-700 underline"
                              >
                                ویرایش کامنت من
                              </button>
                            )}
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm min-h-[70px]"
                    placeholder="کامنت بگذارید — بقیه اعضا می‌بینند…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void postComment()}
                    disabled={!newComment.trim()}
                    className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40"
                  >
                    ثبت کامنت
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function pmStatusLine(status: string): string {
  switch (status) {
    case 'approved':
      return 'مدیر پروژه تأیید کرده است'
    case 'pending_approval':
      return 'منتظر تأیید مدیر پروژه'
    case 'rejected':
      return 'مدیر پروژه رد کرده — دفتر فنی باید اصلاح کند'
    case 'change_requested':
      return 'درخواست تغییر در صف تأیید مدیر است'
    case 'draft':
      return 'پیش‌نویس دفتر فنی — هنوز برای مدیر ارسال نشده'
    default:
      return status
  }
}

function approvalBadgeClass(s: string) {
  switch (s) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-800'
    case 'pending_approval':
      return 'bg-sky-100 text-sky-800'
    case 'rejected':
      return 'bg-rose-100 text-rose-800'
    case 'change_requested':
      return 'bg-amber-100 text-amber-900'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}
