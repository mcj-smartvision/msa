import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createBlocker } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'
import type { BlockerType } from '@/features/site-ops/domain'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const blocker = await createBlocker(supabase, {
      projectId: String(body.projectId ?? body.project_id ?? ''),
      packageId: String(body.packageId ?? body.package_id ?? body.operationalTaskId ?? ''),
      planDate: body.planDate ?? body.plan_date,
      blockerType: (body.blockerType ?? body.blocker_type ?? 'other') as BlockerType,
      note: String(body.note ?? ''),
    })
    return NextResponse.json({ blocker })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
