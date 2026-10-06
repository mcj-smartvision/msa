import type { ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'
import type { ControlsSnapshot, PVCurvePoint, SnapshotField, WeeklyPlanCounts } from '@/shared/types/project-controls'
import { DAYS_PER_UNIT, solveEarnedSchedule } from '@/features/project-controls/lib/earned-schedule'
import { buildBaselinePVCurve } from '@/features/project-controls/lib/pv-curve'
import { todayTehranIso } from '@/shared/lib/time/tehran'

const DAY_MS = 86_400_000

export const SNAPSHOT_SOURCES = {
  schedule: 'برنامهٔ زمان‌بندی: project_tasks و workshop_packages (baseline و درصد فیزیکی)',
  budget: 'بودجهٔ مبنا: مبلغ قرارداد یا بودجهٔ پروژه',
  cost: 'هزینه‌های واقعی ثبت‌شده (AC)',
  weeklyPlan: 'برنامهٔ هفتگی متعهد (WWP)',
} as const

export interface BuildControlsSnapshotInput {
  evm: ProjectEvmSnapshot
  /** Counts from the latest closed week of the committed weekly work plan. */
  weeklyPlan?: WeeklyPlanCounts | null
  /** Why `weeklyPlan` is absent (tables not installed, no closed week, …). */
  weeklyPlanMissingReason?: string
  periodUnit?: ControlsSnapshot['periodUnit']
  /** Inputs older than this many days are flagged stale. */
  staleAfterDays?: number
  now?: Date
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

function field<T>(value: T | null, source: string, asOf: string, reason_fa?: string, quality?: SnapshotField<T>['quality']): SnapshotField<T> {
  if (value == null) return { value: null, quality: quality ?? 'missing', source, asOf, reason_fa }
  return { value, quality: quality ?? 'ok', source, asOf, reason_fa }
}

export function buildControlsSnapshot(input: BuildControlsSnapshotInput): ControlsSnapshot {
  const { evm } = input
  const m = evm.metrics
  const now = input.now ?? new Date()
  const today = todayTehranIso(now.getTime())
  const asOf = m.asOf
  const periodUnit = input.periodUnit ?? 'months'
  const daysPerUnit = DAYS_PER_UNIT[periodUnit]
  const staleAfter = input.staleAfterDays ?? 7
  const freshness: SnapshotField<number>['quality'] = daysBetween(asOf, today) > staleAfter ? 'stale' : 'ok'
  const S = SNAPSHOT_SOURCES

  const hasActivities = m.activityCount > 0 && evm.activities.length > 0
  const noActivities = 'هیچ فعالیت برگ با وزن یا بودجه در برنامهٔ زمان‌بندی وجود ندارد'

  const bac =
    m.budgetBasis === 'none'
      ? field<number>(null, S.budget, asOf, 'بودجهٔ مبنا (مبلغ قرارداد یا بودجهٔ پروژه) ثبت نشده است')
      : m.bac > 0
        ? field(m.bac, S.budget, asOf, undefined, freshness)
        : field<number>(null, S.budget, asOf, 'بودجهٔ مبنا صفر یا منفی است', 'invalid')

  const pv = hasActivities ? field(m.plannedPercent, S.schedule, asOf, undefined, freshness) : field<number>(null, S.schedule, asOf, noActivities)
  const ev = hasActivities ? field(m.earnedPercent, S.schedule, asOf, undefined, freshness) : field<number>(null, S.schedule, asOf, noActivities)
  const evCost =
    bac.value == null
      ? field<number>(null, S.budget, asOf, bac.reason_fa, bac.quality)
      : field(m.evAmount, S.budget, asOf, undefined, freshness)
  const ac = m.ac > 0 ? field(m.ac, S.cost, asOf, undefined, freshness) : field<number>(null, S.cost, asOf, 'هزینهٔ واقعی (AC) هنوز ثبت نشده است')
  const costDates = (evm.costs ?? [])
    .filter((c) => c.amount > 0 && c.date <= asOf)
    .map((c) => c.date.slice(0, 10))
    .sort()
  const lastCostDate = costDates.length
    ? field(costDates[costDates.length - 1]!, S.cost, asOf)
    : field<string>(null, S.cost, asOf, 'هیچ هزینهٔ واقعی تا تاریخ وضعیت ثبت نشده است')

  const basis = m.progressBasis
  const curve = hasActivities
    ? buildBaselinePVCurve(
        evm.activities.map((a) => ({
          weight: (basis === 'schedule_weight' ? a.weight : a.budget) ?? 0,
          baselineStart: a.baselineStart,
          baselineFinish: a.baselineFinish,
        })),
        daysPerUnit,
        { scaleTo: 100 }
      )
    : null
  const noCurve = 'هیچ فعالیتی با بودجه/وزن و تاریخ baseline وجود ندارد'
  const pvCurve = curve ? field(curve.points, S.schedule, asOf, undefined, freshness) : field<PVCurvePoint[]>(null, S.schedule, asOf, noCurve)
  const projectStart = curve ? field(curve.projectStartDate, S.schedule, asOf) : field<string>(null, S.schedule, asOf, noCurve)
  const baselineFinish = curve ? field(curve.baselineFinishDate, S.schedule, asOf) : field<string>(null, S.schedule, asOf, noCurve)
  const plannedDuration = curve ? field(curve.plannedDurationPeriods, S.schedule, asOf) : field<number>(null, S.schedule, asOf, noCurve)

  let actualTime: SnapshotField<number> = field<number>(null, S.schedule, asOf, noCurve)
  let earnedSchedule: SnapshotField<number> = field<number>(null, S.schedule, asOf, noCurve)
  if (curve) {
    const at = daysBetween(curve.projectStartDate, asOf) / daysPerUnit
    actualTime =
      at > 0
        ? field(at, S.schedule, asOf, undefined, freshness)
        : field<number>(null, S.schedule, asOf, `تاریخ وضعیت ${asOf} قبل از شروع مبنا ${curve.projectStartDate} یا برابر آن است`, 'invalid')
    earnedSchedule = ev.value != null ? field(solveEarnedSchedule(curve.points, ev.value, curve.plannedDurationPeriods).es, S.schedule, asOf, undefined, freshness) : field<number>(null, S.schedule, asOf, ev.reason_fa)
  }

  const wp = input.weeklyPlan
  // The last closed week is current until the following week has also ended.
  const weeklyFreshness: SnapshotField<WeeklyPlanCounts>['quality'] =
    wp && daysBetween(wp.weekEnd, today) > 7 + staleAfter ? 'stale' : 'ok'
  const weeklyPlan = !wp
    ? field<WeeklyPlanCounts>(
        null,
        S.weeklyPlan,
        asOf,
        input.weeklyPlanMissingReason ?? 'برنامهٔ هفتگی متعهد (WWP) هنوز در سامانه پیاده یا ثبت نشده است'
      )
    : wp.planned <= 0
      ? field<WeeklyPlanCounts>(null, S.weeklyPlan, wp.weekEnd, `در هفتهٔ ${wp.weekStart} تا ${wp.weekEnd} هیچ کاری متعهد نشده است`)
      : wp.completed < 0 || wp.completed > wp.planned
        ? field<WeeklyPlanCounts>(null, S.weeklyPlan, wp.weekEnd, 'تعداد کارهای تکمیل‌شده با تعداد کارهای متعهد سازگار نیست', 'invalid')
        : field(wp, S.weeklyPlan, wp.weekEnd, undefined, weeklyFreshness)

  return {
    projectId: evm.projectId,
    asOf,
    generatedAt: now.toISOString(),
    periodUnit,
    daysPerUnit,
    budgetBasis: m.budgetBasis,
    progressBasis: basis,
    bac,
    pv,
    ev,
    evCost,
    ac,
    lastCostDate,
    pvCurve,
    projectStart,
    baselineFinish,
    plannedDuration,
    actualTime,
    earnedSchedule,
    weeklyPlan,
    weightIssues: (evm.weightIssues ?? []).map((issue) => issue.message_fa),
  }
}
