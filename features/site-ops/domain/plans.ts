import { SiteOpsError } from './errors'
import { assertPermission, type SiteOpsRole } from './permissions'
import { assertCanAutoGeneratePlan } from './promote'
import type { CreGate } from '@/features/cre-contract/lib'

export type DailyPlanStatus = 'DRAFT' | 'ISSUED' | 'LOCKED' | 'CLOSED'
export type WorkOrderStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED'

export interface GenerateDailyPlanInput {
  roles: SiteOpsRole[]
  planDate: string
  notes?: string
  latestGate: CreGate | null
  allowNotReadyOverride?: boolean
  overrideReason?: string
  promotedTaskCount: number
  workOrders: Array<{
    operationalTaskId: string
    plannedQuantity: number
    plannedPersonDays: number
    assignedCrewId: string | null
    location?: string | null
    shift?: string | null
    constraints?: string[]
  }>
}

export interface DailyPlanDraftResult {
  status: 'DRAFT'
  planDate: string
  notes: string | null
  overrideUsed: boolean
  overrideReason: string | null
  workOrders: Array<{
    operationalTaskId: string
    plannedQuantity: number
    plannedPersonDays: number
    assignedCrewId: string | null
    location: string | null
    shift: string | null
    constraints: string[]
    status: 'PLANNED'
  }>
}

export function generateDailyPlanDraft(input: GenerateDailyPlanInput): DailyPlanDraftResult {
  assertPermission(input.roles, 'plan.draft')

  if (input.promotedTaskCount < 1) {
    throw new SiteOpsError(
      'NO_PROMOTED_TASKS',
      'Daily plan requires at least one active promoted operational task'
    )
  }

  const override = Boolean(input.allowNotReadyOverride)
  if (input.latestGate) {
    assertCanAutoGeneratePlan(input.latestGate, override)
  }
  if (override && input.latestGate === 'NOT_CONTROL_READY') {
    assertPermission(input.roles, 'cre.force_promote')
    if (!input.overrideReason?.trim()) {
      throw new SiteOpsError('OVERRIDE_REASON_REQUIRED', 'Override reason required when CRE is not ready')
    }
  }

  if (input.workOrders.length < 1) {
    throw new SiteOpsError('VALIDATION', 'At least one work order is required')
  }

  return {
    status: 'DRAFT',
    planDate: input.planDate,
    notes: input.notes?.trim() || null,
    overrideUsed: override && input.latestGate === 'NOT_CONTROL_READY',
    overrideReason:
      override && input.latestGate === 'NOT_CONTROL_READY' ? input.overrideReason!.trim() : null,
    workOrders: input.workOrders.map((wo) => ({
      operationalTaskId: wo.operationalTaskId,
      plannedQuantity: wo.plannedQuantity,
      plannedPersonDays: wo.plannedPersonDays,
      assignedCrewId: wo.assignedCrewId,
      location: wo.location ?? null,
      shift: wo.shift ?? null,
      constraints: wo.constraints ?? [],
      status: 'PLANNED' as const,
    })),
  }
}

export function issueDailyPlan(params: {
  roles: SiteOpsRole[]
  status: DailyPlanStatus
  workOrderCount: number
}): { status: 'ISSUED' } {
  assertPermission(params.roles, 'plan.issue')
  if (params.status !== 'DRAFT') {
    throw new SiteOpsError('PLAN_LOCKED', `Cannot issue plan in status ${params.status}`)
  }
  if (params.workOrderCount < 1) {
    throw new SiteOpsError('VALIDATION', 'Cannot issue a plan with no work orders')
  }
  return { status: 'ISSUED' }
}

export function closeDailyPlan(params: {
  roles: SiteOpsRole[]
  status: DailyPlanStatus
  supervisorSignedOff: boolean
}): { status: 'CLOSED' } {
  assertPermission(params.roles, 'plan.close')
  if (params.status !== 'ISSUED' && params.status !== 'LOCKED') {
    throw new SiteOpsError('PLAN_LOCKED', `Cannot close plan in status ${params.status}`)
  }
  if (!params.supervisorSignedOff) {
    throw new SiteOpsError('VALIDATION', 'Supervisor sign-off required to close the day')
  }
  return { status: 'CLOSED' }
}
