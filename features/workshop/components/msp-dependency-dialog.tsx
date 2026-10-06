'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ModalOverlay } from '@/features/supervisor/components/modal-overlay'
import {
formatPredecessorLabel,
parsePredecessorLinks,
type ParsedPredecessorLink,
} from '@/features/schedule/lib/predecessor-format'
import { displayActivityName } from '@/features/schedule/lib/wbs-utils'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import type { TaskRelationType } from '@/shared/types/schedule'
import { cn } from '@/shared/lib/utils'

export function collectMspActivities(nodes: ScheduleTreeNode[]): MspActivityOption[] {
  const out: MspActivityOption[] = []
  const walkPkgs = (pkgs: WorkshopPackageNode[]) => {
    for (const pkg of pkgs) {
      if (pkg.wbs?.trim()) {
        out.push({ wbs: pkg.wbs.trim(), name: pkg.name, kind: 'package', id: pkg.id })
      }
      if (pkg.children.length) walkPkgs(pkg.children)
    }
  }
  const walk = (list: ScheduleTreeNode[]) => {
    for (const node of list) {
      if (node.wbs?.trim()) {
        out.push({
          wbs: node.wbs.trim(),
          name: node.name,
          kind: 'task',
          id: node.taskId ?? node.id,
        })
      }
      walkPkgs(node.packages)
      if (node.children.length) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

export function collectMspSuccessors(
  activityWbs: string,
  items: Array<{ wbs: string; name: string; label: string }>
): MspSuccessorRow[] {
  const code = activityWbs.trim()
  if (!code) return []
  const rows: MspSuccessorRow[] = []
  for (const item of items) {
    if (!item.wbs || item.wbs === code) continue
    for (const link of parsePredecessorLinks(item.label)) {
      if (link.wbs === code) {
        rows.push({
          wbs: item.wbs,
          name: item.name,
          relation: link.relation,
          lagDays: link.lagDays,
        })
      }
    }
  }
  return rows
}

export type MspActivityOption = {
  wbs: string
  name: string
  kind: 'task' | 'package'
  id: string
}

export type MspSuccessorRow = {
  wbs: string
  name: string
  relation: TaskRelationType
  lagDays: number
}

const RELATION_OPTIONS: Array<{ value: TaskRelationType; label: string }> = [
  { value: 'FS', label: 'FS — پایان به شروع' },
  { value: 'SS', label: 'SS — شروع به شروع' },
  { value: 'FF', label: 'FF — پایان به پایان' },
  { value: 'SF', label: 'SF — شروع به پایان' },
]

type EditorRow = ParsedPredecessorLink & { key: string }

function activityOptionLabel(item: Pick<MspActivityOption, 'wbs' | 'name'>): string {
  const name = displayActivityName(item.name, item.wbs) || item.name || '—'
  return `${item.wbs}  —  ${name}`
}

function toEditorRows(label: string): EditorRow[] {
  return parsePredecessorLinks(label).map((link, index) => ({
    ...link,
    key: `${link.wbs}-${link.relation}-${index}`,
  }))
}

export function MspDependencyDialog({
  open,
  onClose,
  activityWbs,
  activityName,
  initialLabel,
  activities,
  successors,
  readOnly = false,
  saving = false,
  onSave,
}: {
  open: boolean
  onClose: () => void
  activityWbs: string
  activityName: string
  initialLabel: string
  activities: MspActivityOption[]
  successors: MspSuccessorRow[]
  readOnly?: boolean
  saving?: boolean
  onSave: (label: string) => void | Promise<void>
}) {
  const [tab, setTab] = useState<'predecessors' | 'successors'>('predecessors')
  const [rows, setRows] = useState<EditorRow[]>(() => toEditorRows(initialLabel))

  useEffect(() => {
    if (!open) return
    setTab('predecessors')
    setRows(toEditorRows(initialLabel))
  }, [open, initialLabel])

  const usedWbs = useMemo(() => new Set(rows.map((row) => row.wbs)), [rows])
  const pickerOptions = useMemo(
    () =>
      activities.filter(
        (item) =>
          item.wbs &&
          item.wbs !== activityWbs &&
          !usedWbs.has(item.wbs)
      ),
    [activities, activityWbs, usedWbs]
  )

  function addRow() {
    const first = pickerOptions[0]
    if (!first) return
    setRows((current) => [
      ...current,
      { key: `${first.wbs}-FS-${current.length}`, wbs: first.wbs, relation: 'FS', lagDays: 0 },
    ])
  }

  function patchRow(key: string, patch: Partial<ParsedPredecessorLink>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  async function handleSave() {
    const valid = rows.filter((row) => row.wbs.trim())
    await onSave(formatPredecessorLabel(valid))
  }

  const titleName = displayActivityName(activityName, activityWbs) || activityName

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title="اطلاعات فعالیت"
      className="sm:max-w-3xl bg-white"
    >
      <div className="space-y-3" dir="rtl">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-mono text-xs text-slate-500">{activityWbs || '—'}</span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="font-medium text-slate-900">{titleName}</span>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          <button
            type="button"
            className={cn(
              'rounded-t-md px-3 py-1.5 text-sm',
              tab === 'predecessors'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            )}
            onClick={() => setTab('predecessors')}
          >
            پیش‌نیازها
          </button>
          <button
            type="button"
            className={cn(
              'rounded-t-md px-3 py-1.5 text-sm',
              tab === 'successors'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            )}
            onClick={() => setTab('successors')}
          >
            پس‌نیازها
          </button>
        </div>

        {tab === 'predecessors' ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500">
              مثل Microsoft Project برای هر پیوند فعالیت، نوع FS / SS / FF / SF و تأخیر روزانه را مشخص کنید.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-2 py-2 text-center w-28">WBS</th>
                    <th className="px-2 py-2 text-right">نام فعالیت</th>
                    <th className="px-2 py-2 text-center w-44">نوع</th>
                    <th className="px-2 py-2 text-center w-24">تأخیر (روز)</th>
                    {!readOnly ? <th className="w-10" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={readOnly ? 4 : 5} className="px-3 py-6 text-center text-slate-400">
                        پیش‌نیازی تعریف نشده است.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const selected = activities.find((item) => item.wbs === row.wbs)
                      const currentOption: MspActivityOption = selected ?? {
                        wbs: row.wbs,
                        name: '',
                        kind: 'task',
                        id: row.wbs,
                      }
                      const options = [
                        currentOption,
                        ...pickerOptions.filter((item) => item.wbs !== currentOption.wbs),
                      ]
                      const chooseActivity = (wbs: string) => patchRow(row.key, { wbs })
                      return (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">
                            {readOnly ? (
                              <span className="block text-center font-mono">{row.wbs}</span>
                            ) : (
                              <select
                                className="w-full rounded border border-slate-200 bg-white px-1 py-1 font-mono"
                                value={row.wbs}
                                onChange={(event) => chooseActivity(event.target.value)}
                              >
                                {options.map((item) => (
                                  <option key={`wbs-${item.kind}-${item.id}`} value={item.wbs}>
                                    {activityOptionLabel(item)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {readOnly ? (
                              <span className="block text-slate-800">
                                {displayActivityName(currentOption.name, row.wbs) ||
                                  currentOption.name ||
                                  '—'}
                              </span>
                            ) : (
                              <select
                                className="w-full rounded border border-slate-200 bg-white px-1 py-1"
                                value={row.wbs}
                                onChange={(event) => chooseActivity(event.target.value)}
                              >
                                {options.map((item) => (
                                  <option key={`name-${item.kind}-${item.id}`} value={item.wbs}>
                                    {activityOptionLabel(item)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {readOnly ? (
                              <span className="block text-center font-mono">{row.relation}</span>
                            ) : (
                              <select
                                className="w-full rounded border border-slate-200 bg-white px-1 py-1"
                                value={row.relation}
                                onChange={(event) =>
                                  patchRow(row.key, {
                                    relation: event.target.value as TaskRelationType,
                                  })
                                }
                              >
                                {RELATION_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {readOnly ? (
                              <span className="block text-center tabular-nums">{row.lagDays}</span>
                            ) : (
                              <input
                                type="number"
                                step={1}
                                className="w-full rounded border border-slate-200 px-1 py-1 text-center tabular-nums"
                                value={row.lagDays}
                                onChange={(event) =>
                                  patchRow(row.key, {
                                    lagDays: Number(event.target.value) || 0,
                                  })
                                }
                              />
                            )}
                          </td>
                          {!readOnly ? (
                            <td className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                className="rounded p-1 text-rose-700 hover:bg-rose-50"
                                title="حذف پیوند"
                                onClick={() => removeRow(row.key)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!readOnly ? (
              <button
                type="button"
                disabled={pickerOptions.length === 0}
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                افزودن پیش‌نیاز
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2 py-2 text-center w-24">WBS</th>
                  <th className="px-2 py-2 text-right">نام فعالیت</th>
                  <th className="px-2 py-2 text-center w-28">نوع</th>
                  <th className="px-2 py-2 text-center w-24">تأخیر (روز)</th>
                </tr>
              </thead>
              <tbody>
                {successors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      پس‌نیازی به این فعالیت وصل نیست.
                    </td>
                  </tr>
                ) : (
                  successors.map((row) => (
                    <tr key={`${row.wbs}-${row.relation}`} className="border-t border-slate-100">
                      <td className="px-2 py-2 text-center font-mono">{row.wbs}</td>
                      <td className="px-2 py-2">
                        {displayActivityName(row.name, row.wbs) || row.name}
                      </td>
                      <td className="px-2 py-2 text-center font-mono">{row.relation}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{row.lagDays}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            انصراف
          </button>
          {!readOnly ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {saving ? 'در حال ذخیره…' : 'تأیید'}
            </button>
          ) : null}
        </div>
      </div>
    </ModalOverlay>
  )
}
