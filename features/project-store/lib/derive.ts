import { breakdownActivities, computeEvmMetrics, plannedPercentAsOf, type EvmBudgetBasis } from '@/features/evm/lib/metrics'
import { siteWorkCalendar } from '@/features/holidays/lib/work-calendar'
import { buildCostPerformance, type CostPerformance } from '@/features/manager/lib/cost-performance'
import { scheduleForecast } from '@/features/manager/lib/progress-curve'
import { groupWindows, type ActivityWindows } from '@/features/schedule/lib/week-commitment-windows'
import {
buildDailyReportActivitiesFromTree,
type DailyProgressEntry,
type DailyReportActivity,
} from '@/features/supervisor/lib/daily-report-activities'
import { latestReport, siteWeekStart } from '@/features/supervisor/lib/weekly-activity-progress'
import type { TaskItem } from './schema'
import type { ProjectSnapshot } from './snapshot-types'
import {
activityWeek,
addDays,
dailyLogsOf,
isEvaluationOpen,
round2,
SITE_WEEK_DAYS,
type ActivityWeek,
type CommitmentActivityInput,
type WeekPpc,
} from './weekly-engine'

/** EVM activity ids are raw task / package ids; the store keys by daily-report activity id. */
export const evmActivityKey = (a: { id: string; kind: 'task' | 'package' }) => `${a.kind === 'task' ? 'schedule' : 'package'}:${a.id}`

export interface DeriveContext {
  activities: DailyReportActivity[]
  windows: ActivityWindows
  isWorkday: (iso: string) => boolean
  rnc: Map<string, { category: string; note: string | null }>
}

export function deriveContext(snapshot: ProjectSnapshot): DeriveContext {
  return {
    activities: buildDailyReportActivitiesFromTree(snapshot.tree.nodes, snapshot.tree.orphanPackages),
    windows: groupWindows(snapshot.windows),
    isWorkday: siteWorkCalendar(snapshot.holidays),
    rnc: new Map(snapshot.rnc.map((r) => [`${r.activityId}@${r.weekStart}`, { category: r.category, note: r.note }])),
  }
}

export function commitmentInput(a: DailyReportActivity): CommitmentActivityInput {
  return {
    id: a.id,
    approved: {
      start: a.approvedStartDate || a.plannedStartDate || null,
      finish: a.approvedFinishDate || a.plannedFinishDate || null,
    },
    baselinePercent: a.baselinePercentComplete ?? 0,
  }
}

/** Every activity's week (commitment, gain, score) for the week starting `weekStart`. */
export function weekOfAll(input: {
  ctx: DeriveContext
  entries: DailyProgressEntry[]
  weekStart: string
  today: string
  nowMs: number
}): Map<string, ActivityWeek> {
  const out = new Map<string, ActivityWeek>()
  for (const a of input.ctx.activities) {
    out.set(
      a.id,
      activityWeek({
        activity: commitmentInput(a),
        entries: input.entries,
        windows: input.ctx.windows,
        weekStart: input.weekStart,
        today: input.today,
        nowMs: input.nowMs,
        isWorkday: input.ctx.isWorkday,
      })
    )
  }
  return out
}

/** Standard task records from the snapshot and the effective progress history (saved + unsaved). */
export function deriveTasks(input: {
  snapshot: ProjectSnapshot
  ctx: DeriveContext
  entries: DailyProgressEntry[]
  unsyncedIds: Set<string>
  today: string
  nowMs: number
}): { order: string[]; byId: Record<string, TaskItem>; weekStart: string } {
  const { snapshot, ctx, entries, today } = input
  const weekStart = siteWeekStart(today)
  const weeks = weekOfAll({ ctx, entries, weekStart, today, nowMs: input.nowMs })
  const evmById = new Map((snapshot.evm?.activities ?? []).map((a) => [evmActivityKey(a), a]))

  const order: string[] = []
  const byId: Record<string, TaskItem> = {}
  for (const a of ctx.activities) {
    const evm = evmById.get(a.id)
    const baselinePercent = a.baselinePercentComplete ?? 0
    const last = latestReport(a.id, entries)
    const week = weeks.get(a.id)!
    const baselineStart = evm?.baselineStart ?? a.baselineStartDate ?? a.plannedStartDate ?? null
    const baselineFinish = evm?.baselineFinish ?? a.baselineFinishDate ?? a.plannedFinishDate ?? null
    const reason = ctx.rnc.get(`${a.id}@${weekStart}`)
    byId[a.id] = {
      id: a.id,
      kind: a.kind,
      wbs: a.wbs ?? '',
      title: a.name,
      weight: round2(evm?.weight ?? a.progressWeight),
      planned_progress: round2(plannedPercentAsOf(baselineStart, baselineFinish, today)),
      actual_progress: round2(last?.percentComplete ?? baselinePercent),
      weekly_target: week.target,
      daily_logs: dailyLogsOf(a.id, entries, baselinePercent),
      weekly_actual_sum: week.actualSum,
      ppc_status: week.ppcStatus,
      ...(reason ? { rnc_reason: reason.category, rnc_note: reason.note ?? undefined } : {}),
      budget: evm ? round2(evm.budget) : null,
      baseline_start: baselineStart,
      baseline_finish: baselineFinish,
      window_start: week.window.start,
      window_finish: week.window.finish,
      last_report_date: last?.reportDate ?? null,
      unsynced: input.unsyncedIds.has(a.id),
    }
    order.push(a.id)
  }
  return { order, byId, weekStart }
}

/** PPC of the running week from the task records (each commitment scores 0 or 1). */
export function weeklyPpcOf(byId: Record<string, TaskItem>, weekStart: string, nowMs: number): WeekPpc {
  const provisional = !isEvaluationOpen(weekStart, nowMs)
  const committed = Object.values(byId).filter((t) => t.weekly_target > 0)
  const completed = committed.filter((t) => (provisional ? round2(t.weekly_actual_sum) >= t.weekly_target : t.ppc_status === 1)).length
  return {
    weekStart,
    weekEnd: addDays(weekStart, SITE_WEEK_DAYS - 1),
    committed: committed.length,
    completed,
    ppc: committed.length > 0 ? (completed / committed.length) * 100 : null,
    provisional,
  }
}

export interface EvmIndices {
  asOf: string
  budgetBasis: EvmBudgetBasis
  bac: number
  /** Schedule-weight basis: BAC × planned % and BAC × earned %. */
  pv: number
  ev: number
  /** Cost basis: Σ(budget × physical %), used by CV, CPI, TCPI and EAC. */
  evAmount: number
  ac: number
  sv: number
  cv: number
  spi: number | null
  cpi: number | null
  /** Earned Schedule (calendar days): ES ÷ AT. */
  spiT: number | null
  /** (BAC − EV) ÷ (BAC − AC) on the cost basis. */
  tcpi: number | null
  eac: number | null
  plannedPercent: number
  earnedPercent: number
  cost: CostPerformance
}

/**
 * EVM and Earned Schedule from the store's actual progress, with the same engines as the server
 * (computeEvmMetrics, scheduleForecast, buildCostPerformance), so the numbers match the dashboard.
 */
export function deriveEvmIndices(snapshot: ProjectSnapshot, byId: Record<string, TaskItem>, today: string): EvmIndices | null {
  const evm = snapshot.evm
  if (!evm) return null
  const activities = evm.activities.map((a) => {
    const task = byId[evmActivityKey(a)]
    // A never-reported package inherits its parent's percent in the daily report but keeps its own in EVM.
    return task && (task.last_report_date != null || task.unsynced) ? { ...a, physicalPercent: task.actual_progress } : a
  })
  const metrics = computeEvmMetrics({ activities, costs: evm.costs, asOf: today, budgetBasis: evm.budgetBasis })
  const forecast = scheduleForecast(breakdownActivities(activities, today), metrics.earnedPercent, today)
  const cost = buildCostPerformance({ bac: metrics.bac, ev: metrics.evAmount, ac: metrics.ac, budgetBasis: metrics.budgetBasis })
  return {
    asOf: metrics.asOf,
    budgetBasis: metrics.budgetBasis,
    bac: metrics.bac,
    pv: metrics.pv,
    ev: metrics.ev,
    evAmount: metrics.evAmount,
    ac: metrics.ac,
    sv: metrics.sv,
    cv: metrics.cv,
    spi: metrics.spi,
    cpi: metrics.cpi,
    spiT: forecast?.spiT ?? null,
    tcpi: cost.status === 'ok' ? cost.tcpi : null,
    eac: cost.status === 'ok' ? cost.eac : null,
    plannedPercent: metrics.plannedPercent,
    earnedPercent: metrics.earnedPercent,
    cost,
  }
}
