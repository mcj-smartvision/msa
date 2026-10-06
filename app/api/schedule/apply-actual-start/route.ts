import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { applyActualStartToSchedule } from '@/features/schedule/lib/apply-actual-start'

/**
 * POST /api/schedule/apply-actual-start
 * Body: { project_id, actual_start_date, aligned_with_baseline }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await isSystemAdmin(supabase, user.id)
    const body = await request.json()
    const projectId = String(body.project_id ?? '')
    const actualStartDate = String(body.actual_start_date ?? '')
    const alignedWithBaseline = Boolean(body.aligned_with_baseline)

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    if (!alignedWithBaseline && !actualStartDate) {
      return NextResponse.json({ error: 'actual_start_date is required' }, { status: 400 })
    }

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

    const result = await applyActualStartToSchedule(supabase, {
      projectId,
      actualStartDate: alignedWithBaseline ? '' : actualStartDate,
      alignedWithBaseline,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apply actual start failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
