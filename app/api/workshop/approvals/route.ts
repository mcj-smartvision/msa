/**
 * @file app/api/workshop/approvals/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { listApprovalInbox, workshopErrorResponse } from '@/features/workshop/lib/service'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    const supabase = createClient()
    const result = await listApprovalInbox(supabase, projectId)
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
