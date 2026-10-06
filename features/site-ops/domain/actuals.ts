import { SiteOpsError } from './errors'
import { assertPermission, type SiteOpsRole } from './permissions'
import type { DailyPlanStatus, WorkOrderStatus } from './plans'

export type ActualEntryStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface SubmitActualInput {
  roles: SiteOpsRole[]
  planStatus: DailyPlanStatus
  workOrderStatus: WorkOrderStatus
  snapshotUom: unknown
  actualQuantity: number
  actualUom?: unknown
  actualPersonDays: number
  namedCrewOrWorkers: boolean
  progressMethod?: string | null
  evidenceNotes?: string | null
  actualStart?: string | null
  actualFinish?: string | null
}

function fieldValue(field: unknown): unknown {
  if (field && typeof field === 'object' && 'value' in (field as object)) {
    return (field as { value: unknown }).value
  }
  return field
}

function normalizeUom(uom: unknown): string | null {
  const v = fieldValue(uom)
  if (v == null || v === '') return null
  return String(v).trim().toLowerCase()
}

export function submitActual(input: SubmitActualInput): {
  status: 'SUBMITTED'
  actualQuantity: number
  actualPersonDays: number
} {
  assertPermission(input.roles, 'actual.submit')

  if (input.planStatus === 'LOCKED' || input.planStatus === 'CLOSED') {
    throw new SiteOpsError('PLAN_LOCKED', `Plan is ${input.planStatus}; actuals are closed`)
  }
  if (input.planStatus === 'DRAFT') {
    throw new SiteOpsError('VALIDATION', 'Issue the daily plan before submitting actuals')
  }
  if (input.workOrderStatus === 'CANCELLED') {
    throw new SiteOpsError('VALIDATION', 'Cannot submit actuals for a cancelled work order')
  }

  const snapUom = normalizeUom(input.snapshotUom)
  const actUom = input.actualUom != null ? normalizeUom(input.actualUom) : snapUom
  if (snapUom && actUom && snapUom !== actUom) {
    throw new SiteOpsError('UOM_MISMATCH', `Actual UOM ${actUom} does not match snapshot ${snapUom}`)
  }

  if (input.actualPersonDays > 0 && !input.namedCrewOrWorkers) {
    throw new SiteOpsError('CREW_REQUIRED', 'Person-day actuals require named crew/workers')
  }

  if (Number.isNaN(input.actualQuantity) || input.actualQuantity < 0) {
    throw new SiteOpsError('VALIDATION', 'actualQuantity must be a non-negative number')
  }
  if (Number.isNaN(input.actualPersonDays) || input.actualPersonDays < 0) {
    throw new SiteOpsError('VALIDATION', 'actualPersonDays must be a non-negative number')
  }

  return {
    status: 'SUBMITTED',
    actualQuantity: input.actualQuantity,
    actualPersonDays: input.actualPersonDays,
  }
}

export function approveActual(params: {
  roles: SiteOpsRole[]
  status: ActualEntryStatus
  approve: boolean
}): { status: 'APPROVED' | 'REJECTED' } {
  assertPermission(params.roles, 'actual.approve')
  if (params.status !== 'SUBMITTED') {
    throw new SiteOpsError('VALIDATION', `Cannot decide actual in status ${params.status}`)
  }
  return { status: params.approve ? 'APPROVED' : 'REJECTED' }
}

export function calcProductivity(actualQuantity: number, actualPersonDays: number): number | null {
  if (!(actualPersonDays > 0) || Number.isNaN(actualQuantity)) return null
  return actualQuantity / actualPersonDays
}

export function calcVariances(params: {
  plannedQuantity: number
  actualQuantity: number
  plannedPersonDays: number
  actualPersonDays: number
}) {
  return {
    qty_variance: params.actualQuantity - params.plannedQuantity,
    pd_variance: params.actualPersonDays - params.plannedPersonDays,
    productivity: calcProductivity(params.actualQuantity, params.actualPersonDays),
  }
}
