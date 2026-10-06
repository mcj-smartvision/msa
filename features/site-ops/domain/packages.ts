import { SiteOpsError } from './errors'
import { assertPermission, type SiteOpsRole } from './permissions'

export const PACKAGE_STATUSES = [
  'Draft',
  'Ready',
  'InProgress',
  'Partial',
  'Done',
  'Blocked',
] as const

export type PackageStatus = (typeof PACKAGE_STATUSES)[number]

export const PAYMENT_FLAGS = [
  'PaymentReady',
  'QuantityIncomplete',
  'NeedsChangeReview',
  'NotForPayment',
] as const

export type PaymentFlag = (typeof PAYMENT_FLAGS)[number]

export const BLOCKER_TYPES = [
  'material',
  'drawing',
  'access',
  'quantity_gap',
  'other',
] as const

export type BlockerType = (typeof BLOCKER_TYPES)[number]

export interface EnrichPackageInput {
  roles: SiteOpsRole[]
  category?: string | null
  locationText?: string | null
  plannedQty?: number | null
  uomText?: string | null
  crewText?: string | null
  opsStatus?: PackageStatus
}

export function enrichPackageFields(input: EnrichPackageInput) {
  assertPermission(input.roles, 'package.enrich')
  if (input.plannedQty != null && input.plannedQty < 0) {
    throw new SiteOpsError('VALIDATION', 'plannedQty must be non-negative')
  }
  return {
    category: input.category?.trim() || null,
    location_text: input.locationText?.trim() || null,
    planned_qty: input.plannedQty ?? null,
    uom_text: input.uomText?.trim() || null,
    crew_text: input.crewText?.trim() || null,
    ops_status: input.opsStatus ?? 'Ready',
  }
}

export function setPaymentFlag(params: {
  roles: SiteOpsRole[]
  flag: PaymentFlag
  reason?: string | null
  previousFlag?: PaymentFlag
}) {
  assertPermission(params.roles, 'package.payment_flag')
  if (
    (params.flag === 'QuantityIncomplete' || params.flag === 'NeedsChangeReview') &&
    !params.reason?.trim()
  ) {
    throw new SiteOpsError('VALIDATION', 'payment_flag_reason is required for risk flags')
  }
  if (
    params.flag === 'PaymentReady' &&
    (params.previousFlag === 'QuantityIncomplete' || params.previousFlag === 'NeedsChangeReview')
  ) {
    assertPermission(params.roles, 'package.payment_ready_from_incomplete')
  }
  return {
    payment_flag: params.flag,
    payment_flag_reason: params.reason?.trim() || null,
  }
}

/** Clean Done is blocked when payment risk flags are set unless PM acknowledged. */
export function assertCanMarkCleanDone(params: {
  paymentFlag: PaymentFlag
  pmRiskAcknowledged: boolean
  nextStatus: PackageStatus
}) {
  if (params.nextStatus !== 'Done') return
  if (
    (params.paymentFlag === 'QuantityIncomplete' || params.paymentFlag === 'NeedsChangeReview') &&
    !params.pmRiskAcknowledged
  ) {
    throw new SiteOpsError(
      'PAYMENT_RISK',
      'Cannot mark clean Done while payment flag is incomplete/needs review without PM acknowledgement'
    )
  }
}

export function validateChildRollup(params: {
  parentPlannedQty: number | null
  childrenPlannedQty: number[]
  tolerance?: number
}) {
  if (params.parentPlannedQty == null) {
    throw new SiteOpsError('VALIDATION', 'Parent planned quantity is required for rollup')
  }
  const sum = params.childrenPlannedQty.reduce((a, b) => a + b, 0)
  const tol = params.tolerance ?? 0.001
  if (Math.abs(sum - params.parentPlannedQty) > tol) {
    throw new SiteOpsError(
      'ROLLUP_MISMATCH',
      `Children qty sum (${sum}) must equal parent (${params.parentPlannedQty})`
    )
  }
  return { sum, parent: params.parentPlannedQty }
}

export function transitionPackageStatus(params: {
  roles: SiteOpsRole[]
  from: PackageStatus
  to: PackageStatus
  paymentFlag: PaymentFlag
  pmRiskAcknowledged: boolean
}) {
  assertPermission(params.roles, 'package.status')
  assertCanMarkCleanDone({
    paymentFlag: params.paymentFlag,
    pmRiskAcknowledged: params.pmRiskAcknowledged,
    nextStatus: params.to,
  })
  return { ops_status: params.to }
}

export function isExceptionFlag(flag: PaymentFlag): boolean {
  return flag === 'QuantityIncomplete' || flag === 'NeedsChangeReview'
}
