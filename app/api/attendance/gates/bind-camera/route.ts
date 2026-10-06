import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
attendanceErrorResponse,
bindGateCamera,
} from '@/features/attendance/lib/service'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const gate = await bindGateCamera(supabase, {
      projectId: String(body.projectId ?? body.project_id ?? ''),
      gateId: String(body.gateId ?? body.gate_id ?? ''),
      cameraDeviceId: String(body.cameraDeviceId ?? body.camera_device_id ?? ''),
      cameraLabel: body.cameraLabel ?? body.camera_label ?? null,
      cameraGroupId: body.cameraGroupId ?? body.camera_group_id ?? null,
    })
    return NextResponse.json({ gate })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}
