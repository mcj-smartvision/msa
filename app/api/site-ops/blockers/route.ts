/**
 * @file app/api/site-ops/blockers/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/service, features/site-ops/lib/http, features/site-ops/domain
 */

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
