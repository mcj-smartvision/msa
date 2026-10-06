import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
attendanceErrorResponse,
getAttendanceDashboard,
} from '@/features/attendance/lib/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    const dateParam = request.nextUrl.searchParams.get('date')
    const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
    const snapshot = await getAttendanceDashboard(supabase, projectId, date)
    return NextResponse.json({ snapshot })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}
