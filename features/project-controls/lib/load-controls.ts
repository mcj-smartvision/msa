import type { SupabaseClient } from '@supabase/supabase-js'
import type { ControlsSnapshot, ExplainedKpi } from '@/shared/types/project-controls'
import { getControlsSnapshot } from '@/features/project-controls/server/get-controls-snapshot'

export interface ProjectControls {
  snapshot: ControlsSnapshot
  kpis: Record<string, ExplainedKpi>
}

/**
 * Snapshot + KPIs only; the full input breakdown comes from `getControlsSnapshot`.
 * `service` must be a service-role client and the caller must have authorized project access.
 */
export async function loadProjectControls(
  service: SupabaseClient,
  projectId: string,
  options: { asOf?: string; periodUnit?: ControlsSnapshot['periodUnit']; now?: Date } = {}
): Promise<ProjectControls> {
  const { snapshot, kpis } = await getControlsSnapshot(projectId, options.asOf, {
    service,
    periodUnit: options.periodUnit,
    now: options.now,
  })
  return { snapshot, kpis }
}
