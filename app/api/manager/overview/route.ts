import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { assertManagerAccess, todayIsoTehran } from '@/lib/manager/access'
import { loadManagerOverview } from '@/lib/manager/load-manager-overview'
import { workshopErrorResponse } from '@/lib/workshop/service'

/** GET /api/manager/overview?projectId= — decision-focused summary for the manager dashboard. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const overview = await loadManagerOverview(
      supabase,
      createServiceClient(),
      projectId,
      todayIsoTehran()
    )
    return NextResponse.json(overview, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
