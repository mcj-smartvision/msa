/**
 * @file app/api/site-ops/cre-runs/[id]/promote/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/service, features/site-ops/lib/http
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { promoteRun } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json().catch(() => ({}))
    const result = await promoteRun(supabase, params.id, {
      force: Boolean(body.force),
      forceReason: body.forceReason ?? body.force_reason,
      taskUids: body.taskUids ?? body.task_uids,
    })
    return NextResponse.json(result)
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
