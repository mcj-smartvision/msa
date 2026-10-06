import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createDailyPlan, listDailyPlans } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required', code: 'VALIDATION' }, { status: 400 })
    }
    const plans = await listDailyPlans(supabase, projectId)
    return NextResponse.json({ plans })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const projectId = String(body.projectId ?? body.project_id ?? '')
    const planDate = String(body.planDate ?? body.plan_date ?? '')
    if (!projectId || !planDate) {
      return NextResponse.json(
        { error: 'projectId and planDate are required', code: 'VALIDATION' },
        { status: 400 }
      )
    }
    const result = await createDailyPlan(supabase, {
      projectId,
      planDate,
      notes: body.notes,
      allowNotReadyOverride: Boolean(body.allowNotReadyOverride ?? body.allow_not_ready_override),
      overrideReason: body.overrideReason ?? body.override_reason,
      workOrders: body.workOrders ?? body.work_orders ?? [],
    })
    return NextResponse.json(result)
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
