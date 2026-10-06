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
