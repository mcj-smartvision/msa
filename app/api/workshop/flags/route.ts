/**
 * @file app/api/workshop/flags/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { listOpenFlags, workshopErrorResponse } from '@/features/workshop/lib/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است', code: 'VALIDATION' }, { status: 400 })
    }
    const flags = await listOpenFlags(supabase, projectId)
    return NextResponse.json({ flags })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
