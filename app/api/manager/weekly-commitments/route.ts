import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { assertManagerAccess } from '@/lib/manager/access'
import { loadWeeklyCommitments } from '@/lib/manager/load-weekly-commitments'
import { workshopErrorResponse } from '@/lib/workshop/service'

/** GET /api/manager/weekly-commitments?projectId= — PPC history, this week's commitments and RNC, or why they are missing. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const result = await loadWeeklyCommitments(createServiceClient(), projectId)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
