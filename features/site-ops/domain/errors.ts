export type SiteOpsErrorCode =
  | 'CRE_NOT_READY'
  | 'TASK_NOT_PROMOTABLE'
  | 'PLAN_LOCKED'
  | 'FORBIDDEN'
  | 'UOM_MISMATCH'
  | 'PERMIT_REQUIRED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'OVERRIDE_REASON_REQUIRED'
  | 'NO_PROMOTED_TASKS'
  | 'CREW_REQUIRED'
  | 'PAYMENT_RISK'
  | 'ROLLUP_MISMATCH'

export class SiteOpsError extends Error {
  readonly code: SiteOpsErrorCode
  readonly details?: unknown

  constructor(code: SiteOpsErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'SiteOpsError'
    this.code = code
    this.details = details
  }
}
