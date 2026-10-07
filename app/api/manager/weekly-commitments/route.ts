import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { assertManagerAccess } from '@/features/manager/lib/access'
import { loadScheduleCommitments } from '@/features/manager/lib/load-schedule-commitments'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/**
 * GET /api/manager/weekly-commitments?projectId= — PPC history and this week's commitments.
 * Commitments come from the schedule until committed weekly plans (loadWeeklyCommitments) are entered.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const result = await loadScheduleCommitments(supabase, createServiceClient(), projectId)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
