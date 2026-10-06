import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { persistParentProgressRollup } from '@/features/schedule/lib/persist-parent-progress'
import { persistProjectProgressPace } from '@/features/schedule/lib/persist-progress-pace'

/**
 * POST /api/schedule/catch-up-progress
 * Body: { project_id, updates: [{ task_id, percent_complete }] }
 * Confirms historical progress for tasks due before today after actual start.
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

    const body = await request.json()
    const projectId = String(body.project_id ?? '')
    const updates = Array.isArray(body.updates) ? body.updates : []

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: 'updates is required' }, { status: 400 })
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

    const now = new Date().toISOString()
    let updated = 0

    for (const row of updates) {
      const taskId = String(row.task_id ?? '')
      const pct = Math.min(100, Math.max(0, Math.round(Number(row.percent_complete) || 0)))
      if (!taskId) continue

      const { data: existing } = await supabase
        .from('project_tasks')
        .select('actual_start, start_current, start_planned, percent_complete')
        .eq('id', taskId)
        .eq('project_id', projectId)
        .maybeSingle()

      const patch: Record<string, unknown> = {
        percent_complete: pct,
        physical_percent_complete: pct,
        updated_at: now,
      }
      if (pct > 0 && pct < 100 && !existing?.actual_start) {
        patch.actual_start =
          existing?.start_current ?? existing?.start_planned ?? now.slice(0, 10)
      }

      const { error } = await supabase
        .from('project_tasks')
        .update(patch)
        .eq('id', taskId)
        .eq('project_id', projectId)

      if (error) throw new Error(error.message)
      updated++

      // History drives the supervisor progress chart; best-effort like the supervisor report.
      if (existing && Number(existing.percent_complete ?? 0) !== pct) {
        await supabase.from('task_progress_updates').insert({
          project_id: projectId,
          task_id: taskId,
          progress_date: now.slice(0, 10),
          percent_complete: pct,
          created_by: user.id,
        })
      }
    }

    try {
      await persistParentProgressRollup(supabase, projectId)
    } catch (error) {
      console.error('[catch-up-progress] heading rollup failed', error)
    }

    try {
      await persistProjectProgressPace(supabase, projectId)
    } catch {
      // Migration 77 may not be applied yet
    }

    const { data: tasks, error: fetchError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('wbs_code', { ascending: true })

    if (fetchError && fetchError.code !== '42P01') {
      throw new Error(fetchError.message)
    }

    return NextResponse.json({
      updated,
      tasks: tasks ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Catch-up progress failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
