import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { assertManagerAccess } from '@/features/manager/lib/access'
import { loadLatestClosedWeeklyPlan } from '@/features/project-controls/lib/load-weekly-plan'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** GET /api/manager/weekly-plan?projectId= — latest closed WWP week (PPC input), or why it is missing. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const result = await loadLatestClosedWeeklyPlan(createServiceClient(), projectId)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
