import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { persistSupervisorPhysicalProgress } from '@/lib/supervisor/persist-daily-progress'
import { WorkshopError } from '@/lib/workshop/domain'
import { workshopErrorResponse } from '@/lib/workshop/service'

/**
 * GET /api/supervisor/daily-progress?projectId=
 * Physical percents saved from the site supervisor daily report.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const updates = []
    const pageSize = 1000
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('task_progress_updates')
        .select('task_id, progress_date, percent_complete')
        .eq('project_id', projectId)
        .order('progress_date', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) {
        if (/task_progress_updates|schema cache|does not exist/i.test(error.message)) {
          return NextResponse.json({ updates: [] })
        }
        throw new Error(error.message)
      }
      const batch = data ?? []
      updates.push(...batch)
      if (batch.length < pageSize) break
      from += pageSize
    }
    return NextResponse.json({ updates })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'خواندن گزارش روزانه ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/supervisor/daily-progress
 * Body: { projectId, reportDate?, updates: [{ activityId, percentComplete }] }
 * Writes physical progress into project_tasks / workshop_packages for schedule EDIT + SEND.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const reportDate =
      typeof body.reportDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.reportDate)
        ? body.reportDate
        : new Date().toISOString().slice(0, 10)
    const rawUpdates = Array.isArray(body.updates) ? body.updates : []

    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    if (rawUpdates.length === 0) {
      return NextResponse.json({ error: 'updates خالی است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const updates = rawUpdates.map((row: Record<string, unknown>) => ({
      activityId: String(row.activityId ?? ''),
      percentComplete: Number(row.percentComplete),
      reportDate,
    }))

    const result = await persistSupervisorPhysicalProgress(
      supabase,
      projectId,
      user.id,
      updates
    )

    return NextResponse.json({
      ok: true,
      reportDate,
      ...result,
    })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'ذخیره پیشرفت ناموفق بود'
    console.error('[supervisor/daily-progress]', message, error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
