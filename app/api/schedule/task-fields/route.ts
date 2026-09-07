import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateScheduleTaskFields } from '@/lib/schedule/update-schedule-task-fields'
import { workshopErrorResponse } from '@/lib/workshop/service'

/**
 * PATCH /api/schedule/task-fields
 * Body: { projectId, taskId, startDate?, finishDate?, totalFloat? }
 * Syncs برنامه edits → project_tasks / schedule_calculations (گانت).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const taskId = String(body.taskId ?? '')
    if (!projectId || !taskId) {
      return NextResponse.json({ error: 'projectId و taskId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const result = await updateScheduleTaskFields(supabase, {
      projectId,
      taskId,
      startDate: body.startDate != null ? String(body.startDate) : undefined,
      finishDate: body.finishDate != null ? String(body.finishDate) : undefined,
      totalFloat:
        body.totalFloat === undefined
          ? undefined
          : body.totalFloat === null || body.totalFloat === ''
            ? null
            : Number(body.totalFloat),
    })
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
