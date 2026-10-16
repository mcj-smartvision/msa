/**
 * @file app/api/project-store/rnc/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/supabase/service, features/site-ops/lib/auth, features/site-ops/domain/errors, features/holidays/lib/work-calendar, features/project-store/lib/load-snapshot, features/project-store/lib/load-rnc, features/project-store/lib/weekly-engine, features/schedule/lib/week-commitment-windows, features/supervisor/lib/daily-report-activities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { siteWorkCalendar } from '@/features/holidays/lib/work-calendar'
import { loadProjectSnapshot } from '@/features/project-store/lib/load-snapshot'
import { RNC_MISSING_TABLE } from '@/features/project-store/lib/load-rnc'
import { activityWeek, isEvaluationOpen } from '@/features/project-store/lib/weekly-engine'
import { groupWindows } from '@/features/schedule/lib/week-commitment-windows'
import { buildDailyReportActivitiesFromTree } from '@/features/supervisor/lib/daily-report-activities'
import { siteWeekStart } from '@/features/supervisor/lib/weekly-activity-progress'
import { ROOT_CAUSE_CATEGORIES } from '@/features/wwp/lib/policy'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/**
 * POST /api/project-store/rnc — reason a weekly commitment was missed.
 * Body: { projectId, activityId, weekStart, category, note? }. Accepted only after the week's evaluation
 * opens (Thursday 16:00 Tehran) and only when the weekly engine scores the commitment 0.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const projectId = String(body.projectId ?? '')
    const activityId = String(body.activityId ?? '')
    const weekStart = String(body.weekStart ?? '').slice(0, 10)
    const category = String(body.category ?? '')
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null

    if (!projectId || !/^(schedule|package):[0-9a-fA-F-]{36}$/.test(activityId)) {
      throw new SiteOpsError('VALIDATION', 'پروژه یا فعالیت نامعتبر است')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || siteWeekStart(weekStart) !== weekStart) {
      throw new SiteOpsError('VALIDATION', 'شروع هفته باید شنبه باشد')
    }
    if (!(ROOT_CAUSE_CATEGORIES as readonly string[]).includes(category)) {
      throw new SiteOpsError('VALIDATION', 'دستهٔ علت عدم تحقق نامعتبر است')
    }
    if (category === 'other' && !note) throw new SiteOpsError('VALIDATION', 'برای «سایر» توضیح لازم است')

    const nowMs = Date.now()
    if (!isEvaluationOpen(weekStart, nowMs)) {
      throw new SiteOpsError('VALIDATION', 'ارزیابی این هفته از پنجشنبه ساعت 16:00 باز می‌شود')
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const service = createServiceClient()
    const snapshot = await loadProjectSnapshot(supabase, service, projectId, { withCosts: false })
    if (snapshot.rncMissing) throw new SiteOpsError('VALIDATION', RNC_MISSING_TABLE)
    const activity = buildDailyReportActivitiesFromTree(snapshot.tree.nodes, snapshot.tree.orphanPackages).find((a) => a.id === activityId)
    if (!activity) throw new SiteOpsError('VALIDATION', 'این فعالیت در گزارش روزانه نیست')

    const week = activityWeek({
      activity: {
        id: activity.id,
        approved: {
          start: activity.approvedStartDate || activity.plannedStartDate || null,
          finish: activity.approvedFinishDate || activity.plannedFinishDate || null,
        },
        baselinePercent: activity.baselinePercentComplete ?? 0,
      },
      entries: snapshot.history,
      windows: groupWindows(snapshot.windows),
      weekStart,
      today: snapshot.today,
      nowMs,
      isWorkday: siteWorkCalendar(snapshot.holidays),
    })
    if (week.ppcStatus !== 0) {
      throw new SiteOpsError('VALIDATION', week.ppcStatus === 1 ? 'این تعهد کامل انجام شده و علت عدم تحقق ندارد' : 'این فعالیت در این هفته تعهدی نداشت')
    }

    const { error } = await service.from('weekly_commitment_rnc').upsert(
      {
        project_id: projectId,
        activity_id: activityId,
        week_start: weekStart,
        category,
        note,
        weekly_target: week.target,
        weekly_actual: week.actualSum,
        recorded_by: user.id,
        recorded_at: new Date(nowMs).toISOString(),
      },
      { onConflict: 'project_id,activity_id,week_start' }
    )
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, weeklyTarget: week.target, weeklyActual: week.actualSum })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
