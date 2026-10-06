import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getSupervisorTodayActivities } from '@/features/supervisor/lib/supervisor-today-service'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    const date =
      request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است', code: 'VALIDATION' }, { status: 400 })
    }
    const result = await getSupervisorTodayActivities(supabase, projectId, date)
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
