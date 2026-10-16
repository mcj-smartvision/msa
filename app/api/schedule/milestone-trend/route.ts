/**
 * @file app/api/schedule/milestone-trend/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/schedule/lib/schedule-alerts-api, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getMilestoneTrend } from '@/features/schedule/lib/schedule-alerts-api'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** GET /api/schedule/milestone-trend?projectId=... */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    const supabase = createClient()
    const data = await getMilestoneTrend(supabase, projectId)
    return NextResponse.json(data)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
