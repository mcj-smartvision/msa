/**
 * @file app/api/site-ops/operational-tasks/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/service, features/site-ops/lib/http
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { listOperationalTasks } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required', code: 'VALIDATION' }, { status: 400 })
    }
    const tasks = await listOperationalTasks(supabase, projectId)
    return NextResponse.json({ tasks })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
