import { NextResponse } from 'next/server'
import { SiteOpsError } from '@/features/site-ops/domain/errors'

export function siteOpsErrorResponse(error: unknown) {
  if (error instanceof SiteOpsError) {
    const status =
      error.code === 'FORBIDDEN'
        ? 403
        : error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'CRE_NOT_READY' ||
              error.code === 'TASK_NOT_PROMOTABLE' ||
              error.code === 'PLAN_LOCKED' ||
              error.code === 'UOM_MISMATCH' ||
              error.code === 'OVERRIDE_REASON_REQUIRED' ||
              error.code === 'NO_PROMOTED_TASKS' ||
              error.code === 'CREW_REQUIRED' ||
              error.code === 'VALIDATION' ||
              error.code === 'PERMIT_REQUIRED' ||
              error.code === 'PAYMENT_RISK' ||
              error.code === 'ROLLUP_MISMATCH'
            ? 409
            : 400
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details ?? null },
      { status }
    )
  }

  const message = error instanceof Error ? error.message : 'Site ops error'
  return NextResponse.json({ error: message, code: 'VALIDATION' }, { status: 500 })
}
