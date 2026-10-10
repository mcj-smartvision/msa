import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { assertManagerAccess, todayIsoTehran } from '@/features/manager/lib/access'
import { loadManagerOverview } from '@/features/manager/lib/load-manager-overview'
import { attachTraceHistory } from '@/features/calc-trace/lib/history'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** GET /api/manager/overview?projectId= — decision-focused summary for the manager dashboard. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)
    const admin = await isSystemAdmin(supabase, user.id)

    const service = createServiceClient()
    const today = todayIsoTehran()
    const overview = await loadManagerOverview(supabase, service, projectId, today, { withTraces: admin })
    if (overview.traces) await attachTraceHistory(service, projectId, overview.traces, today)
    return NextResponse.json(overview, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
