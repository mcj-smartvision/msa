import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
attendanceErrorResponse,
listTransits,
recordTransit,
} from '@/features/attendance/lib/service'
import type { IdentificationStatus, TransitDirection, TransitSource } from '@/features/attendance/lib/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 100)
    const transits = await listTransits(supabase, projectId, { limit })
    return NextResponse.json({ transits })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const transit = await recordTransit(supabase, {
      projectId: String(body.projectId ?? body.project_id ?? ''),
      userId: body.userId ?? body.user_id ?? null,
      gateId: body.gateId ?? body.gate_id ?? null,
      direction: (body.direction as TransitDirection | null | undefined) ?? null,
      source: (body.source as TransitSource | undefined) ?? 'manual_guard',
      identificationStatus:
        (body.identificationStatus as IdentificationStatus | undefined) ??
        (body.identification_status as IdentificationStatus | undefined) ??
        'success',
      personName: body.personName ?? body.person_name ?? null,
      notes: body.notes ?? null,
      occurredAt: body.occurredAt ?? body.occurred_at ?? null,
    })
    return NextResponse.json({ transit })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}
