import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProjectEvm } from '@/features/evm/lib/load-project-evm'
import { loadHolidays } from '@/features/holidays/lib/load-holidays'
import { fetchProgressHistory } from '@/features/schedule/lib/progress-history'
import { computeCommitmentWindows } from '@/features/schedule/lib/week-commitments'
import { getScheduleTree } from '@/features/workshop/lib/service'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { loadCommitmentRnc } from './load-rnc'
import type { ProjectSnapshot } from './snapshot-types'

/**
 * The project store's single load: schedule tree, daily-report history, commitment windows, holidays and
 * RNCs for every project member; budgets and costs (EVM) only when `withCosts`. The caller authorizes.
 */
export async function loadProjectSnapshot(
  supabase: SupabaseClient,
  service: SupabaseClient,
  projectId: string,
  options: { withCosts: boolean }
): Promise<ProjectSnapshot> {
  const today = todayTehranIso()
  const [tree, history, windows, holidays, rnc, evm] = await Promise.all([
    getScheduleTree(supabase, projectId),
    fetchProgressHistory(service, projectId),
    computeCommitmentWindows(service, projectId, today),
    loadHolidays(service).catch(() => []),
    loadCommitmentRnc(service, projectId),
    options.withCosts ? loadProjectEvm(service, projectId, { asOf: today, today }) : Promise.resolve(null),
  ])
  return {
    projectId,
    today,
    generatedAt: new Date().toISOString(),
    tree: { nodes: tree.nodes, orphanPackages: tree.orphanPackages },
    history,
    windows,
    holidays,
    evm: evm ? { activities: evm.activities, costs: evm.costs, budgetBasis: evm.metrics.budgetBasis } : null,
    rnc: rnc.rows,
    rncMissing: rnc.missing,
  }
}
