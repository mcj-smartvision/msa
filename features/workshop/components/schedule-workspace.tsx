'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
ChevronDown,
ChevronLeft,
Plus,
ClipboardList,
Save,
HelpCircle,
AlertCircle,
Pencil,
Loader2,
} from 'lucide-react'
import { canEditWorkshopPackageRow } from '@/features/workshop/lib/approvals'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import {
collectScheduleTaskNodes,
defaultScheduleExpanded,
enrichScheduleTreeWithWbs,
findPackageInTree,
findPackagePath,
findScheduleNode,
flattenWorkshopSchedule,
nextChildWbs,
scheduleExpandableIds,
} from '@/features/workshop/lib/wbs-numbering'
import { PageHeader } from '@/features/admin/components/shared'
import { ScheduleDownloadButton } from '@/features/schedule/components/schedule-download-button'
import { UomSelect } from '@/features/workshop/components/uom-display'
import { formatScheduleWeightDisplay } from '@/features/workshop/lib/package-weight'
import { displayActivityName, wbsDepth } from '@/features/schedule/lib/wbs-utils'
import {
collectMspActivities,
collectMspSuccessors,
MspDependencyDialog,
} from '@/features/workshop/components/msp-dependency-dialog'
import { collectDateEnvelope } from '@/features/workshop/lib/header-rules'
import {
applyParentWeightSum,
isDescendantWbs,
} from '@/features/schedule/lib/parent-weight-rollup'
import {
applyParentUnitPriceSum,
quantityTimesUnitPrice,
} from '@/features/schedule/lib/parent-unit-price-rollup'
import { applyWeightedParentRollup, formatProgressRollupFormula } from '@/features/schedule/lib/parent-progress-rollup'
import {
formatScheduleDate,
isoToCalendarInput,
parseScheduleDateInput,
toIsoDateOnly,
} from '@/features/schedule/lib/dates'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { cn } from '@/shared/lib/utils'
import {
clearScheduleFieldDrafts,
publishScheduleFieldDrafts,
publishScheduleViewSync,
readScheduleFieldDrafts,
useScheduleViewSync,
} from '@/features/schedule/lib/schedule-view-sync'
import type { ProjectTask } from '@/shared/types/schedule'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import { type DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import {
mergeSupervisorProgressEntries,
resolvePhysicalProgressPercent,
schedulePhysicalPercent,
} from '@/features/schedule/lib/physical-progress'

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
  quantityCertainty: 'حدودی' | 'قطعی'
  unitPrice: string
  uom: string
  location: string
  crew: string
  weightPercent: string
  subcontractorId: string
  inheritedSubcontractorId: string | null
  scheduleFields: Record<string, unknown>
  startDate: string
  finishDate: string
  totalFloat: string
  predecessorLabel: string
}

type EditDraft = {
  name: string
  quantity: string
  quantityCertainty: 'حدودی' | 'قطعی'
  unitPrice: string
  uom: string
  location: string
  crew: string
  weightPercent: string
  startDate: string
  finishDate: string
  predecessorLabel: string
  totalFloat: string
}

const SCHEDULE_COL_WIDTHS = [
  '52px',
  '220px',
  '105px',
  '170px',
  '64px',
  '85px',
  '148px',
  '78px',
  '100px',
  '92px',
  '72px',
  '72px',
] as const
// WBS, نام, پیش‌نیاز, تاریخ, شناوری, محل, مقدار, واحد, کارکرد, قیمت واحد, وزن, وضعیت

const SCHEDULE_COL_COUNT = SCHEDULE_COL_WIDTHS.length
const SCHEDULE_BASE_WIDTH = 1258
const EXTRA_SCHEDULE_COL_WIDTH = 112
/** Sticky identity cols (RTL): pin WBS + نام to the right while scrolling left. */
const STICKY_WBS_RIGHT = 0
const STICKY_NAME_RIGHT = Number.parseInt(SCHEDULE_COL_WIDTHS[0], 10) || 52
/** Solid left edge + soft shadow so نام stays separated while scrolling under it. */
const STICKY_NAME_EDGE_SHADOW =
  '-1px 0 0 0 rgb(148, 163, 184), -8px 0 12px -6px rgba(15, 23, 42, 0.22)'
const SCHEDULE_CELL =
  'px-1 py-1.5 align-middle box-border border-l-2 border-slate-300 text-center'
const SCHEDULE_HEAD =
  `${SCHEDULE_CELL} sticky top-0 z-20 font-semibold text-slate-800 bg-slate-200`
const SCHEDULE_STICKY_WBS_HEAD =
  `${SCHEDULE_CELL} sticky top-0 z-30 font-semibold text-slate-800 bg-slate-200`
const SCHEDULE_STICKY_NAME_HEAD =
  `${SCHEDULE_CELL} sticky top-0 z-30 font-semibold text-slate-800 bg-slate-200 border-l-2 border-slate-500`
const SCHEDULE_STICKY_WBS_CELL = `${SCHEDULE_CELL} sticky z-10`
const SCHEDULE_STICKY_NAME_CELL =
  `${SCHEDULE_CELL} sticky z-10 border-l-2 border-slate-500`
const TOTAL_PRICE_HELP =
  'از ضرب مقدار در قیمت واحد همان ردیف به‌دست می‌آید. سرشاخه‌ای که زیرشاخه دارد کارکرد ندارد.'

function isScheduleHeader(node: ScheduleTreeNode, expandableIds?: Set<string>): boolean {
  if (expandableIds?.has(node.id)) return true
  return Boolean(node.isSyntheticGroup) || node.packages.length > 0 || node.children.length > 0
}

function envelopeForPackage(pkg: WorkshopPackageNode): {
  start: string | null
  finish: string | null
} {
  const starts: Array<string | null | undefined> = []
  const finishes: Array<string | null | undefined> = []
  const walk = (node: WorkshopPackageNode) => {
    starts.push(node.startDate)
    finishes.push(node.finishDate)
    node.children.forEach(walk)
  }
  pkg.children.forEach(walk)
  if (starts.some(Boolean) || finishes.some(Boolean)) {
    return collectDateEnvelope(starts, finishes)
  }
  return { start: pkg.startDate, finish: pkg.finishDate }
}

function envelopeForScheduleNode(node: ScheduleTreeNode): {
  start: string | null
  finish: string | null
} {
  const starts: Array<string | null | undefined> = []
  const finishes: Array<string | null | undefined> = []
  const walkPkg = (pkg: WorkshopPackageNode) => {
    starts.push(pkg.startDate)
    finishes.push(pkg.finishDate)
    pkg.children.forEach(walkPkg)
  }
  node.packages.forEach(walkPkg)
  for (const child of node.children) {
    const inner = envelopeForScheduleNode(child)
    starts.push(inner.start)
    finishes.push(inner.finish)
  }
  if (starts.some(Boolean) || finishes.some(Boolean)) {
    return collectDateEnvelope(starts, finishes)
  }
  return { start: node.startDate, finish: node.finishDate }
}

type ExtraTaskField = {
  key: string
  label: string
  property?: keyof ProjectTask
  type?: 'text' | 'number' | 'date' | 'boolean' | 'contractor'
}

const EXTRA_TASK_FIELDS: ExtraTaskField[] = [
  { key: 'contractor', label: 'پیمانکار', type: 'contractor' },
  { key: 'duration_days', label: 'مدت', property: 'duration_days' },
  /** Read-only — filled daily from site-supervisor reports (physical %). */
  { key: 'percent_complete', label: '٪ پیشرفت فیزیکی', property: 'percent_complete' },
  { key: 'free_float_days', label: 'شناوری آزاد', property: 'free_float_days' },
  { key: 'is_critical', label: 'بحرانی', property: 'is_critical' },
  { key: 'is_milestone', label: 'مایلستون', property: 'is_milestone' },
  { key: 'remaining_duration_days', label: 'مدت باقی', property: 'remaining_duration_days' },
  { key: 'external_id', label: 'شناسه خارجی', property: 'external_id' },
  { key: 'msp_uid', label: 'UID', property: 'msp_uid' },
  { key: 'outline_number', label: 'Outline', property: 'outline_number' },
  { key: 'outline_level', label: 'سطح', property: 'outline_level' },
  { key: 'obs_code', label: 'OBS', property: 'obs_code', type: 'text' },
  { key: 'cbs_code', label: 'CBS', property: 'cbs_code', type: 'text' },
  { key: 'constraint_type', label: 'نوع قید', property: 'constraint_type', type: 'text' },
  { key: 'constraint_date', label: 'تاریخ قید', property: 'constraint_date', type: 'date' },
  { key: 'deadline', label: 'مهلت', property: 'deadline', type: 'date' },
  { key: 'baseline_start', label: 'شروع خط مبنا', property: 'baseline_start', type: 'date' },
  { key: 'baseline_finish', label: 'پایان خط مبنا', property: 'baseline_finish', type: 'date' },
  { key: 'baseline_duration_days', label: 'مدت خط مبنا', property: 'baseline_duration_days' },
  { key: 'baseline_cost', label: 'هزینه خط مبنا', property: 'baseline_cost', type: 'number' },
  { key: 'baseline_work_hours', label: 'کار خط مبنا', property: 'baseline_work_hours', type: 'number' },
  { key: 'actual_start', label: 'شروع واقعی', property: 'actual_start', type: 'date' },
  { key: 'actual_finish', label: 'پایان واقعی', property: 'actual_finish', type: 'date' },
  { key: 'work_hours', label: 'ساعت کار', property: 'work_hours', type: 'number' },
  { key: 'cost', label: 'هزینه', property: 'cost', type: 'number' },
  { key: 'notes', label: 'یادداشت', property: 'notes', type: 'text' },
  { key: 'flag', label: 'پرچم', property: 'flag', type: 'boolean' },
  { key: 'priority', label: 'اولویت', property: 'priority', type: 'number' },
  { key: 'is_manual_scheduled', label: 'دستی', property: 'is_manual_scheduled', type: 'boolean' },
  { key: 'has_split', label: 'شکاف', property: 'has_split' },
  { key: 'is_recurring_master', label: 'تکرارشونده', property: 'is_recurring_master' },
]

function extraTaskValue(field: ExtraTaskField, task: ProjectTask): unknown {
  if (field.key === 'contractor') return task.subcontractor_id
  if (field.key === 'percent_complete') return schedulePhysicalPercent(task)
  return field.property ? task[field.property] : null
}

function taskUomValue(task: ProjectTask): string {
  const trimmed = String(task.uom ?? task.schedule_uom ?? '').trim()
  return trimmed || 'm2'
}

function scheduleGroupKey(wbs: string | null | undefined): string {
  return wbs?.trim().split('.')[0] ?? ''
}

function seedCommercialInputs(nodes: ScheduleTreeNode[]): Record<
  string,
  { quantity: string; unitPrice: string }
> {
  const out: Record<string, { quantity: string; unitPrice: string }> = {}
  const walkPackages = (pkgs: WorkshopPackageNode[]) => {
    for (const pkg of pkgs) {
      out[pkg.id] = {
        quantity: Number(pkg.quantity) > 0 ? String(pkg.quantity) : '',
        unitPrice: String(Number(pkg.unitPrice) || 0),
      }
      if (pkg.children.length) walkPackages(pkg.children)
    }
  }
  const walk = (list: ScheduleTreeNode[]) => {
    for (const n of list) {
      if (n.taskId && n.task) {
        const qty = n.task.quantity ?? n.task.schedule_quantity
        out[n.taskId] = {
          quantity: qty != null && Number(qty) > 0 ? String(qty) : '',
          unitPrice: String(Number(n.task.unit_price ?? 0) || 0),
        }
      }
      walkPackages(n.packages)
      if (n.children.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function parseCommercialNumber(raw: string | undefined): number | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export function ScheduleWorkspace({ showBanner = true }: { showBanner?: boolean }) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const forceSupervisorView = searchParams.get('as') === 'supervisor'
  const { calendar, setCalendar } = useScheduleCalendar()
  useEffect(() => {
    setCalendar('jalali')
  }, [setCalendar])
  const [nodes, setNodes] = useState<ScheduleTreeNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Selection>(null)
  const [inlineDraft, setInlineDraft] = useState<InlineDraft | null>(null)
  const [edits, setEdits] = useState<Record<string, EditDraft>>({})
  /** Package id currently in row-edit mode (inputs visible after «ویرایش»). */
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readOnly, setReadOnly] = useState(forceSupervisorView)
  const [canWriteServer, setCanWriteServer] = useState(false)
  /** Pending date/float/weight edits — flushed by «به‌روزرسانی» */
  const [taskDrafts, setTaskDrafts] = useState<
    Record<
      string,
      {
        startDate?: string
        finishDate?: string
        totalFloat?: number | null
        scheduleWeight?: number | null
        predecessorLabel?: string
      }
    >
  >({})
  const [dependencyLinkCount, setDependencyLinkCount] = useState(0)
  const [tasksWithPredecessors, setTasksWithPredecessors] = useState(0)
  const [helpWeightParentId, setHelpWeightParentId] = useState<string | null>(null)
  const [helpProgressParentId, setHelpProgressParentId] = useState<string | null>(null)
  const [predDialog, setPredDialog] = useState<{
    kind: 'task' | 'package' | 'draft'
    id: string
    wbs: string
    name: string
    label: string
  } | null>(null)
  const [predDialogSaving, setPredDialogSaving] = useState(false)
  /** Controlled مقدار / قیمت واحد — single source of truth for قیمت کل. */
  const [commercialInputs, setCommercialInputs] = useState<
    Record<string, { quantity: string; unitPrice: string }>
  >({})
  const [contractors, setContractors] = useState<Array<{ id: string; name: string }>>([])
  const [savingExtraCell, setSavingExtraCell] = useState<string | null>(null)
  const [dailyProgressEntries, setDailyProgressEntries] = useState<DailyProgressEntry[]>([])
  const [savedProgressEntries, setSavedProgressEntries] = useState<DailyProgressEntry[]>([])
  const supervisorProgressEntries = useMemo(
    () => mergeSupervisorProgressEntries(savedProgressEntries, dailyProgressEntries),
    [savedProgressEntries, dailyProgressEntries]
  )
  const scheduleTableScrollRef = useRef<HTMLDivElement>(null)
  const topHScrollRef = useRef<HTMLDivElement>(null)
  const bottomHScrollRef = useRef<HTMLDivElement>(null)
  const hScrollSyncLock = useRef(false)
  const [tableScrollWidth, setTableScrollWidth] = useState(0)

  const syncHorizontalScroll = useCallback((source: 'top' | 'main' | 'bottom') => {
    if (hScrollSyncLock.current) return
    const top = topHScrollRef.current
    const main = scheduleTableScrollRef.current
    const bottom = bottomHScrollRef.current
    if (!main) return
    const left =
      source === 'top'
        ? (top?.scrollLeft ?? main.scrollLeft)
        : source === 'bottom'
          ? (bottom?.scrollLeft ?? main.scrollLeft)
          : main.scrollLeft
    hScrollSyncLock.current = true
    if (top && source !== 'top') top.scrollLeft = left
    if (bottom && source !== 'bottom') bottom.scrollLeft = left
    if (source !== 'main') main.scrollLeft = left
    requestAnimationFrame(() => {
      hScrollSyncLock.current = false
    })
  }, [])

  const scheduleTaskFlat = useMemo(() => {
    // Include summary/header rows (is_summary) — parent weight = sum of children
    const out: ScheduleTreeNode[] = []
    const walk = (list: ScheduleTreeNode[]) => {
      for (const n of list) {
        if (n.taskId) out.push(n)
        if (n.children.length) walk(n.children)
      }
    }
    walk(nodes)
    return out
  }, [nodes])

  const weightRollup = useMemo(() => {
    const rollNodes = scheduleTaskFlat.map((n) => {
      const id = n.taskId!
      const drafted = taskDrafts[id]?.scheduleWeight
      return {
        id,
        wbs: n.wbs,
        name: n.name,
        // For parents, ignore stored/draft weight as input — children drive the sum.
        // Drafts on leaves (and manual parent overrides) are applied below in display.
        weight:
          drafted !== undefined ? drafted ?? null : n.scheduleWeight ?? null,
      }
    })
    return applyParentWeightSum(rollNodes)
  }, [scheduleTaskFlat, taskDrafts])

  /** Parent physical % = Σ(childWeight × child%) / Σ(childWeight). */
  const progressRollup = useMemo(() => {
    const rollNodes = scheduleTaskFlat.map((n) => {
      const id = n.taskId!
      const drafted = taskDrafts[id]?.scheduleWeight
      const isWeightParent = weightRollup.parentIds.has(id)
      const rolledW = weightRollup.weights[id]
      let weight: number | null = null
      if (isWeightParent) {
        weight =
          rolledW != null && Number.isFinite(Number(rolledW)) ? Number(rolledW) : null
      } else if (drafted !== undefined) {
        weight = drafted
      } else if (n.scheduleWeight != null && Number.isFinite(Number(n.scheduleWeight))) {
        weight = Number(n.scheduleWeight)
      }
      const percent =
        resolvePhysicalProgressPercent(
          id,
          n.task ? schedulePhysicalPercent(n.task) : null,
          supervisorProgressEntries
        ) ?? 0
      return {
        id,
        wbs: n.wbs,
        name: n.name,
        weight,
        percent,
      }
    })
    return applyWeightedParentRollup(rollNodes)
  }, [scheduleTaskFlat, taskDrafts, weightRollup, supervisorProgressEntries])

  /** Parent/header unit price = Σ(مقدار × قیمت واحد) of direct children (tasks + packages). */
  const unitPriceRollup = useMemo(() => {
    const rollNodes: Array<{
      id: string
      wbs: string | null
      name: string
      amount: number
    }> = []
    const qtyOf = (id: string, stored: number | null | undefined) => {
      const live = commercialInputs[id]
      if (live) return parseCommercialNumber(live.quantity)
      if (stored == null || !Number.isFinite(Number(stored))) return null
      return Number(stored)
    }
    const priceOf = (id: string, stored: number | null | undefined) => {
      const live = commercialInputs[id]
      if (live) return parseCommercialNumber(live.unitPrice)
      if (stored == null || !Number.isFinite(Number(stored))) return null
      return Number(stored)
    }
    const walkPackages = (pkgs: WorkshopPackageNode[]) => {
      for (const pkg of pkgs) {
        const edit = edits[pkg.id]
        const quantity = qtyOf(pkg.id, edit ? Number(edit.quantity) : pkg.quantity)
        const unitPrice = priceOf(pkg.id, edit ? Number(edit.unitPrice) : pkg.unitPrice)
        rollNodes.push({
          id: pkg.id,
          wbs: pkg.wbs,
          name: pkg.name,
          amount: quantityTimesUnitPrice(quantity, unitPrice),
        })
        if (pkg.children.length) walkPackages(pkg.children)
      }
    }
    for (const n of scheduleTaskFlat) {
      walkPackages(n.packages)
      rollNodes.push({
        id: n.taskId!,
        wbs: n.wbs,
        name: n.name,
        amount: quantityTimesUnitPrice(
          qtyOf(n.taskId!, n.task?.quantity ?? n.task?.schedule_quantity ?? null),
          priceOf(n.taskId!, n.task?.unit_price)
        ),
      })
    }
    return applyParentUnitPriceSum(rollNodes)
  }, [scheduleTaskFlat, edits, commercialInputs])

  function setCommercialField(
    id: string,
    field: 'quantity' | 'unitPrice',
    value: string,
    fallback?: { quantity?: string; unitPrice?: string }
  ) {
    setCommercialInputs((prev) => {
      const current = prev[id] ?? {
        quantity: fallback?.quantity ?? '',
        unitPrice: fallback?.unitPrice ?? '0',
      }
      return {
        ...prev,
        [id]: { ...current, [field]: value },
      }
    })
  }

  function displayUnitPrice(
    entityId: string,
    stored: number | null | undefined
  ): { value: number; isParent: boolean; help: string | null } {
    const isParent = unitPriceRollup.parentIds.has(entityId)
    const rolled = unitPriceRollup.amounts[entityId]
    if (isParent) {
      return {
        value: Number(rolled ?? 0) || 0,
        isParent: true,
        help: unitPriceRollup.explanations.get(entityId)?.text ?? null,
      }
    }
    const live = commercialInputs[entityId]
    if (live) {
      return {
        value: parseCommercialNumber(live.unitPrice) ?? 0,
        isParent: false,
        help: null,
      }
    }
    return {
      value: Number(stored ?? 0) || 0,
      isParent: false,
      help: null,
    }
  }

  function displayTotalPrice(
    entityId: string,
    quantity: number | null | undefined,
    unitPrice: number | null | undefined
  ): { value: number; isParent: boolean; help: string } {
    const isParent = unitPriceRollup.parentIds.has(entityId)
    if (isParent) {
      return {
        value: Number(unitPriceRollup.amounts[entityId] ?? 0) || 0,
        isParent: true,
        help:
          unitPriceRollup.explanations.get(entityId)?.text ??
          'جمع قیمت کل زیرشاخه‌ها (مقدار × قیمت واحد هر زیرشاخه)',
      }
    }
    const live = commercialInputs[entityId]
    const qty = live ? parseCommercialNumber(live.quantity) : quantity
    const price = live ? parseCommercialNumber(live.unitPrice) : unitPrice
    return {
      value: quantityTimesUnitPrice(qty, price),
      isParent: false,
      help: 'مقدار × قیمت واحد',
    }
  }

  const visibleExtraTaskFields = useMemo(
    () =>
      EXTRA_TASK_FIELDS.filter(
        (field) =>
          field.key === 'contractor' ||
          field.key === 'percent_complete' ||
          scheduleTaskFlat.some((node) => {
            if (!node.task) return false
            const value = extraTaskValue(field, node.task)
            return value !== null && value !== undefined && value !== '' && value !== false
          })
      ),
    [scheduleTaskFlat]
  )

  useEffect(() => {
    const main = scheduleTableScrollRef.current
    if (!main) return
    const measure = () => {
      setTableScrollWidth(main.scrollWidth)
      syncHorizontalScroll('main')
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(main)
    const table = main.querySelector('table')
    if (table) ro.observe(table)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [syncHorizontalScroll, nodes, visibleExtraTaskFields.length])

  const scheduleColCount = SCHEDULE_COL_COUNT + visibleExtraTaskFields.length

  function displayScheduleWeight(taskId: string, stored: number | null | undefined): number | null {
    const isParent = weightRollup.parentIds.has(taskId)
    const drafted = taskDrafts[taskId]?.scheduleWeight
    const rolledRaw = weightRollup.weights[taskId]
    const rolled =
      rolledRaw == null || !Number.isFinite(Number(rolledRaw)) ? null : Number(rolledRaw)

    if (isParent) {
      // Live sum of children by default — no need for ثبت نهایی / بروزرسانی
      // Keep a manual parent typed value only while it differs from the live sum
      if (
        drafted !== undefined &&
        drafted != null &&
        rolled != null &&
        Number(drafted) !== rolled
      ) {
        return Number(drafted)
      }
      if (rolled != null) return rolled
      if (drafted !== undefined) return drafted ?? null
      return stored == null || !Number.isFinite(Number(stored)) ? null : Number(stored)
    }

    if (drafted !== undefined) return drafted ?? null
    return stored == null || !Number.isFinite(Number(stored)) ? null : Number(stored)
  }

  function setScheduleWeight(taskId: string, next: number | null) {
    setTaskDrafts((prev) => {
      const merged: typeof prev = {
        ...prev,
        [taskId]: { ...prev[taskId], scheduleWeight: next },
      }

      const edited = scheduleTaskFlat.find((n) => n.taskId === taskId)
      if (!edited?.wbs) return merged

      const rollNodes = scheduleTaskFlat.map((n) => {
        const id = n.taskId!
        const drafted = merged[id]?.scheduleWeight
        return {
          id,
          wbs: n.wbs,
          name: n.name,
          weight:
            drafted !== undefined ? drafted ?? null : n.scheduleWeight ?? null,
        }
      })
      const rolled = applyParentWeightSum(rollNodes)

      // Manual edit on a parent/header — keep as typed; do not overwrite from children
      if (rolled.parentIds.has(taskId)) {
        return merged
      }

      // Child (or leaf) edit → push live sums onto every ancestor header
      for (const n of scheduleTaskFlat) {
        const id = n.taskId!
        if (!rolled.parentIds.has(id) || !n.wbs) continue
        if (!isDescendantWbs(n.wbs, edited.wbs)) continue
        merged[id] = {
          ...merged[id],
          scheduleWeight: rolled.weights[id] ?? 0,
        }
      }
      return merged
    })
  }

  /** Root-level weights (headers + leaf activities without a parent) must sum to 100. */
  const projectWeightCheck = useMemo(() => {
    const contributorIds = new Set<string>()
    let sum = 0
    for (const n of scheduleTaskFlat) {
      if (!n.taskId || wbsDepth(n.wbs) !== 0) continue
      contributorIds.add(n.taskId)
      const drafted = taskDrafts[n.taskId]?.scheduleWeight
      const rolledRaw = weightRollup.weights[n.taskId]
      const rolled =
        rolledRaw == null || !Number.isFinite(Number(rolledRaw))
          ? null
          : Number(rolledRaw)
      const isParent = weightRollup.parentIds.has(n.taskId)
      let w: number | null = null
      if (isParent) {
        if (
          drafted !== undefined &&
          drafted != null &&
          rolled != null &&
          Number(drafted) !== rolled
        ) {
          w = Number(drafted)
        } else if (rolled != null) {
          w = rolled
        } else if (drafted !== undefined) {
          w = drafted
        } else if (n.scheduleWeight != null && Number.isFinite(Number(n.scheduleWeight))) {
          w = Number(n.scheduleWeight)
        }
      } else if (drafted !== undefined) {
        w = drafted
      } else if (n.scheduleWeight != null && Number.isFinite(Number(n.scheduleWeight))) {
        w = Number(n.scheduleWeight)
      }
      if (w != null && w > 0) sum += w
    }
    sum = Math.round(sum * 100) / 100
    const ok = contributorIds.size === 0 || Math.abs(sum - 100) < 0.05
    return { sum, ok, contributorIds, gap: Math.round((100 - sum) * 100) / 100 }
  }, [scheduleTaskFlat, taskDrafts, weightRollup])
  const load = useCallback(async (expandAfter?: { kind: 'schedule' | 'package'; id: string }) => {
    if (!projectId) return []
    setLoading(true)
    try {
      const [treeRes, capRes, contractorRes] = await Promise.all([
        fetch(`/api/workshop/schedule-tree?projectId=${projectId}`, { cache: 'no-store' }),
        fetch(`/api/workshop/capabilities?projectId=${projectId}`, { cache: 'no-store' }),
        fetch(`/api/schedule/contractors?projectId=${projectId}`, { cache: 'no-store' }),
      ])
      const data = await treeRes.json()
      const caps = capRes.ok ? await capRes.json() : data.capabilities
      const contractorAssignmentByTask = new Map<
        string,
        { subcontractor_id: string | null; resolved_subcontractor_id: string | null }
      >()
      if (contractorRes.ok) {
        const contractorData = await contractorRes.json()
        setContractors(contractorData.contractors ?? [])
        for (const assignment of contractorData.assignments ?? []) {
          contractorAssignmentByTask.set(String(assignment.id), {
            subcontractor_id: assignment.subcontractor_id ?? null,
            resolved_subcontractor_id: assignment.resolved_subcontractor_id ?? null,
          })
        }
      }
      if (!treeRes.ok) throw new Error(data.error || 'خطا در بارگذاری')
      const loadedNodes = enrichScheduleTreeWithWbs(data.nodes ?? [])
      const applyContractorAssignments = (items: ScheduleTreeNode[]) => {
        for (const node of items) {
          if (node.task) {
            const assignment = contractorAssignmentByTask.get(node.task.id)
            if (assignment) node.task = { ...node.task, ...assignment }
          }
          if (node.children.length) applyContractorAssignments(node.children)
        }
      }
      applyContractorAssignments(loadedNodes)
      setNodes(loadedNodes)
      setCommercialInputs(seedCommercialInputs(loadedNodes))
      setDependencyLinkCount(Number(data.dependencyLinkCount) || 0)
      setTasksWithPredecessors(Number(data.tasksWithPredecessors) || 0)
      const serverReadOnly = Boolean(caps?.readOnly ?? data.capabilities?.readOnly)
      setCanWriteServer(Boolean(caps?.canWrite))
      setReadOnly(forceSupervisorView || serverReadOnly)
      const exp = defaultScheduleExpanded(loadedNodes)
      if (expandAfter?.kind === 'package') {
        exp[`pkg:${expandAfter.id}`] = true
      }
      if (expandAfter?.kind === 'schedule') {
        const parentNode = findScheduleNode(loadedNodes, expandAfter.id)
        if (parentNode) exp[parentNode.id] = true
      }
      setExpanded((prev) => ({ ...exp, ...prev }))
      setSelected((prev) => {
        if (!prev || prev.kind !== 'package') return prev
        const found = findPackageInTree(loadedNodes, prev.id)
        return found ? { kind: 'package', id: found.id, name: found.name, pkg: found } : null
      })
      if (expandAfter) {
        setEdits({})
        setInlineDraft(null)
        setEditingPackageId(null)
      }
      setHelpWeightParentId(null)
      setHelpProgressParentId(null)
      return loadedNodes
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطا')
      return []
    } finally {
      setLoading(false)
    }
  }, [projectId, forceSupervisorView])

  const workshopTab = searchParams.get('workshopTab') ?? 'schedule'
  const scheduleTabActive = workshopTab === 'schedule'

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!projectId) {
      setDailyProgressEntries([])
      return
    }
    const refreshDaily = () => {
      setDailyProgressEntries(readProjectDailyProgress(projectId).entries)
    }
    refreshDaily()
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail
      if (detail?.projectId && detail.projectId !== projectId) return
      refreshDaily()
      void load()
    }
    window.addEventListener('sitepilot-daily-progress-updated', onUpdated)
    window.addEventListener('storage', refreshDaily)
    return () => {
      window.removeEventListener('sitepilot-daily-progress-updated', onUpdated)
      window.removeEventListener('storage', refreshDaily)
    }
  }, [projectId, load])

  useEffect(() => {
    if (!projectId) {
      setSavedProgressEntries([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/supervisor/daily-progress?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (!res.ok || cancelled) return
        const updates = Array.isArray(data.updates) ? data.updates : []
        setSavedProgressEntries(
          updates.map((row: Record<string, unknown>) => ({
            activityId: String(row.task_id ?? ''),
            reportDate: String(row.progress_date ?? '').slice(0, 10),
            percentComplete: Number(row.percent_complete) || 0,
          }))
        )
      } catch {
        /* stored schedule percent still applies */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  useScheduleViewSync(
    projectId,
    () => {
      void load()
    },
    { active: scheduleTabActive }
  )

  // Push live drafts to ارسال برنامه so switching tabs needs no hard refresh
  useEffect(() => {
    if (!projectId || readOnly) return
    const byTaskId: Record<
      string,
      {
        startDate?: string
        finishDate?: string
        totalFloat?: number | null
        scheduleWeight?: number | null
        quantity?: number | null
        unitPrice?: number | null
        uom?: string | null
        quantityCertainty?: 'حدودی' | 'قطعی'
      }
    > = {}

    for (const [id, patch] of Object.entries(taskDrafts)) {
      byTaskId[id] = { ...patch }
    }

    // Include rolled parent weights so send-preview matches edit UI
    for (const n of scheduleTaskFlat) {
      const id = n.taskId!
      if (!weightRollup.parentIds.has(id)) continue
      const shown = displayScheduleWeight(id, n.scheduleWeight)
      byTaskId[id] = {
        ...byTaskId[id],
        scheduleWeight: shown,
      }
    }

    // Live مقدار / قیمت واحد only when they differ from saved (avoid zeroing SEND)
    for (const n of scheduleTaskFlat) {
      if (!n.taskId || !n.task) continue
      const live = commercialInputs[n.taskId]
      if (!live) continue
      const quantity = parseCommercialNumber(live.quantity)
      const unitPrice = parseCommercialNumber(live.unitPrice)
      const storedQty =
        n.task.quantity != null && Number.isFinite(Number(n.task.quantity))
          ? Number(n.task.quantity)
          : n.task.schedule_quantity != null && Number.isFinite(Number(n.task.schedule_quantity))
            ? Number(n.task.schedule_quantity)
            : null
      const storedPrice =
        n.task.unit_price != null && Number.isFinite(Number(n.task.unit_price))
          ? Number(n.task.unit_price)
          : null
      const qtyChanged = (quantity ?? null) !== storedQty
      const priceChanged = (unitPrice ?? null) !== storedPrice
      if (!qtyChanged && !priceChanged) continue
      byTaskId[n.taskId] = {
        ...byTaskId[n.taskId],
        ...(qtyChanged ? { quantity } : {}),
        ...(priceChanged ? { unitPrice } : {}),
        uom: n.task.uom ?? n.task.schedule_uom ?? undefined,
        quantityCertainty: n.task.quantity_certainty,
      }
    }

    // Package row live values (ارسال shows packages as rows with package ids)
    const walkPackages = (pkgs: WorkshopPackageNode[]) => {
      for (const pkg of pkgs) {
        const edit = edits[pkg.id]
        const live = commercialInputs[pkg.id]
        const quantity = live
          ? parseCommercialNumber(live.quantity)
          : edit
            ? Number(edit.quantity)
            : null
        const unitPrice = live
          ? parseCommercialNumber(live.unitPrice)
          : edit
            ? Number(edit.unitPrice)
            : null
        const storedQty = Number(pkg.quantity)
        const storedPrice = Number(pkg.unitPrice) || 0
        const qtyChanged =
          quantity != null && Number.isFinite(quantity) && quantity !== storedQty
        const priceChanged =
          unitPrice != null && Number.isFinite(unitPrice) && unitPrice !== storedPrice
        const uomChanged = Boolean(edit && edit.uom !== pkg.uom)
        const certaintyChanged = Boolean(
          edit && edit.quantityCertainty !== pkg.quantityCertainty
        )
        const datesChanged = Boolean(
          edit &&
            ((edit.startDate.trim() || null) !== (pkg.startDate ?? null) ||
              (edit.finishDate.trim() || null) !== (pkg.finishDate ?? null))
        )
        if (
          !qtyChanged &&
          !priceChanged &&
          !uomChanged &&
          !certaintyChanged &&
          !datesChanged &&
          !edit
        ) {
          if (pkg.children.length) walkPackages(pkg.children)
          continue
        }
        byTaskId[pkg.id] = {
          ...byTaskId[pkg.id],
          ...(qtyChanged || live ? { quantity: quantity ?? storedQty } : {}),
          ...(priceChanged || live ? { unitPrice: unitPrice ?? storedPrice } : {}),
          uom: edit?.uom ?? pkg.uom,
          quantityCertainty: edit?.quantityCertainty ?? pkg.quantityCertainty,
          ...(edit?.startDate?.trim() ? { startDate: edit.startDate.trim() } : {}),
          ...(edit?.finishDate?.trim() ? { finishDate: edit.finishDate.trim() } : {}),
          ...(edit?.weightPercent?.trim()
            ? { scheduleWeight: Number(edit.weightPercent) }
            : {}),
        }
        if (pkg.children.length) walkPackages(pkg.children)
      }
    }
    for (const n of scheduleTaskFlat) {
      walkPackages(n.packages)
    }

    if (Object.keys(byTaskId).length === 0) return
    publishScheduleFieldDrafts(projectId, byTaskId)
  }, [
    projectId,
    readOnly,
    taskDrafts,
    scheduleTaskFlat,
    weightRollup,
    commercialInputs,
    edits,
  ])

  // Restore in-progress edits when returning to ویرایش برنامه
  useEffect(() => {
    if (!projectId || readOnly) return
    const stored = readScheduleFieldDrafts(projectId)
    if (Object.keys(stored).length === 0) return
    setTaskDrafts((prev) => (Object.keys(prev).length > 0 ? prev : stored))
  }, [projectId, readOnly])

  function beginPackageEdit(
    pkg: WorkshopPackageNode,
    fallback?: { start?: string | null; finish?: string | null }
  ) {
    if (readOnly) return
    if (!canEditWorkshopPackageRow(pkg.approvalStatus, pkg.origin ?? 'user_added')) {
      setMessage('این مورد قابل ویرایش نیست')
      return
    }
    setSelected({ kind: 'package', id: pkg.id, name: pkg.name, pkg })
    setEditingPackageId(pkg.id)
    setEdits((prev) => ({
      ...prev,
      [pkg.id]: prev[pkg.id] ?? getEdit(pkg, fallback),
    }))
  }

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
      if (!node?.taskId) {
        setMessage('یک فعالیت مشخص را انتخاب کنید')
        return
      }
      setExpanded((x) => ({ ...x, [node.id]: true }))
      setSelected({ kind: 'schedule', id: node.id, name: node.name, wbs: node.wbs })
      const firstChild = node.packages.length === 0
      const parentQty = node.task?.quantity ?? node.task?.schedule_quantity
      setInlineDraft({
        parentKind: 'schedule',
        parentId: node.taskId,
        parentName: node.name,
        depth: visualScheduleDepth(node.id) + 1,
        previewWbs: nextChildWbs(node.wbs, node.packages.length),
        name: '',
        quantity:
          firstChild && parentQty != null && Number(parentQty) > 0 ? String(parentQty) : '',
        quantityCertainty:
          firstChild && node.task?.quantity_certainty === 'قطعی' ? 'قطعی' : 'حدودی',
        unitPrice:
          firstChild && node.task?.unit_price != null
            ? String(Number(node.task.unit_price) || 0)
            : '0',
        uom: firstChild && node.task ? taskUomValue(node.task) || 'm2' : 'm2',
        location: '',
        crew: '',
        weightPercent: '',
        subcontractorId:
          firstChild
            ? node.task?.subcontractor_id ?? ''
            : '',
        inheritedSubcontractorId:
          node.task?.resolved_subcontractor_id ?? node.task?.subcontractor_id ?? null,
        scheduleFields: {},
        startDate: toIsoDateOnly(node.startDate) ?? '',
        finishDate: toIsoDateOnly(node.finishDate) ?? '',
        totalFloat: '',
        predecessorLabel: node.predecessorLabel?.trim() ?? '',
      })
      setMessage(null)
      return
    }

    const pkg = row.pkg
    const firstChild = pkg.children.length === 0
    setExpanded((x) => ({ ...x, [`pkg:${pkg.id}`]: true }))
    setSelected(row)
    setInlineDraft({
      parentKind: 'package',
      parentId: pkg.id,
      parentName: pkg.name,
      depth: packageDepth(pkg.id),
      previewWbs: nextChildWbs(pkg.wbs, pkg.children.length),
      name: '',
      quantity: firstChild && Number(pkg.quantity) > 0 ? String(pkg.quantity) : '',
      quantityCertainty: firstChild ? pkg.quantityCertainty : 'حدودی',
      unitPrice: firstChild ? String(Number(pkg.unitPrice) || 0) : '0',
      uom: firstChild ? pkg.uom || 'm2' : 'm2',
      location: '',
      crew: '',
      weightPercent: '',
      subcontractorId: firstChild ? pkg.subcontractorId ?? '' : '',
      inheritedSubcontractorId: pkg.resolvedSubcontractorId ?? pkg.subcontractorId ?? null,
      scheduleFields: {},
      startDate: toIsoDateOnly(pkg.startDate) ?? '',
      finishDate: toIsoDateOnly(pkg.finishDate) ?? '',
      totalFloat: '',
      predecessorLabel: packagePredecessorLabel(pkg),
    })
    setMessage(null)
  }

  function packagePredecessorLabel(pkg: WorkshopPackageNode): string {
    const fields = pkg.scheduleFields ?? {}
    const raw = fields.predecessors ?? fields.predecessor_label
    return raw != null && String(raw).trim() ? String(raw).trim() : ''
  }

  const mspActivities = useMemo(() => collectMspActivities(nodes), [nodes])
  const mspPredItems = useMemo(() => {
    const items = mspActivities.map((activity) => {
      if (activity.kind === 'task') {
        const node = findScheduleNode(nodes, activity.id)
        const label =
          taskDrafts[activity.id]?.predecessorLabel !== undefined
            ? taskDrafts[activity.id]?.predecessorLabel ?? ''
            : node?.predecessorLabel?.trim() ?? ''
        return { wbs: activity.wbs, name: activity.name, label }
      }
      const pkg = findPackageInTree(nodes, activity.id)
      const label =
        edits[activity.id]?.predecessorLabel !== undefined
          ? edits[activity.id]?.predecessorLabel ?? ''
          : pkg
            ? packagePredecessorLabel(pkg)
            : ''
      return { wbs: activity.wbs, name: activity.name, label }
    })
    if (inlineDraft?.previewWbs) {
      items.push({
        wbs: inlineDraft.previewWbs,
        name: inlineDraft.name || 'زیرشاخه جدید',
        label: inlineDraft.predecessorLabel,
      })
    }
    return items
  }, [mspActivities, nodes, taskDrafts, edits, inlineDraft])

  async function savePredDialogLabel(label: string) {
    if (!predDialog) return
    setPredDialogSaving(true)
    setMessage(null)
    try {
      if (predDialog.kind === 'draft') {
        setInlineDraft((draft) => (draft ? { ...draft, predecessorLabel: label } : draft))
        setPredDialog(null)
        return
      }
      if (predDialog.kind === 'task') {
        patchTaskDraft(predDialog.id, { predecessorLabel: label })
        await saveScheduleTaskFields(predDialog.id, { predecessorLabel: label })
        setPredDialog(null)
        await load()
        return
      }
      const pkg = findPackageInTree(nodes, predDialog.id)
      if (!pkg) throw new Error('زیرشاخه پیدا نشد')
      setEditField(pkg.id, pkg, { predecessorLabel: label })
      await savePackagePredFloat(pkg, { predecessorLabel: label })
      setPredDialog(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره وابستگی ناموفق بود')
    } finally {
      setPredDialogSaving(false)
    }
  }

  function packageTotalFloat(pkg: WorkshopPackageNode): string {
    const fields = pkg.scheduleFields ?? {}
    const raw = fields.total_float_days
    if (raw == null || raw === '') return ''
    const n = Number(raw)
    return Number.isFinite(n) ? String(n) : ''
  }

  function getEdit(
    pkg: WorkshopPackageNode,
    fallback?: { start?: string | null; finish?: string | null }
  ): EditDraft {
    return (
      edits[pkg.id] ?? {
        name: pkg.name,
        quantity: String(pkg.quantity),
        quantityCertainty: pkg.quantityCertainty,
        unitPrice: String(pkg.unitPrice),
        uom: pkg.uom,
        location: pkg.location ?? '',
        crew: pkg.crew ?? '',
        weightPercent: pkg.weightPercent != null ? String(pkg.weightPercent) : '',
        startDate:
          toIsoDateOnly(pkg.startDate) ?? toIsoDateOnly(fallback?.start) ?? '',
        finishDate:
          toIsoDateOnly(pkg.finishDate) ?? toIsoDateOnly(fallback?.finish) ?? '',
        predecessorLabel: packagePredecessorLabel(pkg),
        totalFloat: packageTotalFloat(pkg),
      }
    )
  }

  function setEditField(pkgId: string, pkg: WorkshopPackageNode, patch: Partial<EditDraft>) {
    setEdits((prev) => ({
      ...prev,
      [pkgId]: { ...getEdit(pkg), ...patch },
    }))
  }

  function isDirty(
    pkg: WorkshopPackageNode,
    fallback?: { start?: string | null; finish?: string | null }
  ) {
    const e = edits[pkg.id]
    if (!e) return false
    const baseStart =
      toIsoDateOnly(pkg.startDate) ?? toIsoDateOnly(fallback?.start) ?? ''
    const baseFinish =
      toIsoDateOnly(pkg.finishDate) ?? toIsoDateOnly(fallback?.finish) ?? ''
    return (
      e.name !== pkg.name ||
      e.quantity !== String(pkg.quantity) ||
      e.quantityCertainty !== pkg.quantityCertainty ||
      e.unitPrice !== String(pkg.unitPrice) ||
      e.uom !== pkg.uom ||
      e.location !== (pkg.location ?? '') ||
      e.crew !== (pkg.crew ?? '') ||
      e.weightPercent !== (pkg.weightPercent != null ? String(pkg.weightPercent) : '') ||
      e.startDate !== baseStart ||
      e.finishDate !== baseFinish ||
      e.predecessorLabel !== packagePredecessorLabel(pkg) ||
      e.totalFloat !== packageTotalFloat(pkg)
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
          quantityCertainty: e.quantityCertainty,
          unitPrice: Number(e.unitPrice) || 0,
          uom: e.uom,
          location: e.location,
          crew: e.crew,
          weightPercent: e.weightPercent.trim() ? Number(e.weightPercent) : null,
          startDate: e.startDate.trim() || null,
          finishDate: e.finishDate.trim() || null,
          scheduleFields: {
            ...(pkg.scheduleFields ?? {}),
            predecessors: e.predecessorLabel.trim(),
            total_float_days: e.totalFloat.trim() === '' ? null : Number(e.totalFloat),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ذخیره نشد')
      setMessage('ذخیره شد — در ارسال برنامه نیز اعمال شد')
      publishScheduleViewSync(projectId)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا')
    } finally {
      setSaving(false)
    }
  }

  /** Persist one task field patch (no UI saving flag — caller owns it). */
  async function saveScheduleTaskFields(
    taskId: string,
    patch: {
      startDate?: string
      finishDate?: string
      totalFloat?: number | null
      scheduleWeight?: number | null
      predecessorLabel?: string
    }
  ) {
    if (!projectId || readOnly) return
    const res = await fetch('/api/schedule/task-fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, taskId, ...patch }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'ذخیره فعالیت ناموفق بود')
  }

  async function savePackagePredFloat(
    pkg: WorkshopPackageNode,
    patch: { predecessorLabel?: string; totalFloat?: string }
  ) {
    const fields = { ...(pkg.scheduleFields ?? {}) }
    if (patch.predecessorLabel !== undefined) {
      fields.predecessors = patch.predecessorLabel.trim()
    }
    if (patch.totalFloat !== undefined) {
      const raw = patch.totalFloat.trim()
      fields.total_float_days = raw === '' ? null : Number(raw)
      if (raw !== '' && !Number.isFinite(Number(raw))) {
        setMessage('شناوری نامعتبر است')
        return
      }
    }
    setSavingExtraCell(`pkg:${pkg.id}:pred-float`)
    try {
      const res = await fetch(`/api/workshop/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleFields: fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ذخیره ناموفق بود')
      publishScheduleViewSync(projectId)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره پیش‌نیاز/شناوری ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  function replaceTaskInNodes(task: ProjectTask) {
    const replace = (items: ScheduleTreeNode[]): ScheduleTreeNode[] =>
      items.map((node) => {
        if (node.taskId === task.id) {
          return {
            ...node,
            task,
            name: task.name,
            wbs: task.wbs_code,
          }
        }
        return node.children.length ? { ...node, children: replace(node.children) } : node
      })
    setNodes((current) => replace(current))
    const qty = task.quantity ?? task.schedule_quantity
    setCommercialInputs((prev) => ({
      ...prev,
      [task.id]: {
        quantity: qty != null && Number(qty) > 0 ? String(qty) : prev[task.id]?.quantity ?? '',
        unitPrice:
          task.unit_price != null
            ? String(Number(task.unit_price) || 0)
            : prev[task.id]?.unitPrice ?? '0',
      },
    }))
  }

  async function saveExtraTaskField(
    task: ProjectTask,
    field: ExtraTaskField,
    value: unknown
  ) {
    if (readOnly || !field.type) return
    const cellKey = `${task.id}:${field.key}`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      if (field.type === 'contractor') {
        const response = await fetch('/api/schedule/contractors', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            taskIds: [task.id],
            contractorId: value || null,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'ذخیره پیمانکار ناموفق بود')
        const assignment = (data.assignments ?? []).find(
          (item: { id: string }) => item.id === task.id
        )
        replaceTaskInNodes({
          ...task,
          subcontractor_id: assignment?.subcontractor_id ?? null,
          resolved_subcontractor_id: assignment?.resolved_subcontractor_id ?? null,
        })
      } else {
        const response = await fetch('/api/schedule/task-details', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            taskId: task.id,
            field: field.key,
            value,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'ذخیره مقدار ناموفق بود')
        replaceTaskInNodes(data.task as ProjectTask)
      }
      publishScheduleViewSync(projectId)
      setMessage('تغییر ذخیره شد و در ارسال برنامه نیز اعمال شد')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره مقدار ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function savePackageExtraField(
    pkg: WorkshopPackageNode,
    field: ExtraTaskField,
    value: unknown
  ) {
    if (readOnly || !field.type) return
    const cellKey = `pkg:${pkg.id}:${field.key}`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch(`/api/workshop/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          field.type === 'contractor'
            ? { subcontractorId: value || null }
            : { scheduleFields: { ...(pkg.scheduleFields ?? {}), [field.key]: value } }
        ),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره زیرشاخه ناموفق بود')
      await load()
      publishScheduleViewSync(projectId)
      setMessage('اطلاعات زیرشاخه ذخیره شد — در ارسال برنامه نیز اعمال شد')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره زیرشاخه ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function saveTaskQuantityCertainty(
    task: ProjectTask,
    value: 'حدودی' | 'قطعی'
  ) {
    const cellKey = `${task.id}:quantity_certainty`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch('/api/schedule/task-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskId: task.id,
          field: 'quantity_certainty',
          value,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره وضعیت مقدار ناموفق بود')
      replaceTaskInNodes(data.task as ProjectTask)
      publishScheduleViewSync(projectId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره وضعیت مقدار ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function saveTaskUom(task: ProjectTask, value: string) {
    const cellKey = `${task.id}:uom`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch('/api/schedule/task-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskId: task.id,
          field: 'uom',
          value,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره واحد ناموفق بود')
      replaceTaskInNodes(data.task as ProjectTask)
      publishScheduleViewSync(projectId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره واحد ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function savePackageUom(pkg: WorkshopPackageNode, value: string) {
    const cellKey = `pkg:${pkg.id}:uom`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch(`/api/workshop/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uom: value }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره واحد ناموفق بود')
      await load()
      publishScheduleViewSync(projectId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره واحد ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function saveTaskUnitPrice(task: ProjectTask, value: number) {
    const cellKey = `${task.id}:unit_price`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch('/api/schedule/task-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskId: task.id,
          field: 'unit_price',
          value,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره قیمت واحد ناموفق بود')
      replaceTaskInNodes({
        ...(data.task as ProjectTask),
        unit_price: value,
      })
      setCommercialInputs((prev) => ({
        ...prev,
        [task.id]: {
          quantity: prev[task.id]?.quantity ?? '',
          unitPrice: String(value),
        },
      }))
      publishScheduleViewSync(projectId)
      setMessage('قیمت واحد در برنامه و ارسال برنامه ذخیره شد')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره قیمت واحد ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function saveTaskQuantity(task: ProjectTask, value: number | null) {
    const cellKey = `${task.id}:quantity`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch('/api/schedule/task-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskId: task.id,
          field: 'quantity',
          value,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره مقدار ناموفق بود')
      replaceTaskInNodes({
        ...(data.task as ProjectTask),
        quantity: value,
      })
      setCommercialInputs((prev) => ({
        ...prev,
        [task.id]: {
          quantity: value != null && value > 0 ? String(value) : '',
          unitPrice: prev[task.id]?.unitPrice ?? String(Number(task.unit_price ?? 0) || 0),
        },
      }))
      publishScheduleViewSync(projectId)
      setMessage('مقدار ذخیره شد')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'ذخیره مقدار ناموفق بود'
      setMessage(
        /column.*quantity|quantity.*column|schema cache/i.test(msg)
          ? 'ستون quantity در Supabase نیست — فایل database/91-schedule-qty-unit-price.sql را اجرا کنید'
          : msg
      )
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function savePackageQuantity(pkg: WorkshopPackageNode, value: number) {
    const cellKey = `pkg:${pkg.id}:quantity`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch(`/api/workshop/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: value }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره مقدار ناموفق بود')
      await load()
      publishScheduleViewSync(projectId)
      setMessage('مقدار ذخیره شد — در ارسال برنامه نیز اعمال شد')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره مقدار ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  async function savePackageQuantityCertainty(
    pkg: WorkshopPackageNode,
    value: 'حدودی' | 'قطعی'
  ) {
    const cellKey = `pkg:${pkg.id}:quantity_certainty`
    setSavingExtraCell(cellKey)
    setMessage(null)
    try {
      const response = await fetch(`/api/workshop/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityCertainty: value }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره وضعیت مقدار ناموفق بود')
      await load()
      publishScheduleViewSync(projectId)
      setMessage('وضعیت مقدار ذخیره شد')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره وضعیت مقدار ناموفق بود')
    } finally {
      setSavingExtraCell(null)
    }
  }

  function patchTaskDraft(
    taskId: string,
    patch: {
      startDate?: string
      finishDate?: string
      totalFloat?: number | null
      scheduleWeight?: number | null
      predecessorLabel?: string
    }
  ) {
    setTaskDrafts((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], ...patch },
    }))
  }

  async function commitFinalSchedule() {
    if (!projectId || readOnly) return
    const entries = Object.entries(taskDrafts)
    const packagesToSave = collectScheduleTaskNodes(nodes).length >= 0
      ? (() => {
          const dirty: WorkshopPackageNode[] = []
          const walk = (list: WorkshopPackageNode[]) => {
            for (const p of list) {
              if (isDirty(p)) dirty.push(p)
              if (p.children.length) walk(p.children)
            }
          }
          for (const n of collectScheduleTaskNodes(nodes)) walk(n.packages)
          return dirty
        })()
      : []

    if (entries.length === 0 && packagesToSave.length === 0 && !inlineDraft) {
      setSaving(true)
      setMessage(null)
      try {
        await load()
        publishScheduleViewSync(projectId)
        setMessage('برنامه بروزرسانی شد')
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'بروزرسانی ناموفق بود')
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      if (inlineDraft) {
        const name = inlineDraft.name.trim()
        const quantity = Number(inlineDraft.quantity)
        if (!name || !(quantity > 0)) {
          throw new Error('نام و مقدار زیرمجموعه را کامل کنید')
        }
        const res = await fetch('/api/workshop/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            parentScheduleNodeId:
              inlineDraft.parentKind === 'schedule' ? inlineDraft.parentId : null,
            parentPackageId: inlineDraft.parentKind === 'package' ? inlineDraft.parentId : null,
            name,
            quantity,
            quantityCertainty: inlineDraft.quantityCertainty,
            unitPrice: Number(inlineDraft.unitPrice) || 0,
            uom: inlineDraft.uom,
            location: inlineDraft.location || null,
            crew: inlineDraft.crew || null,
            wbsCode: inlineDraft.previewWbs,
            weightPercent: inlineDraft.weightPercent.trim()
              ? Number(inlineDraft.weightPercent)
              : null,
            subcontractorId: inlineDraft.subcontractorId || null,
            startDate: inlineDraft.startDate || null,
            finishDate: inlineDraft.finishDate || null,
            scheduleFields: {
              ...inlineDraft.scheduleFields,
              predecessors: inlineDraft.predecessorLabel?.trim() || '',
              total_float_days: inlineDraft.totalFloat
                ? Number(inlineDraft.totalFloat)
                : null,
              physical_percent_complete: 0,
              percent_complete: 0,
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'ایجاد زیرمجموعه ناموفق بود')
        setInlineDraft(null)
      }

      for (const pkg of packagesToSave) {
        const e = getEdit(pkg)
        const res = await fetch(`/api/workshop/packages/${pkg.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: e.name,
            quantity: Number(e.quantity),
            quantityCertainty: e.quantityCertainty,
            unitPrice: Number(e.unitPrice) || 0,
            uom: e.uom,
            location: e.location,
            crew: e.crew,
            weightPercent: e.weightPercent.trim() ? Number(e.weightPercent) : null,
            startDate: e.startDate.trim() || null,
            finishDate: e.finishDate.trim() || null,
            scheduleFields: {
              ...(pkg.scheduleFields ?? {}),
              predecessors: e.predecessorLabel.trim(),
              total_float_days: e.totalFloat.trim() === '' ? null : Number(e.totalFloat),
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'ذخیره پکیج ناموفق بود')
      }

      // Each date save re-chains its successors, so earlier tasks go first and every edited
      // date is written after the edits of its predecessors.
      const startOf = (taskId: string, patch: (typeof entries)[number][1]) =>
        toIsoDateOnly(patch.startDate) ??
        toIsoDateOnly(scheduleTaskFlat.find((n) => n.taskId === taskId)?.startDate) ??
        '9999-12-31'
      const ordered = [...entries].sort(([a, pa], [b, pb]) => startOf(a, pa).localeCompare(startOf(b, pb)))
      for (const [taskId, patch] of ordered) {
        if (
          patch.startDate === undefined &&
          patch.finishDate === undefined &&
          patch.totalFloat === undefined &&
          patch.scheduleWeight === undefined &&
          patch.predecessorLabel === undefined
        ) {
          continue
        }
        await saveScheduleTaskFields(taskId, patch)
      }

      setTaskDrafts({})
      clearScheduleFieldDrafts(projectId)
      // Recalculate floats so برنامه and گانت stay aligned
      try {
        await fetch(`/api/schedule/calculate?projectId=${encodeURIComponent(projectId)}`, {
          cache: 'no-store',
        })
      } catch {
        /* dates already saved; float refresh is best-effort */
      }
      publishScheduleViewSync(projectId)
      setMessage('به‌روزرسانی شد — تغییرات در گانت و ارسال برنامه هم اعمال شد')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا در ثبت نهایی')
    } finally {
      setSaving(false)
    }
  }

  const refreshRef = useRef<() => Promise<void>>(async () => {})
  refreshRef.current = async () => {
    if (readOnly) {
      await load()
      return
    }
    await commitFinalSchedule()
  }

  useEffect(() => {
    const onRefresh = () => {
      void refreshRef.current()
    }
    window.addEventListener('workshop-refresh', onRefresh)
    return () => window.removeEventListener('workshop-refresh', onRefresh)
  }, [])

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
          quantityCertainty: inlineDraft.quantityCertainty,
          unitPrice: Number(inlineDraft.unitPrice) || 0,
          uom: inlineDraft.uom,
          location: inlineDraft.location,
          crew: inlineDraft.crew,
          wbsCode: inlineDraft.previewWbs,
          weightPercent: inlineDraft.weightPercent.trim()
            ? Number(inlineDraft.weightPercent)
            : null,
          subcontractorId: inlineDraft.subcontractorId || null,
          startDate: inlineDraft.startDate || null,
          finishDate: inlineDraft.finishDate || null,
          scheduleFields: {
            ...inlineDraft.scheduleFields,
            predecessors: (inlineDraft.predecessorLabel ?? '').trim(),
            total_float_days: inlineDraft.totalFloat
              ? Number(inlineDraft.totalFloat)
              : null,
            physical_percent_complete: 0,
            percent_complete: 0,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ذخیره نشد')

      const createdId = data.package?.id ? String(data.package.id) : null
      setInlineDraft(null)
      setMessage(`زیرمجموعه ${inlineDraft.previewWbs} ذخیره شد — در ارسال برنامه نیز اعمال شد`)
      publishScheduleViewSync(projectId)
      const loadedNodes = await load(expandAfter)
      if (createdId) {
        const pkg = findPackageInTree(loadedNodes, createdId)
        if (pkg) {
          setSelected({ kind: 'package', id: pkg.id, name: pkg.name, pkg })
          // Enter edit mode so the new activity stays editable after save
          setEditingPackageId(pkg.id)
          setEdits((prev) => ({
            ...prev,
            [pkg.id]: getEdit(pkg),
          }))
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا')
    } finally {
      setSaving(false)
    }
  }

  const visibleRows = useMemo(
    () => flattenWorkshopSchedule(nodes, expanded),
    [nodes, expanded]
  )
  const expandableIds = useMemo(() => scheduleExpandableIds(nodes), [nodes])

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
              : 'در همین جدول ویرایش کنید. برای ثبت تغییرات «به‌روزرسانی» را بزنید.'
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

      {dependencyLinkCount > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-950">
          وابستگی MSP: <strong>{dependencyLinkCount}</strong> پیوند روی{' '}
          <strong>{tasksWithPredecessors}</strong> فعالیت — ستون «پیش‌نیاز» را ببینید (مثال:{' '}
          <span className="font-mono" dir="ltr">
            1.2FS
          </span>{' '}
          یعنی بعد از پایان ۱.۲ شروع می‌شود؛{' '}
          <span className="font-mono" dir="ltr">
            SS+2d
          </span>{' '}
          یعنی هم‌زمان با شروع پیش‌نیاز + ۲ روز).
        </div>
      ) : projectId && !loading ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
          برای این پروژه پیوند وابستگی‌ای در دیتابیس نیست — یا MSP بدون PredecessorLink ایمپورت
          شده، یا هنوز ایمپورت نشده. بدون پیوند، فقط جابه‌جایی تقریبی فعالیت‌های بعدی اعمال می‌شود.
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden w-full max-w-full min-w-0">
          {!projectWeightCheck.ok ? (
            <div
              className="flex items-start gap-1.5 border-b border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-800"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                خطای وزن‌دهی: جمع وزن سرتیترها و فعالیت‌های بدون‌فرزند سطح پروژه{' '}
                <strong className="tabular-nums">{projectWeightCheck.sum}</strong> است؛ باید{' '}
                <strong>۱۰۰</strong> باشد
                {projectWeightCheck.gap !== 0 ? (
                  <>
                    {' '}
                    (اختلاف{' '}
                    <strong className="tabular-nums">
                      {projectWeightCheck.gap > 0 ? '+' : ''}
                      {projectWeightCheck.gap}
                    </strong>
                    )
                  </>
                ) : null}
                .
              </span>
            </div>
          ) : null}

          <div className="sticky top-0 z-40 border-b border-slate-200 bg-slate-200/80">
            <div
              ref={topHScrollRef}
              className="overflow-x-auto overflow-y-hidden [scrollbar-width:thin]"
              style={{ height: 14 }}
              onScroll={() => syncHorizontalScroll('top')}
              aria-label="اسکرول افقی جدول"
            >
              <div
                style={{ width: Math.max(tableScrollWidth, 1), height: 1 }}
                aria-hidden
              />
            </div>
          </div>

          <div
            ref={scheduleTableScrollRef}
            className="overflow-auto max-h-[calc(100vh-160px)] w-full [scrollbar-gutter:stable]"
            onScroll={() => syncHorizontalScroll('main')}
          >
            <table
              className="w-full border-separate border-spacing-0 text-xs sm:text-sm text-center [&_input]:!text-center [&_select]:!text-center [&_select]:![text-align-last:center] [&_textarea]:!text-center"
              style={{
                tableLayout: 'fixed',
                width: `${SCHEDULE_BASE_WIDTH + visibleExtraTaskFields.length * EXTRA_SCHEDULE_COL_WIDTH}px`,
              }}
            >
              <colgroup>
                {SCHEDULE_COL_WIDTHS.map((width, i) => (
                  <col key={i} style={{ width }} />
                ))}
                {visibleExtraTaskFields.map((field) => (
                  <col key={field.key} style={{ width: EXTRA_SCHEDULE_COL_WIDTH }} />
                ))}
              </colgroup>
              <thead className="border-b text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)]">
                <tr>
                  <th
                    className={SCHEDULE_STICKY_WBS_HEAD}
                    style={{
                      width: SCHEDULE_COL_WIDTHS[0],
                      right: STICKY_WBS_RIGHT,
                      top: 0,
                    }}
                  >
                    WBS
                  </th>
                  <th
                    className={SCHEDULE_STICKY_NAME_HEAD}
                    style={{
                      width: SCHEDULE_COL_WIDTHS[1],
                      right: STICKY_NAME_RIGHT,
                      top: 0,
                      boxShadow: STICKY_NAME_EDGE_SHADOW,
                    }}
                  >
                    نام
                  </th>
                  <th
                    className={SCHEDULE_HEAD}
                    style={{ width: SCHEDULE_COL_WIDTHS[2] }}
                    title="پیش‌نیاز قابل ویرایش — مثلاً 3FS+4d یا 4.1FS, 5SS"
                  >
                    پیش‌نیاز
                  </th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[3] }}>
                    <div className="leading-tight">
                      <span className="block">تاریخ</span>
                      <span className="mt-0.5 flex font-normal text-[9px] text-slate-500">
                        <span className="flex-1">شروع</span>
                        <span className="flex-1">پایان</span>
                      </span>
                    </div>
                  </th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[4] }}>شناوری</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[5] }}>محل</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[6] }}>مقدار</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[7] }}>واحد</th>
                  <th
                    className={`${SCHEDULE_HEAD} relative`}
                    style={{ width: SCHEDULE_COL_WIDTHS[8] }}
                    title={TOTAL_PRICE_HELP}
                  >
                    کارکرد
                  </th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[9] }}>قیمت واحد</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[10] }}>وزن</th>
                  <th className={SCHEDULE_HEAD} style={{ width: SCHEDULE_COL_WIDTHS[11] }}>وضعیت</th>
                  {visibleExtraTaskFields.map((field) => (
                    <th key={field.key} className={`${SCHEDULE_HEAD} min-w-[112px]`}>
                      {field.label}
                      {!field.type ? (
                        <span className="block text-[8px] font-normal text-slate-400">
                          فقط‌خواندنی
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={scheduleColCount} className="px-3 py-8 text-center text-slate-500">
                      در حال بارگذاری…
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.length === 0 && !inlineDraft && (
                  <tr>
                    <td colSpan={scheduleColCount} className="px-3 py-8 text-center text-slate-500">
                      برنامه‌ای برای این پروژه import نشده.
                    </td>
                  </tr>
                )}
                {visibleRows.map((row, rowIndex) => {
                  const groupKey = scheduleGroupKey(row.wbs)
                  const isGroupFirst =
                    rowIndex === 0 ||
                    scheduleGroupKey(visibleRows[rowIndex - 1]?.wbs) !== groupKey
                  const isGroupLast =
                    rowIndex === visibleRows.length - 1 ||
                    scheduleGroupKey(visibleRows[rowIndex + 1]?.wbs) !== groupKey
                  const hasInlineAfter =
                    !readOnly &&
                    Boolean(inlineDraft) &&
                    (row.type === 'schedule'
                      ? inlineDraft?.parentKind === 'schedule' &&
                        inlineDraft.parentId === row.node.taskId
                      : inlineDraft?.parentKind === 'package' &&
                        inlineDraft.parentId === row.pkg.id)
                  const groupFrameClass = [
                    '[&>td:first-child]:border-r-2 [&>td:first-child]:border-r-slate-500',
                    '[&>td:last-child]:border-l-2 [&>td:last-child]:border-l-slate-500',
                    isGroupFirst
                      ? '[&>td]:border-t-2 [&>td]:border-t-slate-500'
                      : '',
                    isGroupLast && !hasInlineAfter
                      ? '[&>td]:border-b-2 [&>td]:border-b-slate-500'
                      : '',
                  ].join(' ')
                  if (row.type === 'schedule') {
                    const n = row.node
                    const isSel = selected?.kind === 'schedule' && selected.id === n.id
                    const open = Boolean(expanded[n.id])
                    const canExpand = expandableIds.has(n.id)
                    const indentPx = 8 + row.depth * 22
                    return (
                      <FragmentRows key={`s-${n.id}`}>
                        <tr
                          onClick={() => {
                            setSelected({ kind: 'schedule', id: n.id, name: n.name, wbs: n.wbs })
                          }}
                          className={`group cursor-pointer border-b border-slate-300 hover:bg-slate-50 ${groupFrameClass} ${
                            isSel ? 'bg-amber-50' : 'bg-white'
                          }`}
                        >
                          <td
                            className={`${SCHEDULE_STICKY_WBS_CELL} font-mono text-[11px] tabular-nums text-slate-600 text-center group-hover:bg-slate-50 ${
                              isSel ? 'bg-amber-50 group-hover:bg-amber-50' : 'bg-white'
                            }`}
                            style={{ right: STICKY_WBS_RIGHT }}
                          >
                            {row.wbs}
                          </td>
                          <td
                            className={`${SCHEDULE_STICKY_NAME_CELL} group-hover:bg-slate-50 ${
                              isSel ? 'bg-amber-50 group-hover:bg-amber-50' : 'bg-white'
                            }`}
                            style={{
                              right: STICKY_NAME_RIGHT,
                              boxShadow: STICKY_NAME_EDGE_SHADOW,
                            }}
                          >
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
                                  className="relative z-20 p-0.5 rounded hover:bg-slate-200 shrink-0"
                                  onClick={(e) => {
                                    e.preventDefault()
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
                              <span className="min-w-0 flex-1 font-medium text-slate-900 truncate text-xs leading-snug">
                                {displayActivityName(n.name, n.wbs)}
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
                                  className="relative z-20 ms-1 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 shrink-0"
                                  onClick={(e) => {
                                    e.preventDefault()
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
                          <td
                            className={`${SCHEDULE_CELL} font-mono text-[10px] text-slate-700 leading-tight`}
                            title={
                              n.predecessorTooltip?.trim() ||
                              n.predecessorLabel ||
                              'مثال: 3FS+4d یا 4.1FS, 5SS'
                            }
                          >
                            {n.taskId ? (
                              <button
                                type="button"
                                dir="ltr"
                                className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-center font-mono hover:border-sky-400 hover:bg-sky-50"
                                title="باز کردن پنجره وابستگی مثل MSP"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const label =
                                    taskDrafts[n.taskId!]?.predecessorLabel !== undefined
                                      ? taskDrafts[n.taskId!]?.predecessorLabel ?? ''
                                      : n.predecessorLabel?.trim() ?? ''
                                  setPredDialog({
                                    kind: 'task',
                                    id: n.taskId!,
                                    wbs: n.wbs?.trim() ?? '',
                                    name: n.name,
                                    label,
                                  })
                                }}
                              >
                                {(taskDrafts[n.taskId]?.predecessorLabel !== undefined
                                  ? taskDrafts[n.taskId]?.predecessorLabel
                                  : n.predecessorLabel?.trim()) || '—'}
                              </button>
                            ) : (
                              <span dir="ltr" className="block text-center">
                                {n.predecessorLabel?.trim() ? n.predecessorLabel : '—'}
                              </span>
                            )}
                          </td>
                          <td
                            className={`${SCHEDULE_CELL} text-[11px] text-slate-600 tabular-nums leading-tight overflow-hidden`}
                          >
                            {(() => {
                              const header = isScheduleHeader(n, expandableIds)
                              const env = header ? envelopeForScheduleNode(n) : null
                              const startIso = header
                                ? env?.start ?? row.startDate
                                : toIsoDateOnly(taskDrafts[n.taskId ?? '']?.startDate) ??
                                  toIsoDateOnly(row.startDate)
                              const finishIso = header
                                ? env?.finish ?? row.finishDate
                                : toIsoDateOnly(taskDrafts[n.taskId ?? '']?.finishDate) ??
                                  toIsoDateOnly(row.finishDate)
                              if (!readOnly && n.taskId && !n.isSyntheticGroup && !header) {
                                return (
                                  <CompactJalaliDateRange
                                    startIso={startIso}
                                    finishIso={finishIso}
                                    calendar={calendar}
                                    disabled={saving}
                                    onCommit={(startDate, finishDate) => {
                                      patchTaskDraft(n.taskId!, { startDate, finishDate })
                                    }}
                                  />
                                )
                              }
                              return (
                                <ScheduleDatePair
                                  startIso={startIso}
                                  finishIso={finishIso}
                                  calendar={calendar}
                                  bold={header}
                                />
                              )
                            })()}
                          </td>
                          <td className={`${SCHEDULE_CELL} text-center`}>
                            {!readOnly && n.taskId && !n.isSyntheticGroup ? (
                              <input
                                type="number"
                                step="0.5"
                                className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] tabular-nums text-center"
                                value={
                                  taskDrafts[n.taskId]?.totalFloat !== undefined
                                    ? taskDrafts[n.taskId]?.totalFloat ?? ''
                                    : n.totalFloat != null && Number.isFinite(n.totalFloat)
                                      ? String(n.totalFloat)
                                      : ''
                                }
                                placeholder="—"
                                disabled={saving}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(ev) => {
                                  const raw = ev.target.value.trim()
                                  const next = raw === '' ? null : Number(raw)
                                  if (raw !== '' && !Number.isFinite(next as number)) return
                                  patchTaskDraft(n.taskId!, { totalFloat: next })
                                }}
                              />
                            ) : (
                              <span className="tabular-nums text-[11px] text-slate-600">
                                {n.totalFloat != null && Number.isFinite(n.totalFloat)
                                  ? n.totalFloat
                                  : '—'}
                              </span>
                            )}
                          </td>
                          <td className={`${SCHEDULE_CELL} text-slate-400 text-center`}>—</td>
                          <td className={`${SCHEDULE_CELL} text-center`}>
                            {n.task && !readOnly && !n.isSyntheticGroup && !isScheduleHeader(n, expandableIds) ? (
                              <div
                                className="flex items-center gap-1"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] tabular-nums text-center"
                                  value={
                                    commercialInputs[n.task.id]?.quantity ??
                                    (n.task.quantity != null && Number(n.task.quantity) > 0
                                      ? String(n.task.quantity)
                                      : '')
                                  }
                                  placeholder="مقدار"
                                  disabled={savingExtraCell === `${n.task.id}:quantity`}
                                  onChange={(event) => {
                                    setCommercialField(n.task!.id, 'quantity', event.target.value, {
                                      unitPrice: String(Number(n.task?.unit_price ?? 0) || 0),
                                    })
                                  }}
                                  onBlur={(event) => {
                                    const raw = event.target.value.trim()
                                    const value = raw === '' ? null : Number(raw)
                                    if (raw !== '' && (!Number.isFinite(value) || (value as number) < 0)) {
                                      const restored =
                                        n.task?.quantity != null && Number(n.task.quantity) > 0
                                          ? String(n.task.quantity)
                                          : ''
                                      setCommercialField(n.task!.id, 'quantity', restored, {
                                        unitPrice: String(Number(n.task?.unit_price ?? 0) || 0),
                                      })
                                      return
                                    }
                                    const prev =
                                      n.task?.quantity == null ? null : Number(n.task.quantity)
                                    if (value !== prev) {
                                      void saveTaskQuantity(n.task!, value)
                                    }
                                  }}
                                />
                                <select
                                  className="w-[52px] shrink-0 rounded border border-slate-200 bg-white px-0.5 py-0.5 text-[10px] text-center"
                                  value={n.task.quantity_certainty ?? 'حدودی'}
                                  disabled={savingExtraCell === `${n.task.id}:quantity_certainty`}
                                  onChange={(event) =>
                                    void saveTaskQuantityCertainty(
                                      n.task!,
                                      event.target.value as 'حدودی' | 'قطعی'
                                    )
                                  }
                                >
                                  <option value="حدودی">حدودی</option>
                                  <option value="قطعی">قطعی</option>
                                </select>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className={`${SCHEDULE_CELL} text-center`}>
                            {n.task && !readOnly && !n.isSyntheticGroup && !isScheduleHeader(n, expandableIds) ? (
                              <UomSelect
                                value={taskUomValue(n.task)}
                                disabled={readOnly || savingExtraCell === `${n.task.id}:uom`}
                                onChange={(uom) => void saveTaskUom(n.task!, uom)}
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className={SCHEDULE_CELL}>
                            {(() => {
                              if (!n.taskId || isScheduleHeader(n, expandableIds)) {
                                return <span className="tabular-nums text-slate-400">—</span>
                              }
                              const shown = displayTotalPrice(
                                n.taskId,
                                n.task?.quantity ?? n.task?.schedule_quantity ?? null,
                                n.task?.unit_price
                              )
                              return (
                                <span
                                  className="inline-flex w-full items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] tabular-nums text-slate-800"
                                  title={shown.help}
                                >
                                  {shown.value}
                                </span>
                              )
                            })()}
                          </td>
                          <td className={SCHEDULE_CELL}>
                            {(() => {
                              if (!n.taskId || isScheduleHeader(n, expandableIds)) {
                                return <span className="tabular-nums text-slate-400">—</span>
                              }
                              const shown = displayUnitPrice(n.taskId, n.task?.unit_price)
                              if (n.task && !readOnly && !n.isSyntheticGroup) {
                                return (
                                  <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-center text-[10px] tabular-nums"
                                    value={
                                      commercialInputs[n.task.id]?.unitPrice ??
                                      String(shown.value)
                                    }
                                    disabled={savingExtraCell === `${n.task.id}:unit_price`}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => {
                                      setCommercialField(
                                        n.task!.id,
                                        'unitPrice',
                                        event.target.value,
                                        {
                                          quantity:
                                            n.task?.quantity != null &&
                                            Number(n.task.quantity) > 0
                                              ? String(n.task.quantity)
                                              : '',
                                        }
                                      )
                                    }}
                                    onBlur={(event) => {
                                      const value = Number(event.target.value)
                                      if (
                                        Number.isFinite(value) &&
                                        value >= 0 &&
                                        value !== Number(n.task?.unit_price ?? 0)
                                      ) {
                                        void saveTaskUnitPrice(n.task!, value)
                                      }
                                    }}
                                  />
                                )
                              }
                              return (
                                <span className="tabular-nums">{shown.value}</span>
                              )
                            })()}
                          </td>
                          <td className={`${SCHEDULE_CELL} text-center relative`}>
                            {!readOnly && n.taskId ? (
                              <div className="relative w-full">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className={(() => {
                                    const isParent = weightRollup.parentIds.has(n.taskId)
                                    const weightInvalid =
                                      !projectWeightCheck.ok &&
                                      projectWeightCheck.contributorIds.has(n.taskId)
                                    const iconPad = isParent ? ' pe-4' : ''
                                    if (weightInvalid) {
                                      return `w-full rounded border-2 border-red-500 bg-red-50 px-1 py-0.5 text-[11px] tabular-nums text-center font-semibold text-red-900 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]${iconPad}`
                                    }
                                    if (isParent) {
                                      return `w-full rounded border border-sky-200 bg-sky-50 px-1 py-0.5 text-[11px] tabular-nums text-center font-semibold text-sky-950${iconPad}`
                                    }
                                    return 'w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] tabular-nums text-center'
                                  })()}
                                  value={(() => {
                                    const shown = displayScheduleWeight(
                                      n.taskId,
                                      n.scheduleWeight
                                    )
                                    return shown == null ? '' : String(shown)
                                  })()}
                                  placeholder="—"
                                  disabled={saving}
                                  title={
                                    !projectWeightCheck.ok &&
                                    projectWeightCheck.contributorIds.has(n.taskId)
                                      ? `این وزن در جمع سطح پروژه (${projectWeightCheck.sum}) شرکت دارد — باید مجموع ۱۰۰ شود`
                                      : weightRollup.parentIds.has(n.taskId)
                                        ? 'وزن سرشاخه = جمع فرزندان (زنده؛ قابل ویرایش دستی)'
                                        : 'وزن فعالیت'
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(ev) => {
                                    const raw = ev.target.value.trim()
                                    const next = raw === '' ? null : Number(raw)
                                    if (raw !== '' && !Number.isFinite(next as number)) return
                                    if (next != null && next < 0) return
                                    setScheduleWeight(n.taskId!, next)
                                  }}
                                />
                                {weightRollup.parentIds.has(n.taskId) ? (
                                  <button
                                    type="button"
                                    className="absolute inset-y-0 end-0 flex items-center px-0.5 text-sky-700 hover:text-sky-900"
                                    title="وزن سرشاخه از کجا آمده؟"
                                    aria-label="وزن سرشاخه از کجا آمده؟"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setHelpWeightParentId((id) =>
                                        id === n.taskId ? null : n.taskId
                                      )
                                    }}
                                  >
                                    <HelpCircle className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="relative inline-flex w-full items-center justify-center tabular-nums text-[11px] text-slate-700">
                                {formatScheduleWeightDisplay(
                                  n.taskId
                                    ? displayScheduleWeight(n.taskId, n.scheduleWeight)
                                    : n.scheduleWeight
                                )}
                                {n.taskId && weightRollup.parentIds.has(n.taskId) ? (
                                  <button
                                    type="button"
                                    className="absolute inset-y-0 end-0 flex items-center px-0.5 text-sky-700 hover:text-sky-900"
                                    title="وزن سرشاخه از کجا آمده؟"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setHelpWeightParentId((id) =>
                                        id === n.taskId ? null : n.taskId
                                      )
                                    }}
                                  >
                                    <HelpCircle className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </span>
                            )}
                            {n.taskId &&
                            helpWeightParentId === n.taskId &&
                            weightRollup.explanations.get(n.taskId) ? (
                              <div
                                className="absolute z-30 mt-1 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-medium tabular-nums text-slate-800 shadow-lg"
                                style={{ insetInlineEnd: 4 }}
                                dir="rtl"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>{weightRollup.explanations.get(n.taskId)!.text}</span>
                                <button
                                  type="button"
                                  className="shrink-0 text-[10px] text-sky-700 hover:underline"
                                  onClick={() => setHelpWeightParentId(null)}
                                >
                                  ×
                                </button>
                              </div>
                            ) : null}
                          </td>
                          <td className={`${SCHEDULE_CELL} text-slate-500 text-[11px]`}>پایه</td>
                          {visibleExtraTaskFields.map((field) => {
                            const task = n.task
                            const isProgressParent =
                              field.key === 'percent_complete' &&
                              Boolean(task?.id) &&
                              progressRollup.parentIds.has(task.id)
                            const leafProgress =
                              field.key === 'percent_complete'
                                ? resolvePhysicalProgressPercent(
                                    task?.id,
                                    task ? schedulePhysicalPercent(task) : null,
                                    supervisorProgressEntries
                                  )
                                : null
                            const value =
                              field.key === 'percent_complete'
                                ? isProgressParent && task?.id
                                  ? progressRollup.percents[task.id] ?? leafProgress
                                  : leafProgress
                                : task
                                  ? extraTaskValue(field, task)
                                  : null
                            const cellKey = task ? `${task.id}:${field.key}` : ''
                            const progressHelp =
                              isProgressParent && task?.id
                                ? progressRollup.explanations.get(task.id) ?? null
                                : null
                            const inheritedContractor =
                              field.key === 'contractor' &&
                              task?.resolved_subcontractor_id &&
                              !task.subcontractor_id
                                ? contractors.find(
                                    (item) => item.id === task.resolved_subcontractor_id
                                  )?.name
                                : null
                            return (
                              <td
                                key={field.key}
                                className={`${SCHEDULE_CELL} relative min-w-[112px] text-center`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {field.key === 'percent_complete' ? (
                                  <div className="relative w-full">
                                    <span
                                      className={cn(
                                        'inline-flex w-full items-center justify-center rounded border px-1 py-0.5 text-[10px] tabular-nums',
                                        isProgressParent
                                          ? 'border-sky-200 bg-sky-50 pe-4 font-semibold text-sky-950'
                                          : 'border-transparent text-slate-600'
                                      )}
                                      title={
                                        isProgressParent
                                          ? '٪ پیشرفت سرشاخه = میانگین وزنی فرزندان'
                                          : 'از گزارش روزانه سرپرست کارگاه'
                                      }
                                    >
                                      {value == null ? '0' : `${value}`}
                                    </span>
                                    {isProgressParent && progressHelp ? (
                                      <button
                                        type="button"
                                        className="absolute inset-y-0 end-0 flex items-center px-0.5 text-sky-700 hover:text-sky-900"
                                        title="فرمول پیشرفت سرشاخه"
                                        aria-label="فرمول پیشرفت سرشاخه"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setHelpProgressParentId((id) =>
                                            id === task!.id ? null : task!.id
                                          )
                                        }}
                                      >
                                        <HelpCircle className="h-3 w-3" />
                                      </button>
                                    ) : null}
                                    {helpProgressParentId === task?.id && progressHelp ? (
                                      <div
                                        className="absolute end-0 top-full z-50 mt-0.5 inline-flex h-8 max-w-[min(42rem,90vw)] flex-row items-center gap-2 overflow-x-auto rounded border border-sky-200 bg-white px-2.5 shadow-md"
                                        dir="ltr"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-slate-700">
                                          {formatProgressRollupFormula(progressHelp)}
                                        </span>
                                        <button
                                          type="button"
                                          className="shrink-0 text-[11px] leading-none text-sky-700 hover:text-sky-900"
                                          aria-label="بستن"
                                          onClick={() => setHelpProgressParentId(null)}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : !task || !field.type || readOnly ? (
                                  <span
                                    className="block max-w-[150px] truncate text-[10px] text-slate-600 tabular-nums"
                                    title={
                                      field.type === 'date'
                                        ? formatScheduleDate(
                                            value == null ? null : String(value),
                                            calendar
                                          )
                                        : String(value ?? '')
                                    }
                                  >
                                    {typeof value === 'boolean'
                                      ? value
                                        ? 'بله'
                                        : '—'
                                      : field.type === 'date'
                                        ? formatScheduleDate(
                                            value == null ? null : String(value),
                                            calendar
                                          )
                                        : String(value ?? '—')}
                                  </span>
                                ) : field.type === 'boolean' ? (
                                  <select
                                    value={value ? 'true' : 'false'}
                                    disabled={savingExtraCell === cellKey}
                                    className="h-7 w-full rounded border bg-white px-1 text-[10px]"
                                    onChange={(event) =>
                                      void saveExtraTaskField(
                                        task,
                                        field,
                                        event.target.value === 'true'
                                      )
                                    }
                                  >
                                    <option value="false">خیر</option>
                                    <option value="true">بله</option>
                                  </select>
                                ) : field.type === 'contractor' ? (
                                  isScheduleHeader(n, expandableIds) ? (
                                    <span className="text-slate-400">—</span>
                                  ) : (
                                  <select
                                    value={String(value ?? '')}
                                    disabled={savingExtraCell === cellKey}
                                    className="h-7 w-full rounded border bg-white px-1 text-[10px]"
                                    onChange={(event) =>
                                      void saveExtraTaskField(task, field, event.target.value)
                                    }
                                  >
                                    <option value="">
                                      {inheritedContractor
                                        ? inheritedContractor
                                        : 'بدون پیمانکار'}
                                    </option>
                                    {contractors.map((contractor) => (
                                      <option key={contractor.id} value={contractor.id}>
                                        {contractor.name}
                                      </option>
                                    ))}
                                  </select>
                                  )
                                ) : field.type === 'date' ? (
                                  <CompactScheduleDateField
                                    valueIso={value == null ? null : String(value)}
                                    calendar={calendar}
                                    disabled={savingExtraCell === cellKey}
                                    onCommit={(iso) =>
                                      void saveExtraTaskField(task, field, iso)
                                    }
                                  />
                                ) : (
                                  <input
                                    key={`${cellKey}:${String(value ?? '')}`}
                                    type={field.type === 'number' ? 'number' : 'text'}
                                    defaultValue={
                                      value == null
                                        ? ''
                                        : typeof value === 'number'
                                          ? value
                                          : String(value)
                                    }
                                    disabled={savingExtraCell === cellKey}
                                    className="h-7 w-full rounded border bg-white px-1 text-[10px]"
                                    onBlur={(event) => {
                                      const next =
                                        field.type === 'number'
                                          ? event.target.value === ''
                                            ? null
                                            : Number(event.target.value)
                                          : event.target.value
                                      const previous =
                                        value == null ? '' : String(value)
                                      if (String(next ?? '') !== previous) {
                                        void saveExtraTaskField(task, field, next)
                                      }
                                    }}
                                  />
                                )}
                              </td>
                            )
                          })}
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
                              extraFields={visibleExtraTaskFields}
                              contractors={contractors}
                              groupLast={isGroupLast}
                              calendar={calendar}
                              onPredClick={() =>
                                setPredDialog({
                                  kind: 'draft',
                                  id: 'inline',
                                  wbs: inlineDraft.previewWbs,
                                  name: inlineDraft.name || 'زیرشاخه جدید',
                                  label: inlineDraft.predecessorLabel,
                                })
                              }
                            />
                          )}
                      </FragmentRows>
                    )
                  }

                  const p = row.pkg
                  const isSel = selected?.kind === 'package' && selected.id === p.id
                  const open = Boolean(expanded[`pkg:${p.id}`])
                  const canEditPermission =
                    !readOnly &&
                    canEditWorkshopPackageRow(p.approvalStatus, p.origin ?? 'user_added')
                  const isRowEditing = canEditPermission && editingPackageId === p.id
                  const dateFallback = { start: row.startDate, finish: row.finishDate }
                  const e = getEdit(p, dateFallback)
                  const indentPx = 8 + row.depth * 22

                  return (
                    <FragmentRows key={`p-${p.id}`}>
                      <tr
                        onClick={() => {
                          setSelected({ kind: 'package', id: p.id, name: p.name, pkg: p })
                        }}
                        className={`group cursor-pointer border-b border-slate-300 hover:bg-emerald-50/50 ${groupFrameClass} ${
                          isSel ? 'bg-emerald-50' : 'bg-white'
                        }`}
                      >
                        <td
                          className={`${SCHEDULE_STICKY_WBS_CELL} font-mono text-[11px] tabular-nums text-emerald-800 text-center group-hover:bg-emerald-50/50 ${
                            isSel ? 'bg-emerald-50 group-hover:bg-emerald-50' : 'bg-white'
                          }`}
                          style={{ right: STICKY_WBS_RIGHT }}
                        >
                          {row.wbs}
                        </td>
                        <td
                          className={`${SCHEDULE_STICKY_NAME_CELL} group-hover:bg-emerald-50/50 ${
                            isSel ? 'bg-emerald-50 group-hover:bg-emerald-50' : 'bg-white'
                          }`}
                          style={{
                            right: STICKY_NAME_RIGHT,
                            boxShadow: STICKY_NAME_EDGE_SHADOW,
                          }}
                        >
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
                                className="relative z-20 p-0.5 rounded hover:bg-slate-200 shrink-0"
                                onClick={(ev) => {
                                  ev.preventDefault()
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
                                className="relative z-20 rounded p-1 text-emerald-700 hover:bg-emerald-100 shrink-0"
                                onClick={(ev) => {
                                  ev.preventDefault()
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
                            {canEditPermission && !isRowEditing && (
                              <button
                                type="button"
                                title="ویرایش"
                                className="rounded p-1 text-sky-700 hover:bg-sky-100"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  beginPackageEdit(p, dateFallback)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {isRowEditing && (
                              <button
                                type="button"
                                title="ذخیره مجدد فعالیت"
                                className="rounded p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                disabled={saving || !isDirty(p, dateFallback)}
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  void savePackage(p)
                                }}
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                            {isRowEditing ? (
                              <input
                                className="min-w-0 w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                                value={e.name}
                                onClick={(ev) => ev.stopPropagation()}
                                onChange={(ev) => setEditField(p.id, p, { name: ev.target.value })}
                              />
                            ) : (
                              <span className="min-w-0 flex-1 truncate text-xs">
                                {displayActivityName(p.name, p.wbs)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={SCHEDULE_CELL}>
                          <button
                            type="button"
                            dir="ltr"
                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-center font-mono hover:border-sky-400 hover:bg-sky-50"
                            title="باز کردن پنجره وابستگی مثل MSP"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setPredDialog({
                                kind: 'package',
                                id: p.id,
                                wbs: p.wbs?.trim() ?? '',
                                name: p.name,
                                label: isRowEditing
                                  ? e.predecessorLabel
                                  : packagePredecessorLabel(p),
                              })
                            }}
                          >
                            {(isRowEditing ? e.predecessorLabel : packagePredecessorLabel(p)) ||
                              '—'}
                          </button>
                        </td>
                        <td className={`${SCHEDULE_CELL} text-[11px] text-slate-500 tabular-nums leading-tight`}>
                          {p.children.length > 0 ? (
                            <ScheduleDatePair
                              startIso={envelopeForPackage(p).start}
                              finishIso={envelopeForPackage(p).finish}
                              calendar={calendar}
                              bold
                            />
                          ) : isRowEditing ? (
                            <CompactJalaliDateRange
                              startIso={e.startDate || null}
                              finishIso={e.finishDate || null}
                              calendar={calendar}
                              disabled={saving}
                              onCommit={(startDate, finishDate) => {
                                setEditField(p.id, p, { startDate, finishDate })
                                void (async () => {
                                  const next = {
                                    ...getEdit(p, dateFallback),
                                    startDate,
                                    finishDate,
                                  }
                                  setEdits((prev) => ({ ...prev, [p.id]: next }))
                                  setSaving(true)
                                  try {
                                    const res = await fetch(`/api/workshop/packages/${p.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        name: next.name,
                                        quantity: Number(next.quantity),
                                        quantityCertainty: next.quantityCertainty,
                                        unitPrice: Number(next.unitPrice) || 0,
                                        uom: next.uom,
                                        location: next.location,
                                        crew: next.crew,
                                        weightPercent: next.weightPercent.trim()
                                          ? Number(next.weightPercent)
                                          : null,
                                        startDate,
                                        finishDate,
                                      }),
                                    })
                                    const data = await res.json()
                                    if (!res.ok) throw new Error(data.error || 'ذخیره تاریخ ناموفق بود')
                                    const keepId = p.id
                                    await load()
                                    setEditingPackageId(keepId)
                                    setMessage('تاریخ ذخیره شد')
                                  } catch (err) {
                                    setMessage(
                                      err instanceof Error ? err.message : 'خطا در ذخیره تاریخ'
                                    )
                                  } finally {
                                    setSaving(false)
                                  }
                                })()
                              }}
                            />
                          ) : (
                            <ScheduleDatePair
                              startIso={row.startDate}
                              finishIso={row.finishDate}
                              calendar={calendar}
                            />
                          )}
                        </td>
                        <td className={`${SCHEDULE_CELL} text-center`}>
                          {canEditPermission ? (
                            <input
                              type="number"
                              step="0.5"
                              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] tabular-nums text-center"
                              value={isRowEditing ? e.totalFloat : packageTotalFloat(p)}
                              placeholder="—"
                              disabled={
                                readOnly ||
                                saving ||
                                savingExtraCell === `pkg:${p.id}:pred-float`
                              }
                              title="شناوری (روز)"
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => {
                                setEditField(p.id, p, { totalFloat: ev.target.value })
                              }}
                              onBlur={(ev) => {
                                const next = ev.target.value.trim()
                                if (next === packageTotalFloat(p)) return
                                if (isRowEditing) return
                                void savePackagePredFloat(p, { totalFloat: next })
                              }}
                            />
                          ) : (
                            <span className="tabular-nums text-[11px] text-slate-600">
                              {packageTotalFloat(p) || '—'}
                            </span>
                          )}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          {isRowEditing ? (
                            <input
                              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                              value={e.location}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) =>
                                setEditField(p.id, p, { location: ev.target.value })
                              }
                              placeholder="محل"
                            />
                          ) : (
                            p.location ?? '—'
                          )}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          {p.children.length > 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                          <div
                            className="flex items-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {canEditPermission ? (
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-xs tabular-nums text-center"
                                value={
                                  commercialInputs[p.id]?.quantity ?? String(p.quantity)
                                }
                                placeholder="مقدار"
                                disabled={
                                  readOnly || savingExtraCell === `pkg:${p.id}:quantity`
                                }
                                onChange={(event) => {
                                  setCommercialField(p.id, 'quantity', event.target.value, {
                                    unitPrice: String(Number(p.unitPrice) || 0),
                                  })
                                  if (isRowEditing) {
                                    setEditField(p.id, p, {
                                      quantity: event.target.value,
                                    })
                                  }
                                }}
                                onBlur={(event) => {
                                  const value = Number(event.target.value)
                                  if (!Number.isFinite(value) || value <= 0) {
                                    setCommercialField(p.id, 'quantity', String(p.quantity), {
                                      unitPrice: String(Number(p.unitPrice) || 0),
                                    })
                                    setMessage('مقدار باید بزرگ‌تر از صفر باشد')
                                    return
                                  }
                                  if (value !== Number(p.quantity)) {
                                    void savePackageQuantity(p, value)
                                  }
                                }}
                              />
                            ) : (
                              <span className="min-w-0 flex-1 text-center tabular-nums">
                                {p.quantity}
                              </span>
                            )}
                            <select
                              className="w-[52px] shrink-0 rounded border border-slate-200 bg-white px-0.5 py-0.5 text-[10px] text-center"
                              value={
                                isRowEditing ? e.quantityCertainty : p.quantityCertainty
                              }
                              disabled={
                                readOnly ||
                                savingExtraCell === `pkg:${p.id}:quantity_certainty`
                              }
                              onChange={(event) => {
                                const value = event.target.value as 'حدودی' | 'قطعی'
                                if (isRowEditing) {
                                  setEditField(p.id, p, { quantityCertainty: value })
                                } else {
                                  void savePackageQuantityCertainty(p, value)
                                }
                              }}
                            >
                              <option value="حدودی">حدودی</option>
                              <option value="قطعی">قطعی</option>
                            </select>
                          </div>
                          )}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          {p.children.length > 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <UomSelect
                              value={isRowEditing ? e.uom : p.uom}
                              disabled={readOnly || savingExtraCell === `pkg:${p.id}:uom`}
                              onChange={(value) => {
                                if (isRowEditing) {
                                  setEditField(p.id, p, { uom: value })
                                } else {
                                  void savePackageUom(p, value)
                                }
                              }}
                            />
                          )}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          {p.children.length > 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            (() => {
                              const qty = isRowEditing ? Number(e.quantity) : p.quantity
                              const unitPrice = isRowEditing
                                ? Number(e.unitPrice)
                                : p.unitPrice
                              const shown = displayTotalPrice(p.id, qty, unitPrice)
                              return (
                                <span
                                  className="inline-flex w-full items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs tabular-nums text-slate-800"
                                  title={shown.help}
                                >
                                  {shown.value}
                                </span>
                              )
                            })()
                          )}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          {(() => {
                            if (p.children.length > 0) {
                              return <span className="text-slate-400">—</span>
                            }
                            const shown = displayUnitPrice(p.id, p.unitPrice)
                            if (canEditPermission) {
                              return (
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-center text-xs tabular-nums"
                                  value={
                                    commercialInputs[p.id]?.unitPrice ??
                                    (isRowEditing ? e.unitPrice : String(p.unitPrice))
                                  }
                                  disabled={
                                    readOnly ||
                                    savingExtraCell === `pkg:${p.id}:unit_price`
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    setCommercialField(p.id, 'unitPrice', event.target.value, {
                                      quantity: String(p.quantity),
                                    })
                                    if (isRowEditing) {
                                      setEditField(p.id, p, {
                                        unitPrice: event.target.value,
                                      })
                                    }
                                  }}
                                  onBlur={(event) => {
                                    if (isRowEditing) return
                                    const value = Number(event.target.value)
                                    if (
                                      !Number.isFinite(value) ||
                                      value < 0 ||
                                      value === Number(p.unitPrice)
                                    ) {
                                      return
                                    }
                                    void (async () => {
                                      setSavingExtraCell(`pkg:${p.id}:unit_price`)
                                      try {
                                        const res = await fetch(
                                          `/api/workshop/packages/${p.id}`,
                                          {
                                            method: 'PATCH',
                                            headers: {
                                              'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({ unitPrice: value }),
                                          }
                                        )
                                        const data = await res.json()
                                        if (!res.ok) {
                                          throw new Error(
                                            data.error || 'ذخیره قیمت واحد ناموفق بود'
                                          )
                                        }
                                        await load()
                                        publishScheduleViewSync(projectId)
                                        setMessage(
                                          'قیمت واحد ذخیره شد — جمع سرشاخه بروزرسانی شد'
                                        )
                                      } catch (err) {
                                        setMessage(
                                          err instanceof Error
                                            ? err.message
                                            : 'ذخیره قیمت واحد ناموفق بود'
                                        )
                                      } finally {
                                        setSavingExtraCell(null)
                                      }
                                    })()
                                  }}
                                />
                              )
                            }
                            return <span className="tabular-nums">{shown.value}</span>
                          })()}
                        </td>
                        <td className={SCHEDULE_CELL}>
                          {isRowEditing ? (
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
                              placeholder="وزن"
                            />
                          ) : (
                            <span className="tabular-nums text-xs">
                              {p.weightPercent != null ? p.weightPercent : '—'}
                            </span>
                          )}
                        </td>
                        <td className={`${SCHEDULE_CELL} text-[11px]`}>{statusFa(p.status)}</td>
                        {visibleExtraTaskFields.map((field) => {
                          const packageFallback =
                            field.key === 'percent_complete'
                              ? (() => {
                                  const fields = p.scheduleFields ?? {}
                                  const physical = fields.physical_percent_complete
                                  const pct = fields.percent_complete
                                  if (physical != null && Number.isFinite(Number(physical))) {
                                    return Number(physical)
                                  }
                                  if (pct != null && Number.isFinite(Number(pct))) {
                                    return Number(pct)
                                  }
                                  return null
                                })()
                              : null
                          const value =
                            field.key === 'contractor'
                              ? p.subcontractorId
                              : field.key === 'percent_complete'
                                ? resolvePhysicalProgressPercent(
                                    p.id,
                                    packageFallback,
                                    supervisorProgressEntries
                                  )
                                : (p.scheduleFields ?? {})[field.key]
                          const cellKey = `pkg:${p.id}:${field.key}`
                          const inheritedName =
                            field.key === 'contractor' &&
                            !p.subcontractorId &&
                            p.resolvedSubcontractorId
                              ? contractors.find(
                                  (item) => item.id === p.resolvedSubcontractorId
                                )?.name
                              : null
                          return (
                            <td
                              key={field.key}
                              className={`${SCHEDULE_CELL} min-w-[112px] text-center`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {!field.type || field.key === 'percent_complete' ? (
                                <span
                                  className="text-[10px] text-slate-600 tabular-nums"
                                  title={
                                    field.key === 'percent_complete'
                                      ? 'از گزارش روزانه سرپرست کارگاه'
                                      : undefined
                                  }
                                >
                                  {field.key === 'percent_complete'
                                    ? value == null
                                      ? '0'
                                      : String(value)
                                    : 'خودکار'}
                                </span>
                              ) : field.type === 'contractor' ? (
                                p.children.length > 0 ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                <select
                                  value={String(value ?? '')}
                                  disabled={!canEditPermission || savingExtraCell === cellKey}
                                  className="h-7 w-full rounded border bg-white px-1 text-[10px]"
                                  onChange={(event) =>
                                    void savePackageExtraField(p, field, event.target.value)
                                  }
                                >
                                  <option value="">
                                    {inheritedName ?? 'بدون پیمانکار'}
                                  </option>
                                  {contractors.map((contractor) => (
                                    <option key={contractor.id} value={contractor.id}>
                                      {contractor.name}
                                    </option>
                                  ))}
                                </select>
                                )
                              ) : field.type === 'boolean' ? (
                                <select
                                  value={value ? 'true' : 'false'}
                                  disabled={!canEditPermission || savingExtraCell === cellKey}
                                  className="h-7 w-full rounded border bg-white px-1 text-[10px]"
                                  onChange={(event) =>
                                    void savePackageExtraField(
                                      p,
                                      field,
                                      event.target.value === 'true'
                                    )
                                  }
                                >
                                  <option value="false">خیر</option>
                                  <option value="true">بله</option>
                                </select>
                              ) : field.type === 'date' ? (
                                <CompactScheduleDateField
                                  valueIso={value == null ? null : String(value)}
                                  calendar={calendar}
                                  disabled={!canEditPermission || savingExtraCell === cellKey}
                                  onCommit={(iso) =>
                                    void savePackageExtraField(p, field, iso)
                                  }
                                />
                              ) : (
                                <input
                                  key={`${cellKey}:${String(value ?? '')}`}
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  defaultValue={String(value ?? '')}
                                  disabled={!canEditPermission || savingExtraCell === cellKey}
                                  className="h-7 w-full rounded border bg-white px-1 text-[10px]"
                                  onBlur={(event) => {
                                    const next =
                                      field.type === 'number'
                                        ? event.target.value === ''
                                          ? null
                                          : Number(event.target.value)
                                        : event.target.value
                                    if (String(next ?? '') !== String(value ?? '')) {
                                      void savePackageExtraField(p, field, next)
                                    }
                                  }}
                                />
                              )}
                            </td>
                          )
                        })}
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
                            extraFields={visibleExtraTaskFields}
                            contractors={contractors}
                            groupLast={isGroupLast}
                            calendar={calendar}
                            onPredClick={() =>
                              setPredDialog({
                                kind: 'draft',
                                id: 'inline',
                                wbs: inlineDraft.previewWbs,
                                name: inlineDraft.name || 'زیرشاخه جدید',
                                label: inlineDraft.predecessorLabel,
                              })
                            }
                          />
                        )}
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div
            ref={bottomHScrollRef}
            className="sticky bottom-0 z-40 overflow-x-auto overflow-y-hidden border-t border-slate-300 bg-slate-200/95 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.18)] [scrollbar-width:thin]"
            style={{ height: 16 }}
            onScroll={() => syncHorizontalScroll('bottom')}
            aria-label="اسکرول افقی پایین جدول"
          >
            <div
              style={{ width: Math.max(tableScrollWidth, 1), height: 1 }}
              aria-hidden
            />
          </div>
        </section>
      <MspDependencyDialog
        open={Boolean(predDialog)}
        onClose={() => setPredDialog(null)}
        activityWbs={predDialog?.wbs ?? ''}
        activityName={predDialog?.name ?? ''}
        initialLabel={predDialog?.label ?? ''}
        activities={
          predDialog?.kind === 'task'
            ? mspActivities.filter((item) => item.kind === 'task')
            : mspActivities
        }
        successors={
          predDialog ? collectMspSuccessors(predDialog.wbs, mspPredItems) : []
        }
        readOnly={readOnly}
        saving={predDialogSaving}
        onSave={(label) => void savePredDialogLabel(label)}
      />
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
  extraFields,
  contractors,
  groupLast,
  calendar,
  onPredClick,
}: {
  draft: InlineDraft
  setDraft: (d: InlineDraft | null) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  extraFields: ExtraTaskField[]
  contractors: Array<{ id: string; name: string }>
  groupLast: boolean
  calendar: 'jalali' | 'gregorian'
  onPredClick?: () => void
}) {
  const canSave = draft.name.trim().length > 0 && Number(draft.quantity) > 0

  return (
    <tr
      className={`bg-sky-50/80 border-b border-sky-100 [&>td:first-child]:border-r-2 [&>td:first-child]:border-r-slate-500 [&>td:last-child]:border-l-2 [&>td:last-child]:border-l-slate-500 ${
        groupLast ? '[&>td]:border-b-2 [&>td]:border-b-slate-500' : ''
      }`}
    >
      <td
        className={`${SCHEDULE_STICKY_WBS_CELL} bg-sky-50 font-mono text-[11px] tabular-nums text-sky-800 font-semibold text-center`}
        style={{ right: STICKY_WBS_RIGHT }}
      >
        {draft.previewWbs}
      </td>
      <td
        className={`${SCHEDULE_STICKY_NAME_CELL} bg-sky-50`}
        style={{
          right: STICKY_NAME_RIGHT,
          boxShadow: STICKY_NAME_EDGE_SHADOW,
        }}
      >
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
      <td className={SCHEDULE_CELL}>
        <button
          type="button"
          dir="ltr"
          className="h-7 w-full rounded border border-sky-200 bg-white px-1 text-center text-[10px] font-mono hover:border-sky-400"
          title="باز کردن پنجره وابستگی مثل MSP"
          onClick={(e) => {
            e.stopPropagation()
            onPredClick?.()
          }}
        >
          {draft.predecessorLabel || '—'}
        </button>
      </td>
      <td className={SCHEDULE_CELL}>
        <div className="flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
          <CompactScheduleDateField
            valueIso={draft.startDate || null}
            calendar={calendar}
            disabled={saving}
            className="h-7 min-w-0 flex-1 rounded border border-sky-200 bg-white px-1 text-[9px]"
            onCommit={(iso) => setDraft({ ...draft, startDate: iso ?? '' })}
          />
          <span className="shrink-0 text-[9px] text-slate-400">–</span>
          <CompactScheduleDateField
            valueIso={draft.finishDate || null}
            calendar={calendar}
            disabled={saving}
            className="h-7 min-w-0 flex-1 rounded border border-sky-200 bg-white px-1 text-[9px]"
            onCommit={(iso) => setDraft({ ...draft, finishDate: iso ?? '' })}
          />
        </div>
      </td>
      <td className={SCHEDULE_CELL}>
        <input
          type="number"
          step="0.5"
          className="h-7 w-full rounded border border-sky-200 bg-white px-1 text-center text-[10px]"
          value={draft.totalFloat}
          onChange={(event) => setDraft({ ...draft, totalFloat: event.target.value })}
          placeholder="شناوری"
        />
      </td>
      <td className={SCHEDULE_CELL}>
        <input
          className="w-full rounded border border-sky-200 bg-white px-1 py-0.5 text-xs"
          placeholder="محل"
          value={draft.location}
          onChange={(e) => setDraft({ ...draft, location: e.target.value })}
        />
      </td>
      <td className={SCHEDULE_CELL}>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="min-w-0 flex-1 rounded border border-sky-200 bg-white px-1 py-0.5 text-xs text-center"
            placeholder="مقدار *"
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
          />
          <select
            className="w-[50px] shrink-0 rounded border border-sky-200 bg-white px-0.5 py-0.5 text-[10px] text-center"
            value={draft.quantityCertainty}
            onChange={(event) =>
              setDraft({
                ...draft,
                quantityCertainty: event.target.value as 'حدودی' | 'قطعی',
              })
            }
          >
            <option value="حدودی">حدودی</option>
            <option value="قطعی">قطعی</option>
          </select>
        </div>
      </td>
      <td className={SCHEDULE_CELL}>
        <UomSelect
          value={draft.uom}
          onChange={(uom) => setDraft({ ...draft, uom })}
        />
      </td>
      <td className={SCHEDULE_CELL}>
        <span
          className="inline-flex w-full items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs tabular-nums text-slate-700"
          title={TOTAL_PRICE_HELP}
        >
          {quantityTimesUnitPrice(
            draft.quantity === '' ? null : Number(draft.quantity),
            draft.unitPrice === '' ? null : Number(draft.unitPrice)
          )}
        </span>
      </td>
      <td className={SCHEDULE_CELL}>
        <input
          type="number"
          min={0}
          step="1"
          className="w-full rounded border border-sky-200 bg-white px-1 py-0.5 text-center text-xs"
          placeholder="قیمت واحد"
          value={draft.unitPrice}
          onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })}
        />
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
        <div className="flex flex-wrap gap-1 items-center justify-center">
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
          {!canSave ? (
            <span className="text-[10px] text-rose-700">نام و مقدار الزامی</span>
          ) : null}
        </div>
      </td>
      {extraFields.map((field) => (
        <td key={field.key} className={`${SCHEDULE_CELL} min-w-[112px]`}>
          {field.key === 'percent_complete' ? (
            <span
              className="text-[10px] tabular-nums text-slate-600"
              title="آیتم جدید با پیشرفت صفر ثبت می‌شود تا سرپرست کارگاه بعداً وارد کند"
            >
              0
            </span>
          ) : !field.type ? (
            <span className="text-slate-400">خودکار</span>
          ) : field.type === 'contractor' ? (
            <select
              className="h-7 w-full rounded border border-sky-200 bg-white px-1 text-[10px]"
              value={draft.subcontractorId}
              onChange={(event) =>
                setDraft({ ...draft, subcontractorId: event.target.value })
              }
            >
              <option value="">
                {contractors.find(
                  (contractor) => contractor.id === draft.inheritedSubcontractorId
                )?.name ?? 'بدون پیمانکار'}
              </option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          ) : field.type === 'boolean' ? (
            <select
              className="h-7 w-full rounded border border-sky-200 bg-white px-1 text-[10px]"
              value={draft.scheduleFields[field.key] ? 'true' : 'false'}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  scheduleFields: {
                    ...draft.scheduleFields,
                    [field.key]: event.target.value === 'true',
                  },
                })
              }
            >
              <option value="false">خیر</option>
              <option value="true">بله</option>
            </select>
          ) : field.type === 'date' ? (
            <CompactScheduleDateField
              valueIso={
                draft.scheduleFields[field.key] == null
                  ? null
                  : String(draft.scheduleFields[field.key])
              }
              calendar={calendar}
              disabled={saving}
              onCommit={(iso) =>
                setDraft({
                  ...draft,
                  scheduleFields: {
                    ...draft.scheduleFields,
                    [field.key]: iso ?? '',
                  },
                })
              }
            />
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              className="h-7 w-full rounded border border-sky-200 bg-white px-1 text-[10px]"
              value={String(draft.scheduleFields[field.key] ?? '')}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  scheduleFields: {
                    ...draft.scheduleFields,
                    [field.key]:
                      field.type === 'number'
                        ? event.target.value === ''
                          ? ''
                          : Number(event.target.value)
                        : event.target.value,
                  },
                })
              }
            />
          )}
        </td>
      ))}
    </tr>
  )
}

function CompactScheduleDateField({
  valueIso,
  calendar,
  disabled,
  onCommit,
  className,
}: {
  valueIso: string | null | undefined
  calendar: 'jalali' | 'gregorian'
  disabled?: boolean
  onCommit: (iso: string | null) => void
  className?: string
}) {
  const iso = toIsoDateOnly(valueIso) ?? ''
  const [text, setText] = useState(() => isoToCalendarInput(iso || null, calendar))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setText(isoToCalendarInput(iso || null, calendar))
    setInvalid(false)
  }, [iso, calendar])

  function commit() {
    const trimmed = text.trim()
    if (!trimmed) {
      setInvalid(false)
      if (iso) onCommit(null)
      else setText('')
      return
    }
    const parsed = parseScheduleDateInput(trimmed, calendar)
    if (!parsed) {
      setInvalid(true)
      setText(isoToCalendarInput(iso || null, calendar))
      return
    }
    setInvalid(false)
    setText(isoToCalendarInput(parsed, calendar))
    if (parsed !== iso) onCommit(parsed)
  }

  const placeholder = calendar === 'jalali' ? '1403/01/15' : '2026-04-21'

  return (
    <input
      type="text"
      inputMode="numeric"
      dir="ltr"
      disabled={disabled}
      placeholder={placeholder}
      title={calendar === 'jalali' ? 'تاریخ شمسی — مثال 1403/01/15' : 'تاریخ میلادی'}
      className={
        className ??
        `h-7 w-full rounded border bg-white px-1 text-[10px] text-center tabular-nums ${
          invalid ? 'border-rose-400' : 'border-slate-200'
        }`
      }
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
      }}
      onClick={(event) => event.stopPropagation()}
    />
  )
}

function ScheduleDatePair({
  startIso,
  finishIso,
  calendar,
  bold,
}: {
  startIso: string | null
  finishIso: string | null
  calendar: 'jalali' | 'gregorian'
  bold?: boolean
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center gap-0.5 tabular-nums',
        bold ? 'font-bold text-slate-900' : 'text-slate-600'
      )}
    >
      <span className="min-w-0 flex-1 text-center">
        {startIso ? formatScheduleDate(startIso, calendar) : '—'}
      </span>
      <span className="shrink-0 text-slate-400">–</span>
      <span className="min-w-0 flex-1 text-center">
        {finishIso ? formatScheduleDate(finishIso, calendar) : '—'}
      </span>
    </div>
  )
}

function CompactJalaliDateRange({
  startIso,
  finishIso,
  calendar,
  disabled,
  onCommit,
}: {
  startIso: string | null
  finishIso: string | null
  calendar: 'jalali' | 'gregorian'
  disabled?: boolean
  onCommit: (startDate: string, finishDate: string) => void
}) {
  const [startText, setStartText] = useState(() => isoToCalendarInput(startIso, calendar))
  const [finishText, setFinishText] = useState(() => isoToCalendarInput(finishIso, calendar))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setStartText(isoToCalendarInput(startIso, calendar))
    setFinishText(isoToCalendarInput(finishIso, calendar))
    setInvalid(false)
  }, [startIso, finishIso, calendar])

  function commit() {
    const start = parseScheduleDateInput(startText, calendar)
    const finish = parseScheduleDateInput(finishText, calendar)
    if (!start || !finish) {
      setInvalid(true)
      setStartText(isoToCalendarInput(startIso, calendar))
      setFinishText(isoToCalendarInput(finishIso, calendar))
      return
    }
    setInvalid(false)
    const s = start <= finish ? start : finish
    const f = start <= finish ? finish : start
    if (s === (startIso ?? '') && f === (finishIso ?? '')) {
      setStartText(isoToCalendarInput(s, calendar))
      setFinishText(isoToCalendarInput(f, calendar))
      return
    }
    onCommit(s, f)
  }

  const placeholder = calendar === 'jalali' ? '1403/01/15' : '2026-04-21'

  return (
    <div
      className="flex items-center justify-center gap-0.5 min-w-0 w-full"
      onClick={(e) => e.stopPropagation()}
      title={calendar === 'jalali' ? 'تاریخ شمسی — مثال 1403/01/15' : 'تاریخ میلادی'}
    >
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        disabled={disabled}
        placeholder={placeholder}
        className={`min-w-0 flex-1 rounded border bg-white px-0.5 py-0 text-[9px] h-6 leading-none tabular-nums text-center ${
          invalid ? 'border-rose-400' : 'border-slate-200'
        }`}
        value={startText}
        onChange={(e) => setStartText(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
      />
      <span className="shrink-0 text-[9px] text-slate-400">–</span>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        disabled={disabled}
        placeholder={placeholder}
        className={`min-w-0 flex-1 rounded border bg-white px-0.5 py-0 text-[9px] h-6 leading-none tabular-nums text-center ${
          invalid ? 'border-rose-400' : 'border-slate-200'
        }`}
        value={finishText}
        onChange={(e) => setFinishText(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
      />
    </div>
  )
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
