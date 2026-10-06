import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getProjectGanttRows } from '@/features/schedule/lib/gantt-service'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** GET /api/schedule/gantt?projectId=... */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    const supabase = createClient()
    const data = await getProjectGanttRows(supabase, projectId)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
