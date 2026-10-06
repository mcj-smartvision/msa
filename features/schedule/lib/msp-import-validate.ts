/**
 * MSP import pre-validation + summary report (بخش ۲ — مرحله ۱ و ۴).
 * Cycle detection reuses the system CPM graph (never trust file float).
 */

import { calculateCpm } from '@/features/schedule/lib/cpm-calculate'
import { isDirectChildWbs } from '@/features/schedule/lib/parent-weight-rollup'
import type { MspParsedDependency, MspParsedTask } from '@/features/schedule/lib/msp-import'

export type MspImportIssue = {
  code:
    | 'CYCLE'
    | 'PERCENT_LAG'
    | 'OPEN_END'
    | 'DUPLICATE_WBS'
    | 'WEIGHT_PARENT_MISMATCH'
    | 'WEIGHT_LEAF_TOTAL'
    | 'UNNAMED_RESOURCE'
  severity: 'error' | 'warning'
  message: string
  activityUids?: number[]
  activityNames?: string[]
  wbs?: string | null
  detail?: Record<string, unknown>
}

export type MspImportReport = {
  totalActivities: number
  milestoneCount: number
  summaryCount: number
  manuallyScheduledCount: number
  splitCount: number
  recurringMasterCount: number
  percentLagCount: number
  openEndCount: number
  duplicateWbsCount: number
  weightMismatchCount: number
  unnamedResourceCount: number
  hasCycle: boolean
  /** Hard stop — do not commit */
  blocked: boolean
  issues: MspImportIssue[]
  /** Human-readable Persian summary lines */
  summaryLines: string[]
}

function isLeaf(task: MspParsedTask, all: MspParsedTask[]): boolean {
  if (task.is_summary) return false
  const wbs = task.wbs_code?.trim()
  if (!wbs) return true
  return !all.some(
    (o) => o.msp_uid !== task.msp_uid && o.wbs_code && isDirectChildWbs(wbs, o.wbs_code)
  )
}

function weightOf(task: MspParsedTask): number {
  const w = task.physical_weight ?? task.schedule_weight
  return w != null && Number.isFinite(w) && w > 0 ? Number(w) : 0
}

/**
 * Run all pre-import checks. Mutates dependencies in-place for percent-lag flags.
 */
export function validateMspImport(
  tasks: MspParsedTask[],
  dependencies: MspParsedDependency[],
  options?: { unnamedResourceCount?: number }
): MspImportReport {
  const issues: MspImportIssue[] = []
  const byUid = new Map(tasks.map((t) => [t.msp_uid, t]))

  // --- Cycles (blocking) ---
  const cpmActivities = tasks
    .filter((t) => !t.is_summary)
    .map((t) => ({
      id: String(t.msp_uid),
      durationDays: Math.max(0, Number(t.duration_days) || 1),
      isSummary: false,
    }))
  // Cycle check includes all edges (structure); percent-lag edges are skipped later in CPM engine
  const cpmDepsAll = dependencies.map((d) => ({
    predecessorId: String(d.predecessor_uid),
    successorId: String(d.successor_uid),
    type: d.relation_type,
    lagDays: 0,
  }))
  const cycleResult = calculateCpm(
    cpmActivities.length ? cpmActivities : [{ id: '__empty__', durationDays: 0 }],
    cpmDepsAll
  )
  let hasCycle = false
  if (cycleResult.success === false && cycleResult.error === 'CYCLE_DETECTED') {
    hasCycle = true
    const names = (cycleResult.cycleIds ?? [])
      .map((id) => byUid.get(Number(id))?.name ?? id)
      .filter(Boolean)
    issues.push({
      code: 'CYCLE',
      severity: 'error',
      message: `حلقه در وابستگی‌ها پیدا شد — Import متوقف می‌شود: ${names.join(' ← ')}`,
      activityUids: (cycleResult.cycleIds ?? []).map(Number).filter((n) => Number.isFinite(n)),
      activityNames: names,
    })
  }

  // --- Percent lag ---
  let percentLagCount = 0
  for (const dep of dependencies) {
    if (!dep.lag_is_percentage) continue
    percentLagCount++
    const pred = byUid.get(dep.predecessor_uid)
    const succ = byUid.get(dep.successor_uid)
    issues.push({
      code: 'PERCENT_LAG',
      severity: 'warning',
      message: `رابطه با Lag درصدی: «${pred?.name ?? dep.predecessor_uid}» → «${succ?.name ?? dep.successor_uid}» — در CPM استفاده نمی‌شود`,
      activityUids: [dep.predecessor_uid, dep.successor_uid],
      activityNames: [pred?.name, succ?.name].filter(Boolean) as string[],
    })
  }

  // --- Open ends ---
  const successorCount = new Map<number, number>()
  for (const d of dependencies) {
    successorCount.set(d.predecessor_uid, (successorCount.get(d.predecessor_uid) ?? 0) + 1)
  }
  const leafs = tasks.filter((t) => isLeaf(t, tasks) && !t.is_milestone && !t.is_recurring_master)
  let maxFinish = ''
  for (const t of leafs) {
    const f = t.finish_planned ?? ''
    if (f > maxFinish) maxFinish = f
  }
  let openEndCount = 0
  for (const t of leafs) {
    const outs = successorCount.get(t.msp_uid) ?? 0
    if (outs > 0) continue
    // Last finishing leaf(s) are allowed open ends
    if (t.finish_planned && t.finish_planned === maxFinish) continue
    openEndCount++
    issues.push({
      code: 'OPEN_END',
      severity: 'warning',
      message: `شاخه بریده (بدون Successor): ${t.wbs_code ?? '—'} — ${t.name}`,
      activityUids: [t.msp_uid],
      activityNames: [t.name],
      wbs: t.wbs_code,
    })
  }

  // --- Duplicate WBS ---
  const wbsMap = new Map<string, MspParsedTask[]>()
  for (const t of tasks) {
    const w = t.wbs_code?.trim()
    if (!w) continue
    const list = wbsMap.get(w) ?? []
    list.push(t)
    wbsMap.set(w, list)
  }
  let duplicateWbsCount = 0
  for (const [wbs, list] of wbsMap) {
    if (list.length < 2) continue
    duplicateWbsCount++
    issues.push({
      code: 'DUPLICATE_WBS',
      severity: 'warning',
      message: `کد WBS تکراری «${wbs}»: ${list.map((t) => t.name).join('، ')}`,
      activityUids: list.map((t) => t.msp_uid),
      activityNames: list.map((t) => t.name),
      wbs,
    })
  }

  // --- Parent weight vs children ---
  let weightMismatchCount = 0
  for (const parent of tasks) {
    if (!parent.wbs_code?.trim()) continue
    const children = tasks.filter(
      (c) =>
        c.msp_uid !== parent.msp_uid &&
        c.wbs_code &&
        isDirectChildWbs(parent.wbs_code!, c.wbs_code)
    )
    if (children.length === 0) continue
    const parentW = weightOf(parent)
    const childSum = children.reduce((s, c) => s + weightOf(c), 0)
    if (parentW <= 0 && childSum <= 0) continue
    if (Math.abs(parentW - childSum) > 0.05) {
      weightMismatchCount++
      issues.push({
        code: 'WEIGHT_PARENT_MISMATCH',
        severity: 'warning',
        message: `وزن سرشاخه «${parent.wbs_code} ${parent.name}» = ${parentW} ولی جمع فرزندان = ${Math.round(childSum * 100) / 100}`,
        activityUids: [parent.msp_uid, ...children.map((c) => c.msp_uid)],
        activityNames: [parent.name, ...children.map((c) => c.name)],
        wbs: parent.wbs_code,
        detail: { parentWeight: parentW, childrenSum: childSum },
      })
    }
  }

  // --- Leaf weight total ≈ 100 ---
  const leafWeightSum = leafs
    .filter((t) => !t.is_recurring_master)
    .reduce((s, t) => s + weightOf(t), 0)
  const roundedLeaf = Math.round(leafWeightSum * 100) / 100
  if (leafs.some((t) => weightOf(t) > 0) && Math.abs(roundedLeaf - 100) > 0.05) {
    weightMismatchCount++
    issues.push({
      code: 'WEIGHT_LEAF_TOTAL',
      severity: 'warning',
      message: `جمع وزن فعالیت‌های leaf در کل پروژه ${roundedLeaf} است؛ باید ۱۰۰ باشد (اختلاف ${Math.round((100 - roundedLeaf) * 100) / 100})`,
      detail: { leafWeightSum: roundedLeaf },
    })
  }

  const unnamedResourceCount = options?.unnamedResourceCount ?? 0
  if (unnamedResourceCount > 0) {
    issues.push({
      code: 'UNNAMED_RESOURCE',
      severity: 'warning',
      message: `${unnamedResourceCount} فعالیت منبع بدون‌نام دارند (با placeholder ثبت می‌شوند)`,
      detail: { count: unnamedResourceCount },
    })
  }

  const milestoneCount = tasks.filter((t) => t.is_milestone).length
  const summaryCount = tasks.filter((t) => t.is_summary).length
  const manuallyScheduledCount = tasks.filter((t) => t.is_manual_scheduled).length
  const splitCount = tasks.filter((t) => t.has_split).length
  const recurringMasterCount = tasks.filter((t) => t.is_recurring_master).length

  const summaryLines = [
    `فعالیت: ${tasks.length} · مایلستون: ${milestoneCount} · سرشاخه: ${summaryCount}`,
    `دستی‌زمان‌بندی: ${manuallyScheduledCount} · شکافته: ${splitCount} · Recurring: ${recurringMasterCount}`,
    `Lag درصدی: ${percentLagCount} · شاخه بریده: ${openEndCount} · WBS تکراری: ${duplicateWbsCount}`,
    `ناسازگاری وزن: ${weightMismatchCount} · منبع بدون‌نام: ${unnamedResourceCount}`,
    hasCycle ? '⛔ حلقه وابستگی — Import متوقف می‌شود' : '✓ حلقه وابستگی یافت نشد',
  ]

  return {
    totalActivities: tasks.length,
    milestoneCount,
    summaryCount,
    manuallyScheduledCount,
    splitCount,
    recurringMasterCount,
    percentLagCount,
    openEndCount,
    duplicateWbsCount,
    weightMismatchCount,
    unnamedResourceCount,
    hasCycle,
    blocked: hasCycle,
    issues,
    summaryLines,
  }
}

/** Re-export helper used by validate (avoids circular import issues if moved). */
export { isDirectChildWbs }
