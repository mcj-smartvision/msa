'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
  canEditWorkshopPackageRow,
  WORKSHOP_SKIP_PM_APPROVAL,
} from '@/lib/workshop/approvals'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/lib/workshop/types'
import {
  collectScheduleTaskNodes,
  defaultScheduleExpanded,
  enrichScheduleTreeWithWbs,
  findPackageInTree,
  findPackagePath,
  findScheduleNode,
  flattenWorkshopSchedule,
  nextChildWbs,
} from '@/lib/workshop/wbs-numbering'
import { PageHeader } from '@/components/admin/shared'
import { ScheduleDownloadButton } from '@/components/schedule/schedule-download-button'
import { WORKSHOP_UOMS } from '@/lib/workshop/types'
import { formatScheduleWeightDisplay } from '@/lib/workshop/package-weight'

type Selection =
  | { kind: 'schedule'; id: string; name: string; wbs: string | null }
  | { kind: 'package'; id: string; name: string; pkg: WorkshopPackageNode }
  | null

type InlineDraft = {
  parentKind: 'schedule' | 'package'
  parentId: string
  parentName: string
  depth: number
  previewWbs: string
  name: string
  quantity: string
  uom: string
  location: string
  crew: string
  weightPercent: string
}

type EditDraft = {
  name: string
  quantity: string
  uom: string
  location: string
  crew: string
  weightPercent: string
}

const SCHEDULE_COL_WIDTHS = [
  '6%',
  '34%',
  '11%',
  '9%',
  '7%',
  '6%',
  '8%',
  '8%',
  '11%',
] as const

const SCHEDULE_CELL = 'px-1 py-1.5 align-middle box-border'
const SCHEDULE_HEAD = `${SCHEDULE_CELL} font-medium text-slate-600`

export function ScheduleWorkspace({ showBanner = true }: { showBanner?: boolean }) {
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
  const [canWriteServer, setCanWriteServer] = useState(false)

  const load = useCallback(async (expandAfter?: { kind: 'schedule' | 'package'; id: string }) => {
    if (!projectId) return []
    setLoading(true)
    try {
      const [treeRes, capRes] = await Promise.all([
        fetch(`/api/workshop/schedule-tree?projectId=${projectId}`),
        fetch(`/api/workshop/capabilities?projectId=${projectId}`),
      ])
      const data = await treeRes.json()
      const caps = capRes.ok ? await capRes.json() : data.capabilities
      if (!treeRes.ok) throw new Error(data.error || 'خطا در بارگذاری')
      const loadedNodes = enrichScheduleTreeWithWbs(data.nodes ?? [])
      setNodes(loadedNodes)
      const serverReadOnly = Boolean(caps?.readOnly ?? data.capabilities?.readOnly)
      setCanWriteServer(Boolean(caps?.canWrite))
      setReadOnly(forceSupervisorView || serverReadOnly)
      const exp = defaultScheduleExpanded(loadedNodes)
      if (expandAfter?.kind === 'package') {
        exp[`pkg:${expandAfter.id}`] = true
      }
      if (expandAfter?.kind === 'schedule') {
        const parentNode = collectScheduleTaskNodes(loadedNodes).find(
          (n) => n.taskId === expandAfter.id || n.id === expandAfter.id
        )
        if (parentNode) exp[parentNode.id] = true
      }
      setExpanded((prev) => ({ ...exp, ...prev }))
      setSelected((prev) => {
        if (!prev || prev.kind !== 'package') return prev
        const found = findPackageInTree(loadedNodes, prev.id)
        return found ? { kind: 'package', id: found.id, name: found.name, pkg: found } : null
      })
      setEdits({})
      setInlineDraft(null)
      return loadedNodes
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطا')
      return []
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
      ? canEditWorkshopPackageRow(
          selectedPackage.approvalStatus,
          selectedPackage.origin ?? 'user_added'
        )
      : false
  const deletable =
    !readOnly && selectedPackage ? canDeletePackage(selectedPackage.approvalStatus) : false
  const approved =
    !readOnly &&
    selectedPackage &&
    (selectedPackage.approvalStatus === 'approved' ||
      (WORKSHOP_SKIP_PM_APPROVAL && selectedPackage.approvalStatus !== 'change_requested'))
  const canChangeRequest =
    !readOnly &&
    selectedPackage &&
    !WORKSHOP_SKIP_PM_APPROVAL &&
    (selectedPackage.approvalStatus === 'approved' ||
      selectedPackage.approvalStatus === 'change_requested')
  const canSubmit =
    !WORKSHOP_SKIP_PM_APPROVAL &&
    !readOnly &&
    selectedPackage &&
    (selectedPackage.approvalStatus === 'draft' || selectedPackage.approvalStatus === 'rejected')

  function visualScheduleDepth(scheduleNodeId: string): number {
    const n = findScheduleNode(nodes, scheduleNodeId)
    return n?.depth ?? 0
  }

  function packageDepth(pkgId: string): number {
    const path = findPackagePath(nodes, pkgId)
    if (!path) return 1
    return visualScheduleDepth(path.scheduleId) + path.packageIds.length
  }

  function startInlineCreate(target?: Selection) {
    const row = target ?? selected
    if (!row || readOnly) return
    if (row.kind === 'schedule') {
      const node = findScheduleNode(nodes, row.id)
      if (!node?.taskId || node.isSyntheticGroup) {
        setMessage('یک فعالیت مشخص را انتخاب کنید (نه ردیف گروه سطح بالا)')
        return
      }
      setExpanded((x) => ({ ...x, [node.id]: true }))
      setSelected({ kind: 'schedule', id: node.id, name: node.name, wbs: node.wbs })
      setInlineDraft({
        parentKind: 'schedule',
        parentId: node.taskId,
        parentName: node.name,
        depth: visualScheduleDepth(node.id) + 1,
        previewWbs: nextChildWbs(node.wbs, node.packages.length),
        name: '',
        quantity: '',
        uom: 'm2',
        location: '',
        crew: '',
        weightPercent: '',
      })
      setMessage(null)
      return
    }

    const pkg = row.pkg
    setExpanded((x) => ({ ...x, [`pkg:${pkg.id}`]: true }))
    setSelected(row)
    setInlineDraft({
      parentKind: 'package',
      parentId: pkg.id,
      parentName: pkg.name,
      depth: packageDepth(pkg.id),
      previewWbs: nextChildWbs(pkg.wbs, pkg.children.length),
      name: '',
      quantity: '',
      uom: 'm2',
      location: '',
      crew: '',
        weightPercent: '',
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
        weightPercent: pkg.weightPercent != null ? String(pkg.weightPercent) : '',
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
      e.crew !== (pkg.crew ?? '') ||
      e.weightPercent !== (pkg.weightPercent != null ? String(pkg.weightPercent) : '')
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
          weightPercent: e.weightPercent.trim() ? Number(e.weightPercent) : null,
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
    const name = inlineDraft.name.trim()
    const quantity = Number(inlineDraft.quantity)
    if (!name) {
      setMessage('نام زیرمجموعه را وارد کنید')
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage('مقدار باید بزرگ‌تر از صفر باشد')
      return
    }

    const expandAfter =
      inlineDraft.parentKind === 'package'
        ? { kind: 'package' as const, id: inlineDraft.parentId }
        : { kind: 'schedule' as const, id: inlineDraft.parentId }

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
          name,
          quantity,
          uom: inlineDraft.uom,
          location: inlineDraft.location,
          crew: inlineDraft.crew,
          wbsCode: inlineDraft.previewWbs,
          weightPercent: inlineDraft.weightPercent.trim()
            ? Number(inlineDraft.weightPercent)
            : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ذخیره نشد')

      const createdId = data.package?.id ? String(data.package.id) : null
      setInlineDraft(null)
      setMessage(`زیرمجموعه ${inlineDraft.previewWbs} ذخیره شد`)
      const loadedNodes = await load(expandAfter)
      if (createdId) {
        const pkg = findPackageInTree(loadedNodes, createdId)
        if (pkg) {
          setSelected({ kind: 'package', id: pkg.id, name: pkg.name, pkg })
        }
      }
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

  const visibleRows = useMemo(
    () => flattenWorkshopSchedule(nodes, expanded),
    [nodes, expanded]
  )

  const canAddSubBranch =
    !readOnly &&
    selected &&
    (selected.kind === 'package' ||
      (selected.kind === 'schedule' &&
        findScheduleNode(nodes, selected.id)?.taskId &&
        !findScheduleNode(nodes, selected.id)?.isSyntheticGroup))

  const inlineDraftValid =
    inlineDraft &&
    inlineDraft.name.trim().length > 0 &&
    Number(inlineDraft.quantity) > 0

  const dirtyPackages = useMemo(() => {
    const dirty: WorkshopPackageNode[] = []
    const visit = (pkgs: WorkshopPackageNode[]) => {
      for (const p of pkgs) {
        if (isDirty(p)) dirty.push(p)
        visit(p.children)
      }
    }
    for (const n of nodes) visit(n.packages)
    return dirty
  }, [nodes, edits])

  const toolbarSaveEnabled = inlineDraftValid || dirtyPackages.length > 0

  if (!projectId) {
    return <p className="text-sm text-slate-600">پروژه را از بالا انتخاب کنید.</p>
  }

  return (
    <div className="space-y-4 w-full max-w-full min-w-0" dir="rtl">
      {showBanner ? (
        <PageHeader
          showBanner={showBanner}
          title="برنامه"
          description={
            readOnly
              ? 'نمای فقط‌خواندنی سرپرست کارگاه — برای ویرایش به دفتر فنی مراجعه کنید.'
              : 'در همین جدول ویرایش کنید → ذخیره → ارسال به امروز.'
          }
          actions={
            projectId ? (
              <ScheduleDownloadButton
                projectId={projectId}
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              />
            ) : null
          }
        />
      ) : projectId ? (
        <div className="flex justify-end">
          <ScheduleDownloadButton projectId={projectId} variant="outline" size="sm" />
        </div>
      ) : null}

      {readOnly && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950 space-y-1">
          {forceSupervisorView && canWriteServer ? (
            <>
              <p>در حال مشاهده نمای سرپرست — افزودن زیرشاخه در این حالت غیرفعال است.</p>
              <Link
                href={`/site-ops/schedule?projectId=${encodeURIComponent(projectId)}`}
                className="font-medium text-sky-800 underline underline-offset-2"
              >
                برو به حالت ویرایش (دفتر فنی)
              </Link>
            </>
          ) : (
            <p>
              شما به‌عنوان سرپرست کارگاه فقط مشاهده می‌کنید. تغییر و ارسال فقط برای دفتر فنی /
              مدیر است.
            </p>
          )}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">{message}</div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden w-full max-w-full min-w-0">
          {!readOnly && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-2">
            <button
              type="button"
              disabled={!canAddSubBranch}
              onClick={() => startInlineCreate()}
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
              disabled={!toolbarSaveEnabled || saving}
              onClick={() => {
                if (inlineDraft) void createInline()
                else if (dirtyPackages.length > 0) {
                  void (async () => {
                    for (const pkg of dirtyPackages) await savePackage(pkg)
                  })()
                } else if (selectedPackage) void savePackage(selectedPackage)
              }}
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

          {showTodayQty && approved && selectedPackage && (
            <div className="flex flex-wrap items-end gap-3 border-b bg-sky-50 px-3 py-3">
              <label className="text-sm">
                مقدار امروز
                <input
                  type="number"
                  className="mt-1 rounded-lg border px-3 py-2 text-sm w-32"
                  value={todayQty}
                  onChange={(ev) => setTodayQty(ev.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => void sendToday()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              >
                تأیید ارسال به امروز
              </button>
              <button
                type="button"
                onClick={() => setShowTodayQty(false)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                انصراف
              </button>
            </div>
          )}

          {changePanel && changeForm && selectedPackage && (
            <div className="border-b bg-amber-50 px-3 py-3 space-y-2">
              <h3 className="text-sm font-semibold">درخواست تغییر — {selectedPackage.name}</h3>
              <div className="flex flex-wrap gap-2">
                <input
                  className="rounded border px-2 py-1.5 text-sm min-w-[160px]"
                  value={changeForm.name}
                  onChange={(ev) => setChangeForm({ ...changeForm, name: ev.target.value })}
                  placeholder="نام"
                />
                <input
                  className="rounded border px-2 py-1.5 text-sm min-w-[120px]"
                  value={changeForm.location}
                  onChange={(ev) => setChangeForm({ ...changeForm, location: ev.target.value })}
                  placeholder="محل"
                />
                <input
                  type="number"
                  className="rounded border px-2 py-1.5 text-sm w-24"
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
                className="w-full rounded border px-2 py-1.5 text-sm min-h-[52px]"
                value={changeComment}
                onChange={(ev) => setChangeComment(ev.target.value)}
                placeholder="دلیل تغییر"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void submitChangeRequest()}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  ارسال درخواست
                </button>
                <button
                  type="button"
                  onClick={() => setChangePanel(false)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          <div
            className="overflow-y-scroll overflow-x-hidden max-h-[calc(100vh-200px)] w-full [scrollbar-gutter:stable]"
          >
            <table className="w-full border-collapse text-xs sm:text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                {SCHEDULE_COL_WIDTHS.map((width, i) => (
                  <col key={i} style={{ width }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-[2] bg-white border-b text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)]">
                <tr>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[0] }}>WBS</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[1] }}>نام</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[2] }}>تاریخ</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[3] }}>محل</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[4] }}>مقدار</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[5] }}>واحد</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[6] }}>وزن</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[7] }}>تأیید</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[8] }}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      در حال بارگذاری…
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.length === 0 && !inlineDraft && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      برنامه‌ای برای این پروژه import نشده.
                    </td>
                  </tr>
                )}
                {visibleRows.map((row) => {
                  if (row.type === 'schedule') {
                    const n = row.node
                    const isSel = selected?.kind === 'schedule' && selected.id === n.id
                    const open = Boolean(expanded[n.id])
                    const canExpand = Boolean(n.taskId)
                    const indentPx = 8 + row.depth * 22
                    return (
                      <FragmentRows key={`s-${n.id}`}>
                        <tr
                          onClick={() =>
                            setSelected({ kind: 'schedule', id: n.id, name: n.name, wbs: n.wbs })
                          }
                          className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                            isSel ? 'bg-amber-50' : ''
                          }`}
                        >
                          <td className={`${SCHEDULE_CELL} font-mono text-[11px] tabular-nums text-slate-600 text-center`}>
                            {row.wbs}
                          </td>
                          <td className={`${SCHEDULE_CELL} overflow-hidden`}>
                            <div
                              className="flex items-center gap-0.5 min-w-0"
                              style={{
                                paddingInlineStart: indentPx,
                                borderInlineStart:
                                  row.depth > 0 ? '2px solid rgb(226 232 240)' : undefined,
                              }}
                            >
                              {canExpand ? (
                                <button
                                  type="button"
                                  className="p-0.5 rounded hover:bg-slate-200 shrink-0"
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
                              ) : (
                                <span className="w-4 shrink-0" />
                              )}
                              <span className="font-medium text-slate-900 truncate text-xs leading-snug">
                                {n.name}
                              </span>
                              {n.packages.length > 0 && (
                                <span className="text-[11px] text-slate-400 shrink-0">
                                  ({n.packages.length})
                                </span>
                              )}
                              {!readOnly && n.taskId && (
                                <button
                                  type="button"
                                  title="افزودن زیرشاخه"
                                  className="ms-1 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startInlineCreate({
                                      kind: 'schedule',
                                      id: n.id,
                                      name: n.name,
                                      wbs: n.wbs,
                                    })
                                  }}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className={`${SCHEDULE_CELL} text-[11px] text-slate-600 tabular-nums leading-tight`}>
                            {formatActivityDateShort(row.startDate, row.finishDate)}
                          </td>
                          <td className={`${SCHEDULE_CELL} text-slate-400 text-center`}>—</td>
                          <td className={`${SCHEDULE_CELL} text-slate-400 text-center`}>—</td>
                          <td className={`${SCHEDULE_CELL} text-slate-400 text-center`}>—</td>
                          <td className={`${SCHEDULE_CELL} tabular-nums text-[11px] text-slate-700 text-center`}>
                            {formatScheduleWeightDisplay(n.scheduleWeight)}
                          </td>
                          <td className={`${SCHEDULE_CELL} text-slate-400 text-center`}>—</td>
                          <td className={`${SCHEDULE_CELL} text-slate-500 text-[11px]`}>پایه</td>
                        </tr>
                        {!readOnly &&
                          inlineDraft &&
                          inlineDraft.parentKind === 'schedule' &&
                          inlineDraft.parentId === n.taskId && (
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
                  const canEdit =
                    !readOnly &&
                    canEditWorkshopPackageRow(p.approvalStatus, p.origin ?? 'user_added')
                  const e = getEdit(p)
                  const indentPx = 8 + row.depth * 22

                  return (
                    <FragmentRows key={`p-${p.id}`}>
                      <tr
                        onClick={() =>
                          setSelected({ kind: 'package', id: p.id, name: p.name, pkg: p })
                        }
                        className={`cursor-pointer border-b border-slate-100 hover:bg-emerald-50/50 ${
                          isSel ? 'bg-emerald-50' : ''
                        }`}
                      >
                        <td className={`${SCHEDULE_CELL} font-mono text-[11px] tabular-nums text-emerald-800 text-center`}>
                          {row.wbs}
                        </td>
                        <td className={`${SCHEDULE_CELL} overflow-hidden`}>
                          <div
                            className="flex items-center gap-0.5 min-w-0"
                            style={{
                              paddingInlineStart: indentPx,
                              borderInlineStart: '2px solid rgb(167 243 208)',
                            }}
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
                            {!readOnly && (
                              <button
                                type="button"
                                title="افزودن زیرشاخه"
                                className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  startInlineCreate({
                                    kind: 'package',
                                    id: p.id,
                                    name: p.name,
                                    pkg: p,
                                  })
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canEdit ? (
                              <input
                                className="min-w-0 w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                                value={e.name}
                                onClick={(ev) => ev.stopPropagation()}
                                onChange={(ev) => setEditField(p.id, p, { name: ev.target.value })}
                                onBlur={() => {
                                  if (isDirty(p)) void savePackage(p)
                                }}
                              />
                            ) : (
                              <span className="truncate text-xs">{p.name}</span>
                            )}
                          </div>
                        </td>
                        <td className={`${SCHEDULE_CELL} text-[11px] text-slate-500 tabular-nums leading-tight`}>
                          {formatActivityDateShort(row.startDate, row.finishDate)}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          {canEdit ? (
                            <input
                              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
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
                        <td className={SCHEDULE_CELL}>
                          {canEdit ? (
                            <input
                              type="number"
                              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs tabular-nums"
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
                        <td className={SCHEDULE_CELL}>
                          {canEdit ? (
                            <select
                              className="w-full rounded border border-slate-200 bg-white px-0.5 py-0.5 text-xs"
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
                                      weightPercent: next.weightPercent.trim()
                                        ? Number(next.weightPercent)
                                        : null,
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
                        <td className={SCHEDULE_CELL}>
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs tabular-nums"
                              value={e.weightPercent}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) =>
                                setEditField(p.id, p, { weightPercent: ev.target.value })
                              }
                              onBlur={() => {
                                if (isDirty(p)) void savePackage(p)
                              }}
                              placeholder="وزن"
                            />
                          ) : (
                            <span className="tabular-nums text-xs">
                              {p.weightPercent != null ? p.weightPercent : '—'}
                            </span>
                          )}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          <span
                            className={`text-[10px] rounded-full px-1.5 py-0.5 ${approvalBadgeClass(p.approvalStatus)}`}
                          >
                            {approvalStatusFa(p.approvalStatus)}
                          </span>
                        </td>
                        <td className={`${SCHEDULE_CELL} text-[11px]`}>{statusFa(p.status)}</td>
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
  const canSave = draft.name.trim().length > 0 && Number(draft.quantity) > 0

  return (
    <tr className="bg-sky-50/80 border-b border-sky-100">
      <td className={`${SCHEDULE_CELL} font-mono text-[11px] tabular-nums text-sky-800 font-semibold text-center`}>
        {draft.previewWbs}
      </td>
      <td className={`${SCHEDULE_CELL} overflow-hidden`}>
        <div className="flex items-center gap-0.5 min-w-0" style={{ paddingInlineStart: 8 + draft.depth * 22 }}>
          <Plus className="h-3 w-3 text-sky-700 shrink-0" />
          <input
            autoFocus
            className="min-w-0 w-full rounded border border-sky-200 bg-white px-1 py-0.5 text-xs"
            placeholder="نام *"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
      </td>
      <td className={`${SCHEDULE_CELL} text-[11px] text-slate-400`}>—</td>
      <td className={SCHEDULE_CELL}>
        <input
          className="w-full rounded border border-sky-200 bg-white px-1 py-0.5 text-xs"
          placeholder="محل"
          value={draft.location}
          onChange={(e) => setDraft({ ...draft, location: e.target.value })}
        />
      </td>
      <td className={SCHEDULE_CELL}>
        <input
          type="number"
          className="w-full rounded border border-sky-200 bg-white px-1 py-0.5 text-xs"
          placeholder="مقدار *"
          value={draft.quantity}
          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
        />
      </td>
      <td className={SCHEDULE_CELL}>
        <select
          className="w-full rounded border border-sky-200 bg-white px-0.5 py-0.5 text-xs"
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
      <td className={SCHEDULE_CELL}>
        <input
          type="number"
          min={0}
          step={0.01}
          className="w-full rounded border border-sky-200 bg-white px-1 py-0.5 text-xs tabular-nums"
          placeholder="وزن"
          value={draft.weightPercent}
          onChange={(e) => setDraft({ ...draft, weightPercent: e.target.value })}
        />
      </td>
      <td className={SCHEDULE_CELL}>
        <div className="flex flex-wrap gap-1 items-center">
          <button
            type="button"
            disabled={saving || !canSave}
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
      <td className={SCHEDULE_CELL}>
        {!canSave && <span className="text-[10px] text-rose-700">نام و مقدار الزامی</span>}
      </td>
    </tr>
  )
}

function formatActivityDateShort(start: string | null, finish: string | null): string {
  if (!start && !finish) return '—'
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fa-IR', { month: '2-digit', day: '2-digit' })
  if (start && finish) return `${fmt(start)}–${fmt(finish)}`
  if (start) return fmt(start)
  return finish ? fmt(finish) : '—'
}

function formatActivityDate(start: string | null, finish: string | null): string {
  if (!start && !finish) return '—'
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  if (start && finish) return `${fmt(start)} – ${fmt(finish)}`
  if (start) return fmt(start)
  return finish ? fmt(finish) : '—'
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
