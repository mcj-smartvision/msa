import type { SupabaseClient } from '@supabase/supabase-js'
import { accrueOverheadAsOf, buildLiveCostBreakdown } from '@/features/finance/lib/live-workshop-cost'
import { loadOverheadMonths } from '@/features/finance/lib/overhead-months'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import {
isLeafPackage,
isLeafTask,
taskBaselineDates,
} from '@/features/schedule/lib/leaf-activities'
import {
packageSchedulePhysicalPercent,
schedulePhysicalPercent,
} from '@/features/schedule/lib/physical-progress'
import { normalizeScheduleWeightPercent } from '@/features/schedule/lib/weighted-progress'
import {
checkProjectWeightTotal,
logWeightIssues,
resolveSiblingWeights,
type WeightIssue,
} from '@/features/schedule/lib/weight-consistency'
import { readPackageUnitPrice } from '@/features/workshop/lib/package-commercial'
import { resolvePackageWeight } from '@/features/workshop/lib/package-weight'
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
} from './rag-status'

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
  /** Weight-consistency problems found while resolving leaf weights; the numbers are still computed. */
  weightIssues: WeightIssue[]
  /** Leaf activities with a schedule weight or a budget (rows behind PV/EV/SPI and the cost EV). */
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

/**
 * Packages are scheduled inside their MSP activity, so their PV follows the parent activity's
 * frozen baseline. A package's own dates are used only when it has no parent activity.
 */
function packageBaselineDates(
  pkg: Row,
  packagesById: Map<string, Row>,
  tasksById: Map<string, Row>
): { start: string | null; finish: string | null } {
  let current: Row | undefined = pkg
  const seen = new Set<string>()
  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id))
    const task = current.project_task_id ? tasksById.get(String(current.project_task_id)) : null
    if (task) return taskBaselineDates(task)
    const parentPackageId = current.parent_package_id ? String(current.parent_package_id) : null
    if (!parentPackageId) break
    current = packagesById.get(parentPackageId)
  }
  const start = toIsoDateOnly((pkg.start_date as string) ?? null)
  const finish = toIsoDateOnly((pkg.finish_date as string) ?? null)
  return { start: start ?? finish, finish: finish ?? start }
}

/** «هزینه» column of the technical office schedule (MSP Cost, Toman). Summary rows are rollups and never read. */
function taskCost(row: Row | undefined): number {
  const cost = Number(row?.cost)
  return Number.isFinite(cost) && cost > 0 ? cost : 0
}

function taskWeight(row: Row | undefined): number {
  if (!row) return 0
  return normalizeScheduleWeightPercent(Number(row.physical_weight ?? row.schedule_weight))
}

/** Project-level (absolute) weight of every package, resolved one sibling group at a time. */
export function resolvePackageWeights(
  packages: Row[],
  tasksById: Map<string, Row>
): { weights: Map<string, number>; issues: WeightIssue[] } {
  const packagesById = new Map(packages.map((p) => [String(p.id), p]))
  const groupKey = (pkg: Row) =>
    pkg.parent_package_id ? `p:${String(pkg.parent_package_id)}` : `t:${String(pkg.project_task_id ?? '')}`
  const groups = new Map<string, Row[]>()
  for (const pkg of packages) {
    const key = groupKey(pkg)
    groups.set(key, [...(groups.get(key) ?? []), pkg])
  }

  const weights = new Map<string, number>()
  const issues: WeightIssue[] = []
  const resolvedGroups = new Set<string>()
  const resolving = new Set<string>()

  const weightOf = (id: string): number => {
    if (weights.has(id)) return weights.get(id)!
    const pkg = packagesById.get(id)
    if (!pkg || resolving.has(id)) return 0
    resolving.add(id)
    resolveGroup(groupKey(pkg))
    resolving.delete(id)
    return weights.get(id) ?? 0
  }

  const resolveGroup = (key: string) => {
    if (resolvedGroups.has(key)) return
    resolvedGroups.add(key)
    const members = groups.get(key) ?? []
    const parentId = key.slice(2) || null
    const parentPackage = key.startsWith('p:') && parentId ? packagesById.get(parentId) : undefined
    const parentTask = key.startsWith('t:') && parentId ? tasksById.get(parentId) : undefined
    const parentWeight = parentPackage ? weightOf(parentId!) : taskWeight(parentTask)
    const label = String((parentPackage ?? parentTask)?.name ?? '') || null
    const result = resolveSiblingWeights(parentWeight, members.map(resolvePackageWeight), { id: parentId, label })
    members.forEach((member, index) => weights.set(String(member.id), result.weights[index] ?? 0))
    if (result.issue) issues.push(result.issue)
  }

  for (const key of groups.keys()) resolveGroup(key)
  return { weights, issues }
}

export function buildActivities(
  tasks: Row[],
  packages: Row[],
  projectBudget: number | null
): {
  activities: Array<EvmActivity & EvmActivitySource>
  basis: EvmMetrics['budgetBasis']
  weightIssues: WeightIssue[]
} {
  const tasksById = new Map(tasks.map((t) => [String(t.id), t]))
  const packagesById = new Map(packages.map((p) => [String(p.id), p]))
  const packageWeights = resolvePackageWeights(packages, tasksById)

  const items: Array<Omit<EvmActivity, 'budget'> & EvmActivitySource & { contractValue: number; mspCost: number }> =
    []

  const leafPackages = packages.filter((row) => isLeafPackage(row, packages))
  const rootTaskOf = (pkg: Row): string | null => {
    const seen = new Set<string>()
    let current: Row | undefined = pkg
    while (current && !seen.has(String(current.id))) {
      seen.add(String(current.id))
      if (current.project_task_id) return String(current.project_task_id)
      current = current.parent_package_id ? packagesById.get(String(current.parent_package_id)) : undefined
    }
    return null
  }
  const packageGroups = new Map<string, Row[]>()
  for (const pkg of leafPackages) {
    const taskId = rootTaskOf(pkg)
    if (taskId) packageGroups.set(taskId, [...(packageGroups.get(taskId) ?? []), pkg])
  }
  /** A task's technical-office cost is split over its leaf packages by their resolved weight (equally if unweighted). */
  const packageCost = (pkg: Row): number => {
    const taskId = rootTaskOf(pkg)
    const group = taskId ? packageGroups.get(taskId) ?? [] : []
    const cost = taskCost(taskId ? tasksById.get(taskId) : undefined)
    if (!(cost > 0) || group.length === 0) return 0
    const weightOf = (p: Row) => packageWeights.weights.get(String(p.id)) ?? 0
    const groupWeight = group.reduce((s, p) => s + weightOf(p), 0)
    return groupWeight > 0 ? (cost * weightOf(pkg)) / groupWeight : cost / group.length
  }

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
      mspCost: taskCost(row),
      weight: taskWeight(row),
    })
  }

  for (const row of leafPackages) {
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
      mspCost: packageCost(row),
      weight: packageWeights.weights.get(String(row.id)) ?? 0,
    })
  }

  const totalIssue = checkProjectWeightTotal(items.map((item) => item.weight))
  const weightIssues = totalIssue ? [...packageWeights.issues, totalIssue] : packageWeights.issues

  const { basis, budgets } = resolveActivityBudgets(items, projectBudget)
  return {
    weightIssues,
    basis,
    activities: items.map(({ contractValue: _c, mspCost: _m, ...item }, index) => ({
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
  const { activities, basis, weightIssues } = buildActivities(tasks, packages, projectBudget)
  logWeightIssues(`project ${projectId}`, weightIssues)

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
    weightIssues,
    activities: breakdownActivities(
      activities.filter((a) => a.budget > 0 || a.weight > 0),
      metrics.asOf
    ).sort((a, b) => compareWbs(a.wbs, b.wbs)),
    costs: costs.filter((c) => c.date <= metrics.asOf),
  }
}
