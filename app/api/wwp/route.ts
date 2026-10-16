/**
 * @file app/api/wwp/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/domain/errors, features/wwp/lib/service, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { createWeeklyPlan, listWeeklyPlans } from '@/features/wwp/lib/service'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** GET /api/wwp?projectId= — weekly work plans with their commitments (RLS: project members). */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')
    const plans = await listWeeklyPlans(createClient(), projectId)
    return NextResponse.json({ plans }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

/** POST /api/wwp { projectId, weekStart (Saturday), notes? } — new DRAFT plan (planner / site supervisor). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const plan = await createWeeklyPlan(createClient(), {
      projectId: String(body.projectId ?? ''),
      weekStart: String(body.weekStart ?? ''),
      notes: body.notes ?? null,
    })
    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
