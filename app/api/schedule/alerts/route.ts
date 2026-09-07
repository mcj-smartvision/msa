import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  acknowledgeScheduleAlert,
  listActiveScheduleAlerts,
} from '@/lib/schedule/schedule-alerts-api'
import { workshopErrorResponse } from '@/lib/workshop/service'

/** GET /api/schedule/alerts?projectId=... — active (unacknowledged) alerts */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    const supabase = createClient()
    const alerts = await listActiveScheduleAlerts(supabase, projectId)
    return NextResponse.json({ alerts })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

/** POST /api/schedule/alerts — body: { projectId, alertId, action: 'acknowledge' } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const alertId = String(body.alertId ?? '')
    const action = String(body.action ?? 'acknowledge')

    if (!projectId || !alertId) {
      return NextResponse.json({ error: 'projectId و alertId لازم است' }, { status: 400 })
    }
    if (action !== 'acknowledge') {
      return NextResponse.json({ error: 'action نامعتبر است' }, { status: 400 })
    }

    const supabase = createClient()
    await acknowledgeScheduleAlert(supabase, projectId, alertId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
