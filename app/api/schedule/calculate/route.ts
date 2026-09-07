import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import { runProjectCpmCalculation } from '@/lib/schedule/run-project-cpm'

/**
 * GET /api/schedule/calculate?projectId=...
 * Runs day-based CPM, upserts schedule_calculations, inserts float_history,
 * then evaluates float consumption / critical alerts into schedule_alerts.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = String(request.nextUrl.searchParams.get('projectId') ?? '').trim()
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const admin = await isSystemAdmin(supabase, user.id)
    if (!admin) {
      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const result = await runProjectCpmCalculation(supabase, projectId)
    return NextResponse.json(result)
  } catch (error) {
    const err = error as Error & { code?: string; cycleIds?: string[] }
    const message = err.message || 'CPM calculation failed'

    if (err.code === 'CYCLE_DETECTED') {
      return NextResponse.json(
        {
          error: message,
          code: 'CYCLE_DETECTED',
          cycleIds: err.cycleIds ?? [],
        },
        { status: 422 }
      )
    }

    if (err.code === 'NO_ACTIVITIES') {
      return NextResponse.json({ error: message, code: 'NO_ACTIVITIES' }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
