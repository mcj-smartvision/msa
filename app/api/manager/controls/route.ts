import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { assertManagerAccess } from '@/features/manager/lib/access'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { loadProjectControls } from '@/features/project-controls/lib/load-controls'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

const UNITS = ['days', 'weeks', 'months'] as const

/** GET /api/manager/controls?projectId=&unit=days|weeks|months&asOf= — ControlsSnapshot + every ExplainedKpi. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const projectId = params.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')
    const unit = params.get('unit') ?? 'months'
    if (!(UNITS as readonly string[]).includes(unit)) throw new SiteOpsError('VALIDATION', 'unit نامعتبر است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const controls = await loadProjectControls(createServiceClient(), projectId, {
      asOf: toIsoDateOnly(params.get('asOf')) ?? undefined,
      periodUnit: unit as (typeof UNITS)[number],
    })
    return NextResponse.json(controls, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
