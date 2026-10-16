/**
 * @file app/api/schedule/gantt-task/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/schedule/lib/gantt-service, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { updateGanttTaskDates } from '@/features/schedule/lib/gantt-service'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** PATCH /api/schedule/gantt-task — drag/resize persist + parent expand */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const taskId = String(body.taskId ?? '')
    const startDate = String(body.startDate ?? '')
    const finishDate = String(body.finishDate ?? '')

    if (!projectId || !taskId || !startDate || !finishDate) {
      return NextResponse.json(
        { error: 'projectId، taskId، startDate و finishDate لازم است' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const result = await updateGanttTaskDates(supabase, {
      projectId,
      taskId,
      startDate,
      finishDate,
    })
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
