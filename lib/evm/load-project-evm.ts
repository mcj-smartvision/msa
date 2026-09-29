import type { SupabaseClient } from '@supabase/supabase-js'
import { accrueOverheadAsOf, buildLiveCostBreakdown } from '@/lib/finance/live-workshop-cost'
import { loadOverheadMonths } from '@/lib/finance/overhead-months'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import {
  isLeafPackage,
  isLeafTask,
  taskBaselineDates,
} from '@/lib/schedule/leaf-activities'
import {
  packageSchedulePhysicalPercent,
  schedulePhysicalPercent,
} from '@/lib/schedule/physical-progress'
import {
  normalizeScheduleWeightPercent,
  packageProgressWeight,
} from '@/lib/schedule/weighted-progress'
import { readPackageUnitPrice } from '@/lib/workshop/package-commercial'
import { resolvePackageWeight } from '@/lib/workshop/package-weight'
import {
  breakdownActivities,
  computeEvmMetrics,
  resolveActivityBudgets,
  type EvmActivity,
  type EvmActivityBreakdown,
  type EvmCostEntry,
  type EvmMetrics,
} from './metrics'
import {
  evaluateRagStatus,
  summarizeFloatHealth,
  type FloatHealth,
  type RagResult,
} from './ragStatus'

type Row = Record<string, unknown>

/** Expense documents and vendor bills are stored in Rial; schedule prices are Toman. */
const RIAL_PER_TOMAN = 10

const COUNTED_DOCUMENT_STATUSES = ['finalized', 'corrected']

/** Where an activity's budget and progress were read from. */
export interface EvmActivitySource {
  kind: 'task' | 'package'
  wbs: string | null
  quantity: number
  unitPrice: number
  /** Project-level MSP weight (%), used only when the budget is spread by weight. */
  weight: number
}

export type ProjectEvmActivityRow = EvmActivityBreakdown & EvmActivitySource

export interface FloatTaskRef {
  name: string
  wbs: string | null
}

export interface ProjectEvmSnapshot {
  projectId: string
  metrics: EvmMetrics
  float: FloatHealth & {
    criticalTask: FloatTaskRef | null
    worstConsumptionTask: FloatTaskRef | null
  }
  rag: RagResult
  projectBudget: number | null
  /** Budgeted leaf activities whose PV/EV sum to the project totals. */
  activities: ProjectEvmActivityRow[]
  /** Cost records up to the as-of date that sum to AC. */
  costs: EvmCostEntry[]
}

function isMissingRelation(message: string | undefined): boolean {
  return /does not exist|schema cache|Could not find/i.test(message ?? '')
}

async function optionalRows(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<Row[]> {
  const { data, error } = await query
  if (error) {
    if (isMissingRelation(error.message)) return []
    throw new Error(error.message)
  }
  return (data ?? []) as Row[]
}

function packageBaselineDates(
  pkg: Row,
  packagesById: Map<string, Row>,
  tasksById: Map<string, Row>
): { start: string | null; finish: string | null } {
  let current: Row | undefined = pkg
  const seen = new Set<string>()
  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id))
    const start = toIsoDateOnly((current.start_date as string) ?? null)
    const finish = toIsoDateOnly((current.finish_date as string) ?? null)
    if (start || finish) return { start: start ?? finish, finish: finish ?? start }
    const parentPackageId = current.parent_package_id ? String(current.parent_package_id) : null
    if (parentPackageId) {
      current = packagesById.get(parentPackageId)
      continue
    }
    const task = current.project_task_id ? tasksById.get(String(current.project_task_id)) : null
    return task ? taskBaselineDates(task) : { start: null, finish: null }
  }
  return { start: null, finish: null }
}

function taskWeight(row: Row | undefined): number {
  if (!row) return 0
  return normalizeScheduleWeightPercent(Number(row.physical_weight ?? row.schedule_weight))
}

/** Project-level weight of a package: parent weight × its share (or an equal split). */
function packageEffectiveWeight(
  pkg: Row,
  packages: Row[],
  packagesById: Map<string, Row>,
  tasksById: Map<string, Row>,
  seen: Set<string> = new Set()
): number {
  const id = String(pkg.id)
  if (seen.has(id)) return 0
  seen.add(id)
  const parentPackageId = pkg.parent_package_id ? String(pkg.parent_package_id) : null
  const parent = parentPackageId ? packagesById.get(parentPackageId) : undefined
  const parentWeight = parent
    ? packageEffectiveWeight(parent, packages, packagesById, tasksById, seen)
    : taskWeight(pkg.project_task_id ? tasksById.get(String(pkg.project_task_id)) : undefined)
  const siblings = packages.filter((other) =>
    parentPackageId
      ? String(other.parent_package_id ?? '') === parentPackageId
      : !other.parent_package_id &&
        String(other.project_task_id ?? '') === String(pkg.project_task_id ?? '')
  ).length
  return packageProgressWeight(resolvePackageWeight(pkg), parentWeight, siblings)
}

function buildActivities(
  tasks: Row[],
  packages: Row[],
  projectBudget: number | null
): { activities: Array<EvmActivity & EvmActivitySource>; basis: EvmMetrics['budgetBasis'] } {
  const tasksById = new Map(tasks.map((t) => [String(t.id), t]))
  const packagesById = new Map(packages.map((p) => [String(p.id), p]))

  const items: Array<Omit<EvmActivity, 'budget'> & EvmActivitySource & { contractValue: number }> =
    []

  for (const row of tasks) {
    if (!isLeafTask(row, tasks, packages)) continue
    const dates = taskBaselineDates(row)
    const quantity = Number(row.quantity) || 0
    const unitPrice = Number(row.unit_price) || 0
    items.push({
      id: String(row.id),
      name: String(row.name ?? ''),
      kind: 'task',
      wbs: row.wbs_code ? String(row.wbs_code) : null,
      baselineStart: dates.start,
      baselineFinish: dates.finish,
      physicalPercent: schedulePhysicalPercent(row) ?? 0,
      quantity,
      unitPrice,
      contractValue: quantity * unitPrice,
      weight: taskWeight(row),
    })
  }

  for (const row of packages) {
    if (!isLeafPackage(row, packages)) continue
    const fields =
      row.schedule_fields && typeof row.schedule_fields === 'object'
        ? (row.schedule_fields as Row)
        : {}
    const dates = packageBaselineDates(row, packagesById, tasksById)
    const quantity = Number(row.quantity) || 0
    const unitPrice = readPackageUnitPrice(row)
    items.push({
      id: String(row.id),
      name: String(row.name ?? ''),
      kind: 'package',
      wbs: row.wbs_code ? String(row.wbs_code) : null,
      baselineStart: dates.start,
      baselineFinish: dates.finish,
      physicalPercent: packageSchedulePhysicalPercent(fields) ?? 0,
      quantity,
      unitPrice,
      contractValue: quantity * unitPrice,
      weight: packageEffectiveWeight(row, packages, packagesById, tasksById),
    })
  }

  const { basis, budgets } = resolveActivityBudgets(items, projectBudget)
  return {
    basis,
    activities: items.map(({ contractValue: _c, ...item }, index) => ({
      ...item,
      budget: budgets[index] ?? 0,
    })),
  }
}

function wbsSortKey(wbs: string | null): number[] {
  return (wbs ?? '').split('.').map((part) => Number(part) || 0)
}

function compareWbs(a: string | null, b: string | null): number {
  const ka = wbsSortKey(a)
  const kb = wbsSortKey(b)
  for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
    const diff = (ka[i] ?? -1) - (kb[i] ?? -1)
    if (diff !== 0) return diff
  }
  return 0
}

async function loadCosts(
  service: SupabaseClient,
  projectId: string,
  asOfIso: string,
  todayIso: string
): Promise<EvmCostEntry[]> {
  const [documents, bills, overheadMonths] = await Promise.all([
    optionalRows(
      service
        .from('accounting_documents')
        .select('document_date, document_no, status, expense_items(amount)')
        .eq('project_id', projectId)
        .in('status', COUNTED_DOCUMENT_STATUSES)
        .lte('document_date', asOfIso)
    ),
    optionalRows(
      service
        .from('vendor_bills')
        .select('bill_date, amount, vendor_name')
        .eq('project_id', projectId)
        .lte('bill_date', asOfIso)
    ),
    loadOverheadMonths(service, projectId),
  ])

  const costs: EvmCostEntry[] = []

  for (const doc of documents) {
    const items = Array.isArray(doc.expense_items) ? (doc.expense_items as Row[]) : []
    const rial = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    if (rial > 0) {
      costs.push({
        source: 'expense',
        date: String(doc.document_date),
        amount: rial / RIAL_PER_TOMAN,
        label: doc.document_no ? `سند ${doc.document_no}` : 'سند بدون شماره',
        note: `${Math.round(rial).toLocaleString('en-US')} ریال ÷ ${RIAL_PER_TOMAN}`,
      })
    }
  }

  for (const bill of bills) {
    const rial = Number(bill.amount) || 0
    if (rial > 0) {
      costs.push({
        source: 'vendor_bill',
        date: String(bill.bill_date),
        amount: rial / RIAL_PER_TOMAN,
        label: String(bill.vendor_name ?? 'تأمین‌کننده'),
        note: `${Math.round(rial).toLocaleString('en-US')} ریال ÷ ${RIAL_PER_TOMAN}`,
      })
    }
  }

  if (asOfIso >= todayIso) {
    for (const row of buildLiveCostBreakdown(overheadMonths, todayIso, 0, 0)) {
      if (row.kind === 'contractor' || row.amount <= 0) continue
      costs.push({
        source: 'overhead',
        date: asOfIso,
        amount: row.amount,
        label: row.title,
        note: row.note,
      })
    }
  } else {
    const overhead = accrueOverheadAsOf(overheadMonths, asOfIso, todayIso)
    const overheadTotal = overhead.exact + overhead.estimated
    if (overheadTotal > 0) {
      costs.push({
        source: 'overhead',
        date: asOfIso,
        amount: overheadTotal,
        label: 'بالاسری کارگاه تا این تاریخ',
      })
    }
  }

  return costs.sort((a, b) => a.date.localeCompare(b.date))
}

async function loadFloatHealth(
  service: SupabaseClient,
  projectId: string
): Promise<FloatHealth> {
  const [current, history] = await Promise.all([
    optionalRows(
      service
        .from('schedule_calculations')
        .select('task_id, total_float, is_critical')
        .eq('project_id', projectId)
    ),
    optionalRows(
      service
        .from('float_history')
        .select('task_id, total_float, calculated_at')
        .eq('project_id', projectId)
        .order('calculated_at', { ascending: true })
    ),
  ])

  const initial = new Map<string, number>()
  for (const row of history) {
    const taskId = String(row.task_id)
    if (!initial.has(taskId)) initial.set(taskId, Number(row.total_float))
  }

  return summarizeFloatHealth(
    current.map((row) => ({
      taskId: String(row.task_id),
      totalFloat: Number(row.total_float),
      isCritical: Boolean(row.is_critical),
    })),
    initial
  )
}

/**
 * `service` must be a service-role client: cost tables are readable only by accountants
 * under RLS, and the caller is responsible for authorizing project access first.
 */
export async function loadProjectEvm(
  service: SupabaseClient,
  projectId: string,
  options: { asOf: string; today: string }
): Promise<ProjectEvmSnapshot> {
  const [tasks, packages, project] = await Promise.all([
    optionalRows(service.from('project_tasks').select('*').eq('project_id', projectId)),
    optionalRows(service.from('workshop_packages').select('*').eq('project_id', projectId)),
    service.from('projects').select('budget').eq('id', projectId).maybeSingle(),
  ])

  const projectBudget = project.data?.budget != null ? Number(project.data.budget) : null
  const { activities, basis } = buildActivities(tasks, packages, projectBudget)

  const [costs, float] = await Promise.all([
    loadCosts(service, projectId, options.asOf, options.today),
    loadFloatHealth(service, projectId),
  ])

  const metrics = computeEvmMetrics({
    activities,
    costs,
    asOf: options.asOf,
    budgetBasis: basis,
  })

  const rag = evaluateRagStatus({
    spi: metrics.spi,
    cpi: metrics.cpi,
    criticalFloatDays: float.criticalFloatDays,
    floatConsumptionPercent: float.floatConsumptionPercent,
  })

  const tasksById = new Map(tasks.map((t) => [String(t.id), t]))
  const taskRef = (id: string | null): FloatTaskRef | null => {
    const row = id ? tasksById.get(id) : undefined
    return row
      ? { name: String(row.name ?? ''), wbs: row.wbs_code ? String(row.wbs_code) : null }
      : null
  }

  return {
    projectId,
    metrics,
    float: {
      ...float,
      criticalTask: taskRef(float.criticalTaskId),
      worstConsumptionTask: taskRef(float.worstConsumptionTaskId),
    },
    rag,
    projectBudget,
    activities: breakdownActivities(
      activities.filter((a) => a.budget > 0),
      metrics.asOf
    ).sort((a, b) => compareWbs(a.wbs, b.wbs)),
    costs: costs.filter((c) => c.date <= metrics.asOf),
  }
}
