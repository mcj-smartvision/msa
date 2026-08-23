'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Send,
  ClipboardList,
  Lock,
  Trash2,
  Save,
} from 'lucide-react'
import {
  approvalStatusFa,
  canDeletePackage,
  canEditPackageContent,
} from '@/lib/workshop/approvals'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/lib/workshop/types'
import { PageHeader } from '@/components/admin/shared'
import { WORKSHOP_UOMS } from '@/lib/workshop/types'

type Selection =
  | { kind: 'schedule'; id: string; name: string; wbs: string | null }
  | { kind: 'package'; id: string; name: string; pkg: WorkshopPackageNode }
  | null

type InlineDraft = {
  parentKind: 'schedule' | 'package'
  parentId: string
  parentName: string
  depth: number
  name: string
  quantity: string
  uom: string
  location: string
  crew: string
}

type EditDraft = {
  name: string
  quantity: string
  uom: string
  location: string
  crew: string
}

export function ScheduleWorkspace() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const forceSupervisorView = searchParams.get('as') === 'supervisor'
  const [nodes, setNodes] = useState<ScheduleTreeNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Selection>(null)
  const [inlineDraft, setInlineDraft] = useState<InlineDraft | null>(null)
  const [edits, setEdits] = useState<Record<string, EditDraft>>({})
  const [changePanel, setChangePanel] = useState(false)
  const [changeComment, setChangeComment] = useState('')
  const [changeForm, setChangeForm] = useState<EditDraft | null>(null)
  const [todayQty, setTodayQty] = useState('')
  const [showTodayQty, setShowTodayQty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readOnly, setReadOnly] = useState(forceSupervisorView)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [treeRes, capRes] = await Promise.all([
        fetch(`/api/workshop/schedule-tree?projectId=${projectId}`),
        fetch(`/api/workshop/capabilities?projectId=${projectId}`),
      ])
      const data = await treeRes.json()
      const caps = capRes.ok ? await capRes.json() : data.capabilities
      if (!treeRes.ok) throw new Error(data.error || 'خطا در بارگذاری')
      setNodes(data.nodes ?? [])
      const serverReadOnly = Boolean(caps?.readOnly ?? data.capabilities?.readOnly)
      setReadOnly(forceSupervisorView || serverReadOnly)
      const exp: Record<string, boolean> = {}
      for (const n of data.nodes ?? []) {
        if (n.depth <= 2) exp[n.id] = true
      }
      setExpanded((prev) => ({ ...exp, ...prev }))
      setSelected((prev) => {
        if (!prev || prev.kind !== 'package') return prev
        const found = findPackage(data.nodes ?? [], prev.id)
        return found ? { kind: 'package', id: found.id, name: found.name, pkg: found } : null
      })
      setEdits({})
      setInlineDraft(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطا')
    } finally {
      setLoading(false)
    }
  }, [projectId, forceSupervisorView])

  useEffect(() => {
    void load()
  }, [load])

  const selectedPackage = selected?.kind === 'package' ? selected.pkg : null
  const selectedPackageId = selectedPackage?.id ?? null
  const editable =
    !readOnly && selectedPackage
      ? canEditPackageContent(selectedPackage.approvalStatus)
      : false
  const deletable =
    !readOnly && selectedPackage ? canDeletePackage(selectedPackage.approvalStatus) : false
  const approved = !readOnly && selectedPackage?.approvalStatus === 'approved'
  const canChangeRequest =
    !readOnly &&
    selectedPackage &&
    (selectedPackage.approvalStatus === 'approved' ||
      selectedPackage.approvalStatus === 'change_requested')
  const canSubmit =
    !readOnly &&
    selectedPackage &&
    (selectedPackage.approvalStatus === 'draft' || selectedPackage.approvalStatus === 'rejected')

  function packageDepth(pkgId: string): number {
    for (const n of nodes) {
      const d = findPackageDepth(n.packages, pkgId, n.depth + 1)
      if (d != null) return d
    }
    return 1
  }

  function startInlineCreate() {
    if (!selected || readOnly) return
    const depth =
      selected.kind === 'schedule'
        ? (nodes.find((n) => n.id === selected.id)?.depth ?? 0) + 1
        : packageDepth(selected.id) + 1
    if (selected.kind === 'schedule') {
      setExpanded((x) => ({ ...x, [selected.id]: true }))
    } else {
      setExpanded((x) => ({ ...x, [`pkg:${selected.id}`]: true }))
    }
    setInlineDraft({
      parentKind: selected.kind,
      parentId: selected.id,
      parentName: selected.name,
      depth,
      name: '',
      quantity: '',
      uom: 'm2',
      location: '',
      crew: '',
    })
    setMessage(null)
  }

  function getEdit(pkg: WorkshopPackageNode): EditDraft {
    return (
      edits[pkg.id] ?? {
        name: pkg.name,
        quantity: String(pkg.quantity),
        uom: pkg.uom,
        location: pkg.location ?? '',
        crew: pkg.crew ?? '',
      }
    )
  }

  function setEditField(pkgId: string, pkg: WorkshopPackageNode, patch: Partial<EditDraft>) {
    setEdits((prev) => ({
      ...prev,
      [pkgId]: { ...getEdit(pkg), ...patch },
    }))
  }

  function isDirty(pkg: WorkshopPackageNode) {
    const e = edits[pkg.id]
    if (!e) return false
    return (
      e.name !== pkg.name ||
      e.quantity !== String(pkg.quantity) ||
      e.uom !== pkg.uom ||
      e.location !== (pkg.location ?? '') ||
      e.crew !== (pkg.crew ?? '')
    )
  }

  async function savePackage(pkg: WorkshopPackageNode) {
    const e = getEdit(pkg)
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/workshop/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: e.name,
          quantity: Number(e.quantity),
          uom: e.uom,
          location: e.location,
          crew: e.crew,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ذخیره نشد')
      setMessage('ذخیره شد')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا')
    } finally {
      setSaving(false)
    }
  }

  async function createInline() {
    if (!inlineDraft || !projectId) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/workshop/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          parentScheduleNodeId: inlineDraft.parentKind === 'schedule' ? inlineDraft.parentId : null,
          parentPackageId: inlineDraft.parentKind === 'package' ? inlineDraft.parentId : null,
          name: inlineDraft.name,
          quantity: Number(inlineDraft.quantity),
          uom: inlineDraft.uom,
          location: inlineDraft.location,
          crew: inlineDraft.crew,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ذخیره نشد')
      setInlineDraft(null)
      setMessage('زیرمجموعه اضافه شد — در همین جدول ویرایش کنید')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا')
    } finally {
      setSaving(false)
    }
  }

  async function submitApproval() {
    if (!selectedPackageId) return
    // save dirty first
    if (selectedPackage && isDirty(selectedPackage)) {
      await savePackage(selectedPackage)
    }
    setMessage(null)
    const res = await fetch(`/api/workshop/packages/${selectedPackageId}/submit`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'ارسال نشد')
      return
    }
    setMessage('برای مدیر پروژه ارسال شد')
    await load()
  }

  async function deleteSelected() {
    if (!selectedPackageId || !selectedPackage) return
    if (!window.confirm(`«${selectedPackage.name}» حذف شود؟`)) return
    setMessage(null)
    const res = await fetch(`/api/workshop/packages/${selectedPackageId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'حذف نشد')
      return
    }
    setSelected(null)
    setMessage('حذف شد')
    await load()
  }

  async function submitChangeRequest() {
    if (!selectedPackageId || !changeForm) return
    setMessage(null)
    const res = await fetch(`/api/workshop/packages/${selectedPackageId}/change-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: changeComment,
        change: {
          name: changeForm.name,
          quantity: Number(changeForm.quantity),
          uom: changeForm.uom,
          location: changeForm.location,
          crew: changeForm.crew,
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'درخواست تغییر ثبت نشد')
      return
    }
    setChangePanel(false)
    setChangeComment('')
    setChangeForm(null)
    setMessage('درخواست تغییر برای مدیر پروژه ارسال شد')
    await load()
  }

  async function sendToday() {
    if (!selectedPackageId) return
    setMessage(null)
    const res = await fetch(`/api/workshop/packages/${selectedPackageId}/send-to-today`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        plannedQty: Number(todayQty),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'ارسال نشد')
      return
    }
    setShowTodayQty(false)
    setTodayQty('')
    setMessage('به برنامه امروز اضافه شد')
    await load()
  }

  const visibleRows = useMemo(() => {
    const rows: Array<
      | { type: 'schedule'; node: ScheduleTreeNode }
      | { type: 'package'; pkg: WorkshopPackageNode; depth: number; parentScheduleId: string }
    > = []

    function walkPackages(pkgs: WorkshopPackageNode[], depth: number, parentScheduleId: string) {
      for (const pkg of pkgs) {
        rows.push({ type: 'package', pkg, depth, parentScheduleId })
        if (expanded[`pkg:${pkg.id}`]) {
          walkPackages(pkg.children, depth + 1, parentScheduleId)
        }
      }
    }

    for (const node of nodes) {
      rows.push({ type: 'schedule', node })
      if (expanded[node.id]) {
        walkPackages(node.packages, node.depth + 1, node.id)
      }
    }
    return rows
  }, [nodes, expanded])

  if (!projectId) {
    return <p className="text-sm text-slate-600">پروژه را از بالا انتخاب کنید.</p>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        title="برنامه"
        description={
          readOnly
            ? 'نمای فقط‌خواندنی سرپرست کارگاه — برای ویرایش به دفتر فنی مراجعه کنید.'
            : 'در همین جدول ویرایش کنید → به مدیر پروژه بفرستید → بعد از تأیید به امروز.'
        }
      />

      {readOnly && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950">
          شما به‌عنوان سرپرست کارگاه فقط مشاهده می‌کنید. تغییر و ارسال فقط برای دفتر فنی / مدیر است.
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">{message}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {!readOnly && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-2">
            <button
              type="button"
              disabled={!selected}
              onClick={startInlineCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              زیرمجموعه
            </button>
            <button
              type="button"
              disabled={!canSubmit || saving}
              onClick={() => void submitApproval()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              ارسال به مدیر پروژه
            </button>
            <button
              type="button"
              disabled={!selectedPackage || !editable || !isDirty(selectedPackage) || saving}
              onClick={() => selectedPackage && void savePackage(selectedPackage)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              ذخیره
            </button>
            <button
              type="button"
              disabled={!deletable || saving}
              onClick={() => void deleteSelected()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 text-rose-800 px-3 py-2 text-sm disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              حذف
            </button>
            <button
              type="button"
              disabled={!canChangeRequest}
              onClick={() => {
                if (!selectedPackage) return
                const pending = selectedPackage.pendingChange
                setChangeForm({
                  name: pending?.name ?? selectedPackage.name,
                  quantity: String(pending?.quantity ?? selectedPackage.quantity),
                  uom: pending?.uom ?? selectedPackage.uom,
                  location:
                    pending?.location !== undefined
                      ? pending.location ?? ''
                      : selectedPackage.location ?? '',
                  crew:
                    pending?.crew !== undefined ? pending.crew ?? '' : selectedPackage.crew ?? '',
                })
                setChangePanel(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              <Lock className="h-4 w-4" />
              درخواست تغییر
            </button>
            <button
              type="button"
              disabled={!approved}
              onClick={() => setShowTodayQty(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              ارسال به امروز
            </button>
          </div>
          )}

          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-2 font-medium">نام</th>
                  <th className="px-3 py-2 font-medium w-28">WBS</th>
                  <th className="px-3 py-2 font-medium w-28">محل</th>
                  <th className="px-3 py-2 font-medium w-24">مقدار</th>
                  <th className="px-3 py-2 font-medium w-20">واحد</th>
                  <th className="px-3 py-2 font-medium w-28">تأیید</th>
                  <th className="px-3 py-2 font-medium w-24">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      در حال بارگذاری…
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.length === 0 && !inlineDraft && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      برنامه‌ای برای این پروژه import نشده.
                    </td>
                  </tr>
                )}
                {visibleRows.map((row) => {
                  if (row.type === 'schedule') {
                    const n = row.node
                    const isSel = selected?.kind === 'schedule' && selected.id === n.id
                    const open = Boolean(expanded[n.id])
                    return (
                      <FragmentRows key={`s-${n.id}`}>
                        <tr
                          onClick={() =>
                            setSelected({ kind: 'schedule', id: n.id, name: n.name, wbs: n.wbs })
                          }
                          className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${
                            isSel ? 'bg-amber-50' : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            <div
                              className="flex items-center gap-1"
                              style={{ paddingInlineStart: n.depth * 14 }}
                            >
                              <button
                                type="button"
                                className="p-0.5 rounded hover:bg-slate-200"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpanded((x) => ({ ...x, [n.id]: !open }))
                                }}
                              >
                                {open ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <span className="font-medium">{n.name}</span>
                              {n.packages.length > 0 && (
                                <span className="text-[11px] text-slate-400">
                                  ({n.packages.length})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{n.wbs ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-400">—</td>
                          <td className="px-3 py-2 text-slate-400">—</td>
                          <td className="px-3 py-2 text-slate-400">—</td>
                          <td className="px-3 py-2 text-slate-400">—</td>
                          <td className="px-3 py-2 text-slate-400">پایه</td>
                        </tr>
                        {!readOnly &&
                          inlineDraft &&
                          inlineDraft.parentKind === 'schedule' &&
                          inlineDraft.parentId === n.id && (
                            <InlineCreateRow
                              draft={inlineDraft}
                              setDraft={setInlineDraft}
                              onSave={() => void createInline()}
                              onCancel={() => setInlineDraft(null)}
                              saving={saving}
                            />
                          )}
                      </FragmentRows>
                    )
                  }

                  const p = row.pkg
                  const isSel = selected?.kind === 'package' && selected.id === p.id
                  const open = Boolean(expanded[`pkg:${p.id}`])
                  const canEdit = !readOnly && canEditPackageContent(p.approvalStatus)
                  const e = getEdit(p)

                  return (
                    <FragmentRows key={`p-${p.id}`}>
                      <tr
                        onClick={() =>
                          setSelected({ kind: 'package', id: p.id, name: p.name, pkg: p })
                        }
                        className={`cursor-pointer border-b border-slate-50 hover:bg-emerald-50/40 ${
                          isSel ? 'bg-emerald-50' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div
                            className="flex items-center gap-1"
                            style={{ paddingInlineStart: row.depth * 14 }}
                          >
                            {p.children.length > 0 ? (
                              <button
                                type="button"
                                className="p-0.5 rounded hover:bg-slate-200"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  setExpanded((x) => ({ ...x, [`pkg:${p.id}`]: !open }))
                                }}
                              >
                                {open ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4" />
                            )}
                            <ClipboardList className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            {canEdit ? (
                              <input
                                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-sm"
                                value={e.name}
                                onClick={(ev) => ev.stopPropagation()}
                                onChange={(ev) => setEditField(p.id, p, { name: ev.target.value })}
                                onBlur={() => {
                                  if (isDirty(p)) void savePackage(p)
                                }}
                              />
                            ) : (
                              <span>{p.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-400">—</td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <input
                              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-sm"
                              value={e.location}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) =>
                                setEditField(p.id, p, { location: ev.target.value })
                              }
                              onBlur={() => {
                                if (isDirty(p)) void savePackage(p)
                              }}
                              placeholder="محل"
                            />
                          ) : (
                            p.location ?? '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <input
                              type="number"
                              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-sm tabular-nums"
                              value={e.quantity}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) =>
                                setEditField(p.id, p, { quantity: ev.target.value })
                              }
                              onBlur={() => {
                                if (isDirty(p)) void savePackage(p)
                              }}
                            />
                          ) : (
                            <span className="tabular-nums">{p.quantity}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <select
                              className="w-full rounded border border-slate-200 bg-white px-1 py-1 text-sm"
                              value={e.uom}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => {
                                setEditField(p.id, p, { uom: ev.target.value })
                                // save after uom change
                                const next = { ...getEdit(p), uom: ev.target.value }
                                setEdits((prev) => ({ ...prev, [p.id]: next }))
                                void (async () => {
                                  const res = await fetch(`/api/workshop/packages/${p.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      name: next.name,
                                      quantity: Number(next.quantity),
                                      uom: next.uom,
                                      location: next.location,
                                      crew: next.crew,
                                    }),
                                  })
                                  if (res.ok) await load()
                                })()
                              }}
                            >
                              {WORKSHOP_UOMS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          ) : (
                            p.uom
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[11px] rounded-full px-2 py-0.5 ${approvalBadgeClass(p.approvalStatus)}`}
                          >
                            {approvalStatusFa(p.approvalStatus)}
                          </span>
                        </td>
                        <td className="px-3 py-2">{statusFa(p.status)}</td>
                      </tr>
                      {!readOnly &&
                        inlineDraft &&
                        inlineDraft.parentKind === 'package' &&
                        inlineDraft.parentId === p.id && (
                          <InlineCreateRow
                            draft={inlineDraft}
                            setDraft={setInlineDraft}
                            onSave={() => void createInline()}
                            onCancel={() => setInlineDraft(null)}
                            saving={saving}
                          />
                        )}
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 h-fit space-y-3">
          {readOnly ? (
            !selected ? (
              <>
                <h2 className="font-semibold">مشاهده برنامه</h2>
                <p className="text-sm text-slate-600">
                  یک ردیف را انتخاب کنید. برای کامنت و جزئیات بیشتر به «لیست‌ها» بروید.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-semibold">ردیف انتخاب‌شده</h2>
                <p className="text-sm">{selected.name}</p>
                {selectedPackage && (
                  <div className="space-y-2 text-xs text-slate-600">
                    <p>
                      تأیید:{' '}
                      <span className="font-medium text-slate-800">
                        {approvalStatusFa(selectedPackage.approvalStatus)}
                      </span>
                    </p>
                    {selectedPackage.location && <p>محل: {selectedPackage.location}</p>}
                    <p>
                      مقدار: {selectedPackage.quantity} {selectedPackage.uom}
                    </p>
                    {selectedPackage.crew && <p>گروه: {selectedPackage.crew}</p>}
                    {selectedPackage.note && <p>یادداشت: {selectedPackage.note}</p>}
                    {selectedPackage.lastPmComment && (
                      <p className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-amber-900">
                        کامنت مدیر: {selectedPackage.lastPmComment}
                      </p>
                    )}
                  </div>
                )}
              </>
            )
          ) : !selected ? (
            <>
              <h2 className="font-semibold">از اینجا شروع کنید</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                <li>یک فعالیت را انتخاب کنید</li>
                <li>«زیرمجموعه» بزنید و در جدول پر کنید</li>
                <li>«ارسال به مدیر پروژه»</li>
              </ol>
            </>
          ) : (
            <>
              <h2 className="font-semibold">ردیف انتخاب‌شده</h2>
              <p className="text-sm">{selected.name}</p>
              {selectedPackage && (
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    تأیید:{' '}
                    <span className="font-medium text-slate-800">
                      {approvalStatusFa(selectedPackage.approvalStatus)}
                    </span>
                  </p>
                  {editable && (
                    <p className="text-emerald-700">در جدول مستقیم ویرایش کنید (با blur ذخیره می‌شود).</p>
                  )}
                  {selectedPackage.lastPmComment && (
                    <p className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-amber-900">
                      کامنت مدیر: {selectedPackage.lastPmComment}
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={startInlineCreate}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              >
                + زیرمجموعه
              </button>
              {canSubmit && (
                <button
                  type="button"
                  onClick={() => void submitApproval()}
                  className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
                >
                  ارسال به مدیر پروژه
                </button>
              )}
              {deletable && (
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  className="w-full rounded-lg border border-rose-300 text-rose-800 px-3 py-2 text-sm"
                >
                  حذف این مورد
                </button>
              )}
              {showTodayQty && approved && (
                <div className="space-y-2 border-t pt-3">
                  <label className="block text-sm">
                    مقدار امروز
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={todayQty}
                      onChange={(ev) => setTodayQty(ev.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void sendToday()}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    تأیید ارسال به امروز
                  </button>
                </div>
              )}
              {changePanel && changeForm && (
                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-sm font-semibold">درخواست تغییر</h3>
                  <input
                    className="w-full rounded border px-2 py-1.5 text-sm"
                    value={changeForm.name}
                    onChange={(ev) => setChangeForm({ ...changeForm, name: ev.target.value })}
                    placeholder="نام"
                  />
                  <input
                    className="w-full rounded border px-2 py-1.5 text-sm"
                    value={changeForm.location}
                    onChange={(ev) => setChangeForm({ ...changeForm, location: ev.target.value })}
                    placeholder="محل"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="rounded border px-2 py-1.5 text-sm"
                      value={changeForm.quantity}
                      onChange={(ev) =>
                        setChangeForm({ ...changeForm, quantity: ev.target.value })
                      }
                    />
                    <select
                      className="rounded border px-2 py-1.5 text-sm"
                      value={changeForm.uom}
                      onChange={(ev) => setChangeForm({ ...changeForm, uom: ev.target.value })}
                    >
                      {WORKSHOP_UOMS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="w-full rounded border px-2 py-1.5 text-sm min-h-[60px]"
                    value={changeComment}
                    onChange={(ev) => setChangeComment(ev.target.value)}
                    placeholder="دلیل تغییر"
                  />
                  <button
                    type="button"
                    onClick={() => void submitChangeRequest()}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    ارسال درخواست
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangePanel(false)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    انصراف
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function InlineCreateRow({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: InlineDraft
  setDraft: (d: InlineDraft | null) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <tr className="bg-sky-50/80 border-b border-sky-100">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1" style={{ paddingInlineStart: draft.depth * 14 }}>
          <Plus className="h-3.5 w-3.5 text-sky-700 shrink-0" />
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-sky-200 bg-white px-1.5 py-1 text-sm"
            placeholder="نام زیرمجموعه *"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
      </td>
      <td className="px-3 py-2 text-slate-400 text-xs">جدید</td>
      <td className="px-3 py-2">
        <input
          className="w-full rounded border border-sky-200 bg-white px-1.5 py-1 text-sm"
          placeholder="محل"
          value={draft.location}
          onChange={(e) => setDraft({ ...draft, location: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className="w-full rounded border border-sky-200 bg-white px-1.5 py-1 text-sm"
          placeholder="مقدار *"
          value={draft.quantity}
          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="w-full rounded border border-sky-200 bg-white px-1 py-1 text-sm"
          value={draft.uom}
          onChange={(e) => setDraft({ ...draft, uom: e.target.value })}
        >
          {WORKSHOP_UOMS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2" colSpan={2}>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40"
          >
            ذخیره
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-2 py-1 text-xs"
          >
            انصراف
          </button>
        </div>
      </td>
    </tr>
  )
}

function findPackage(nodes: ScheduleTreeNode[], id: string): WorkshopPackageNode | null {
  function walk(pkgs: WorkshopPackageNode[]): WorkshopPackageNode | null {
    for (const p of pkgs) {
      if (p.id === id) return p
      const child = walk(p.children)
      if (child) return child
    }
    return null
  }
  for (const n of nodes) {
    const found = walk(n.packages)
    if (found) return found
  }
  return null
}

function findPackageDepth(
  pkgs: WorkshopPackageNode[],
  id: string,
  depth: number
): number | null {
  for (const p of pkgs) {
    if (p.id === id) return depth
    const child = findPackageDepth(p.children, id, depth + 1)
    if (child != null) return child
  }
  return null
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

function statusFa(s: string) {
  const map: Record<string, string> = {
    draft: 'پیش‌نویس',
    ready: 'آماده',
    in_progress: 'در حال اجرا',
    partial: 'ناقص',
    done: 'انجام شد',
    blocked: 'مسدود',
    needs_review: 'نیاز به بررسی',
  }
  return map[s] ?? s
}
