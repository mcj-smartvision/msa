/**
 * @file features/project-store/lib/overview-overlay.ts
 * @purpose منطق دامنه — ذخیره پیشرفت و overlay اعداد داشبورد (overview-overlay)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on features/manager/lib/overview-types, features/manager/lib/weekly-commitments
 */

import type { ManagerOverview } from '@/features/manager/lib/overview-types'
import type { WeeklyCommitmentsData } from '@/features/manager/lib/weekly-commitments'
import type { EvmIndices } from './derive'
import type { TaskItem } from './schema'
import { round2, type WeekPpc } from './weekly-engine'

/**
 * Schedule-based PPC with this week's numbers taken from the project store (same weekly engine as
 * the server), so unsaved or just-saved supervisor reports show without reloading the dashboard.
 * Committed weekly work plans (`source: 'wwp'`) are left as they are.
 */
export function withStorePpc(
  data: WeeklyCommitmentsData | null,
  live: { ppc: WeekPpc; tasks: Record<string, TaskItem> } | null
): WeeklyCommitmentsData | null {
  if (!data || !live || data.source !== 'schedule' || live.ppc.committed === 0) return data
  const { ppc, tasks } = live
  const scored = { planned: ppc.committed, completed: ppc.completed, ppc: ppc.ppc, live: ppc.provisional }
  const current =
    data.current && data.current.start === ppc.weekStart
      ? {
          ...data.current,
          ...scored,
          commitments: data.current.commitments.map((c) => {
            const task = c.activityId ? tasks[c.activityId] : undefined
            if (!task || !(task.weekly_target > 0)) return c
            const met = ppc.provisional ? round2(task.weekly_actual_sum) >= task.weekly_target : task.ppc_status === 1
            return {
              ...c,
              completed: met,
              targetPercent: task.weekly_target,
              actualPercent: task.weekly_actual_sum,
              progressPercent: Math.min(100, Math.max(0, (task.weekly_actual_sum / task.weekly_target) * 100)),
            }
          }),
        }
      : data.current
  return {
    ...data,
    weeks: data.weeks.map((w) => (w.start === ppc.weekStart ? { ...w, ...scored } : w)),
    current,
  }
}

/**
 * The manager overview with its EVM indices taken from the project store, so the KPI strip, health
 * pillars, cost section and the S-curve's today point show the same SPI, CPI, SPI(t) and amounts as
 * every other view.
 * Values the store does not compute (float, RAG, forecast dates) stay as the server sent them.
 */
export function withStoreEvm(overview: ManagerOverview | null, evm: EvmIndices | null): ManagerOverview | null {
  if (!overview || !evm || overview.evm.status !== 'ok') return overview
  const server = overview.evm.data
  const progress =
    overview.progress.status === 'ok'
      ? {
          ...overview.progress,
          data: {
            ...overview.progress.data,
            points: overview.progress.data.points.map((p) =>
              p.isToday ? { ...p, planned: evm.plannedPercent, earned: evm.earnedPercent } : p
            ),
          },
        }
      : overview.progress
  return {
    ...overview,
    progress,
    evm: {
      ...overview.evm,
      data: {
        ...server,
        spi: evm.spi,
        cpi: evm.cpi,
        plannedPercent: evm.plannedPercent,
        earnedPercent: evm.earnedPercent,
        bac: evm.bac,
        pv: evm.pv,
        ev: evm.ev,
        evAmount: evm.evAmount,
        ac: evm.ac,
        sv: evm.sv,
        cv: evm.cv,
        budgetBasis: evm.budgetBasis,
        scheduleForecast: server.scheduleForecast ? { ...server.scheduleForecast, spiT: evm.spiT } : null,
      },
    },
  }
}
