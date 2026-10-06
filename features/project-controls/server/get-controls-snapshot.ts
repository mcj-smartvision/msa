import type { SupabaseClient } from '@supabase/supabase-js'
import type { ControlsSnapshot, PVCurvePoint, SnapshotField } from '@/shared/types/project-controls'
import { loadProjectEvm } from '@/features/evm/lib/load-project-evm'
import type { EvmCostSource } from '@/features/evm/lib/metrics'
import { buildControlsSnapshot } from '@/features/project-controls/lib/controls-snapshot'
import { buildAllKpis } from '@/features/project-controls/lib/kpis'
import { loadLatestClosedWeeklyPlan, type WeeklyPlanLoad } from '@/features/project-controls/lib/load-weekly-plan'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { todayTehranIso } from '@/shared/lib/time/tehran'

export interface BaselineTask {
  id: string
  name: string
  /** Absolute schedule weight (percent of project). */
  weight: number
  budget: number
  baselineStart: string | null
  baselineFinish: string | null
  /** Approved physical progress (0–100). */
  physicalPercent: number
  /** Baseline plan percent on the status date. */
  plannedPercent: number
}

export type ControlsKpis = ReturnType<typeof buildAllKpis>
export type ControlsKpiKey = keyof ControlsKpis

export interface ControlsSnapshotResult {
  projectId: string
  /** Status date (YYYY-MM-DD, Tehran). */
  statusDate: string
  baseline: {
    start: SnapshotField<string>
    finish: SnapshotField<string>
    progressBasis: ControlsSnapshot['progressBasis']
    pvCurve: SnapshotField<PVCurvePoint[]>
    tasks: BaselineTask[]
  }
  cost: {
    ac: SnapshotField<number>
    lastRecordedAt: SnapshotField<string>
    bySource: Record<EvmCostSource, number>
  }
  /** Latest closed WWP week, or why there is none (PPC never reads daily orders). */
  weeklyPlan: WeeklyPlanLoad
  snapshot: ControlsSnapshot
  kpis: ControlsKpis
}

/**
 * Server entry point of the explainable engine: reads the baseline, approved progress, actual
 * costs and the committed weekly plan, then builds the ControlsSnapshot and every KPI through
 * buildExplainedMetric. Uses a service-role client, so the caller must authorize project access.
 */
export async function getControlsSnapshot(
  projectId: string,
  asOfDate?: string,
  options: { service?: SupabaseClient; periodUnit?: ControlsSnapshot['periodUnit']; now?: Date } = {}
): Promise<ControlsSnapshotResult> {
  const service = options.service ?? createServiceClient()
  const now = options.now ?? new Date()
  const today = todayTehranIso(now.getTime())
  const [evm, weeklyPlan] = await Promise.all([
    loadProjectEvm(service, projectId, { asOf: asOfDate ?? today, today }),
    loadLatestClosedWeeklyPlan(service, projectId),
  ])

  const snapshot = buildControlsSnapshot({
    evm,
    weeklyPlan: weeklyPlan.status === 'ok' ? weeklyPlan.counts : null,
    weeklyPlanMissingReason: weeklyPlan.status === 'missing' ? weeklyPlan.reason_fa : undefined,
    periodUnit: options.periodUnit,
    now,
  })

  return {
    projectId,
    statusDate: snapshot.asOf,
    baseline: {
      start: snapshot.projectStart,
      finish: snapshot.baselineFinish,
      progressBasis: snapshot.progressBasis,
      pvCurve: snapshot.pvCurve,
      tasks: evm.activities.map((a) => ({
        id: a.id,
        name: a.name,
        weight: a.weight,
        budget: a.budget,
        baselineStart: a.baselineStart,
        baselineFinish: a.baselineFinish,
        physicalPercent: a.physicalPercent,
        plannedPercent: a.plannedPercent,
      })),
    },
    cost: { ac: snapshot.ac, lastRecordedAt: snapshot.lastCostDate, bySource: evm.metrics.acBySource },
    weeklyPlan,
    snapshot,
    kpis: buildAllKpis(snapshot),
  }
}
