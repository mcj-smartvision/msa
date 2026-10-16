/**
 * @file app/api/schedule/week-commitments/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/auth, features/site-ops/domain/errors, features/schedule/lib/week-commitments, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { computeCommitmentWindows } from '@/features/schedule/lib/week-commitments'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/**
 * GET /api/schedule/week-commitments?projectId= — the days each activity's commitment window changes
 * (the progress forecast as it stood each morning), behind the daily report's required percents.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const windows = await computeCommitmentWindows(supabase, projectId)
    return NextResponse.json({ windows }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
