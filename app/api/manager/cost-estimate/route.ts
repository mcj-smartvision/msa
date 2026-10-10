import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { loadMemberPositionKeys, requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { assertManagerAccess, todayIsoTehran } from '@/features/manager/lib/access'
import { loadCostEstimateOverview } from '@/features/manager/lib/load-cost-estimate'
import { loadLiveCostInputs } from '@/features/finance/lib/load-live-cost-inputs'
import {
  buildBac,
  canEditCostEstimate,
  estimateIssues,
  estimateToRow,
  validateEstimate,
  wbsDirectCost,
} from '@/features/manager/lib/cost-estimate'
import { attachTraceHistory } from '@/features/calc-trace/lib/history'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

async function permissions(supabase: ReturnType<typeof createClient>, userId: string, projectId: string) {
  const [admin, keys] = await Promise.all([
    isSystemAdmin(supabase, userId),
    loadMemberPositionKeys(supabase, userId, projectId),
  ])
  return { admin, canEdit: canEditCostEstimate({ isSystemAdmin: admin, positionKeys: keys }) }
}

async function respond(
  supabase: ReturnType<typeof createClient>,
  service: ReturnType<typeof createServiceClient>,
  projectId: string,
  today: string,
  canEdit: boolean,
  admin: boolean
) {
  const overview = await loadCostEstimateOverview(supabase, service, projectId, today, canEdit, admin)
  if (overview.traces) await attachTraceHistory(service, projectId, overview.traces, today)
  return NextResponse.json(overview, { headers: NO_STORE })
}

/** GET /api/manager/cost-estimate?projectId= — estimate settings, BAC breakdown, EVM and alerts. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)
    const { admin, canEdit } = await permissions(supabase, user.id, projectId)
    return await respond(supabase, createServiceClient(), projectId, todayIsoTehran(), canEdit, admin)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

/**
 * PUT /api/manager/cost-estimate — save the settings. `approve: true` also approves the estimate;
 * when the estimate still has warnings, approval needs `acknowledgeWarnings: true` (409 otherwise).
 * Saving without approving clears an earlier approval, since the approved numbers have changed.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      projectId?: string
      settings?: Record<string, unknown>
      approve?: boolean
      acknowledgeWarnings?: boolean
    } | null
    const projectId = body?.projectId ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)
    const { admin, canEdit } = await permissions(supabase, user.id, projectId)
    if (!canEdit) {
      throw new SiteOpsError('FORBIDDEN', 'فقط مدیر پروژه می‌تواند تنظیمات مالی را تغییر دهد')
    }

    const validation = validateEstimate(body?.settings ?? {})
    if (validation.ok === false) {
      return NextResponse.json({ error: 'مقادیر واردشده معتبر نیست', fieldErrors: validation.errors }, { status: 400 })
    }

    const service = createServiceClient()
    const today = todayIsoTehran()
    const approve = body?.approve === true
    if (approve) {
      const inputs = await loadLiveCostInputs(service, projectId, today)
      const direct = wbsDirectCost(
        inputs.evm.basis,
        inputs.evm.activities.map((a) => ({
          id: a.id,
          kind: a.kind,
          wbs: a.wbs,
          name: a.name,
          quantity: a.quantity,
          unitPrice: a.unitPrice,
          budget: a.budget,
          weight: a.weight,
        }))
      )
      const warnings = estimateIssues(validation.value, direct, buildBac(validation.value, direct)).filter(
        (issue) => issue.level === 'warning'
      )
      if (warnings.length && body?.acknowledgeWarnings !== true) {
        return NextResponse.json(
          { error: 'پیش از تأیید، هشدارهای برآورد را بررسی کنید', issues: warnings },
          { status: 409 }
        )
      }
    }

    const now = new Date().toISOString()
    const { error } = await service.from('project_cost_estimates').upsert(
      {
        project_id: projectId,
        ...estimateToRow(validation.value),
        approved_at: approve ? now : null,
        approved_by: approve ? user.id : null,
        updated_by: user.id,
        updated_at: now,
      },
      { onConflict: 'project_id' }
    )
    if (error) {
      if (/does not exist|schema cache|Could not find/i.test(error.message)) {
        throw new SiteOpsError('VALIDATION', 'جدول برآورد هنوز ساخته نشده است (database/106-project-cost-estimates.sql را اجرا کنید)')
      }
      throw new SiteOpsError('VALIDATION', error.message)
    }

    return await respond(supabase, service, projectId, today, true, admin)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
