/**
 * @file features/project-store/lib/snapshot-types.ts
 * @purpose تعاریف نوع — ذخیره پیشرفت و overlay اعداد داشبورد (snapshot-types)
 * @safe-to-edit YES
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on features/evm/lib/metrics, features/evm/lib/load-project-evm, features/holidays/lib/types, features/schedule/lib/week-commitment-windows, features/supervisor/lib/daily-report-activities, features/workshop/lib/types
 */

import type { EvmBudgetBasis, EvmCostEntry } from '@/features/evm/lib/metrics'
import type { ProjectEvmActivityRow } from '@/features/evm/lib/load-project-evm'
import type { Holiday } from '@/features/holidays/lib/types'
import type { WindowChange } from '@/features/schedule/lib/week-commitment-windows'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import type { RncRow } from './load-rnc'

/** Cost side of the snapshot; only for users who may see the manager dashboard. */
export interface ProjectSnapshotEvm {
  /** Leaf activities with budget, weight, baseline and stored physical percent (raw task / package ids). */
  activities: ProjectEvmActivityRow[]
  /** Cost records up to today that sum to AC. */
  costs: EvmCostEntry[]
  budgetBasis: EvmBudgetBasis
}

/** Everything the project store derives its tasks and indices from, in one response. */
export interface ProjectSnapshot {
  projectId: string
  today: string
  generatedAt: string
  tree: { nodes: ScheduleTreeNode[]; orphanPackages: WorkshopPackageNode[] }
  /** Saved daily-report percents (cumulative at the end of each day). */
  history: DailyProgressEntry[]
  /** Days each activity's commitment window changes (progress forecast). */
  windows: WindowChange[]
  holidays: Holiday[]
  evm: ProjectSnapshotEvm | null
  rnc: RncRow[]
  rncMissing: boolean
}
