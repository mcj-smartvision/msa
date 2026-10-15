import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { assertManagerAccess } from '@/features/manager/lib/access'
import { loadProjectSnapshot } from '@/features/project-store/lib/load-snapshot'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/**
 * GET /api/project-store/snapshot?projectId= — everything the client project store derives from.
 * Budgets and costs are included only for users with manager-dashboard access.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const withCosts = await assertManagerAccess(supabase, user.id, projectId).then(
      () => true,
      () => false
    )

    const snapshot = await loadProjectSnapshot(supabase, createServiceClient(), projectId, { withCosts })
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
