import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
attendanceErrorResponse,
createGate,
listGates,
} from '@/features/attendance/lib/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    const gates = await listGates(supabase, projectId)
    return NextResponse.json({ gates })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const gate = await createGate(supabase, {
      projectId: String(body.projectId ?? body.project_id ?? ''),
      name: String(body.name ?? ''),
      cameraLabel: body.cameraLabel ?? body.camera_label ?? null,
      locationNote: body.locationNote ?? body.location_note ?? null,
    })
    return NextResponse.json({ gate })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}
