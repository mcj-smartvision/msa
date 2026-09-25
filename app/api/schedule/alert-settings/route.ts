import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadProjectAlertSettings,
  saveProjectAlertSettings,
  type ProjectAlertSettingsPatch,
} from '@/lib/schedule/run-float-alerts'

/**
 * GET  /api/schedule/alert-settings?projectId=…
 * PATCH /api/schedule/alert-settings  { projectId, paceGoodThreshold?, paceWarningThreshold?, nearCriticalDays? }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const settings = await loadProjectAlertSettings(supabase, projectId)
    return NextResponse.json({
      projectId,
      paceGoodThreshold: settings.paceGoodThreshold,
      paceWarningThreshold: settings.paceWarningThreshold,
      nearCriticalDays: settings.nearCriticalDays,
      fastConsumptionThreshold: settings.fastConsumptionThreshold,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load alert settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const projectId = String(body.projectId ?? body.project_id ?? '')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const patch: ProjectAlertSettingsPatch = {}
    if (body.paceGoodThreshold != null || body.pace_good_threshold != null) {
      patch.paceGoodThreshold = Number(body.paceGoodThreshold ?? body.pace_good_threshold)
    }
    if (body.paceWarningThreshold != null || body.pace_warning_threshold != null) {
      patch.paceWarningThreshold = Number(
        body.paceWarningThreshold ?? body.pace_warning_threshold
      )
    }
    if (body.nearCriticalDays != null || body.near_critical_days != null) {
      patch.nearCriticalDays = Number(body.nearCriticalDays ?? body.near_critical_days)
    }
    if (body.fastConsumptionThreshold != null || body.fast_consumption_threshold != null) {
      patch.fastConsumptionThreshold = Number(
        body.fastConsumptionThreshold ?? body.fast_consumption_threshold
      )
    }

    const settings = await saveProjectAlertSettings(supabase, projectId, patch)
    return NextResponse.json({
      ok: true,
      projectId,
      paceGoodThreshold: settings.paceGoodThreshold,
      paceWarningThreshold: settings.paceWarningThreshold,
      nearCriticalDays: settings.nearCriticalDays,
      fastConsumptionThreshold: settings.fastConsumptionThreshold,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save alert settings'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
