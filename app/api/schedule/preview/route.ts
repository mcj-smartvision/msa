import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { fetchSchedulePreviewWithPackages } from '@/lib/schedule/preview-with-packages'
import { fetchProjectScheduleMeta } from '@/lib/schedule/apply-actual-start'
import { fetchTaskPredecessorLabels } from '@/lib/schedule/predecessor-labels'
import { compareWbs } from '@/lib/schedule/wbs-utils'
import { WorkshopError } from '@/lib/workshop/domain'
import { workshopErrorResponse } from '@/lib/workshop/service'

/**
 * GET /api/schedule/preview?projectId=...
 * Fresh schedule snapshot for ارسال برنامه (tasks + workshop زیرشاخه‌ها).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const user = await requireUser(supabase)
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    await assertProjectAccess(supabase, user.id, projectId)

    const [taskSummary, scheduleMeta, predecessorLabels] = await Promise.all([
      fetchSchedulePreviewWithPackages(supabase, projectId),
      fetchProjectScheduleMeta(supabase, projectId),
      fetchTaskPredecessorLabels(supabase, projectId),
    ])

    const tasks = [...taskSummary.tasks].sort((a, b) =>
      compareWbs(a.wbs_code, b.wbs_code)
    )

    return NextResponse.json(
      {
        count: taskSummary.count,
        tasks,
        predecessorLabels: {
          ...predecessorLabels,
          ...(taskSummary.packagePredecessorLabels ?? {}),
        },
        scheduleBaselineStart: scheduleMeta.schedule_baseline_start,
        scheduleActualStart: scheduleMeta.schedule_actual_start,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'بارگذاری برنامه ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
