import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { persistParentProgressRollup } from '@/features/schedule/lib/persist-parent-progress'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { parseDailyReportActivityRef } from '@/features/supervisor/lib/daily-report-activities'
import { persistSupervisorPhysicalProgress } from '@/features/supervisor/lib/persist-daily-progress'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

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
        .select('task_id, progress_date, percent_complete, created_at')
        .eq('project_id', projectId)
        .order('progress_date', { ascending: true })
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) {
        if (/task_progress_updates|schema cache|does not exist/i.test(error.message)) {
          return NextResponse.json({ updates: [], packageUpdates: [] })
        }
        throw new Error(error.message)
      }
      const batch = data ?? []
      updates.push(...batch)
      if (batch.length < pageSize) break
      from += pageSize
    }

    // Package history is optional until migration 99 is applied.
    const { data: packageRows, error: packageError } = await supabase
      .from('package_progress_updates')
      .select('package_id, progress_date, percent_complete, created_at')
      .eq('project_id', projectId)
      .order('progress_date', { ascending: true })
      .order('created_at', { ascending: true })
    const packageUpdates = packageError ? [] : packageRows ?? []

    return NextResponse.json({ updates, packageUpdates })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'خواندن گزارش روزانه ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * After a day's report is removed, the activity's stored percent goes back to its latest remaining
 * report. With no report left the stored (e.g. imported) percent is kept as is.
 */
async function restoreLatestReportedPercent(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  ref: ReturnType<typeof parseDailyReportActivityRef>
) {
  const isPackage = ref.kind === 'package'
  const { data: latest } = await supabase
    .from(isPackage ? 'package_progress_updates' : 'task_progress_updates')
    .select('percent_complete')
    .eq('project_id', projectId)
    .eq(isPackage ? 'package_id' : 'task_id', ref.entityId)
    .order('progress_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latest) return
  const pct = Number(latest.percent_complete)
  const now = new Date().toISOString()

  if (!isPackage) {
    await supabase
      .from('project_tasks')
      .update({ percent_complete: pct, physical_percent_complete: pct, updated_at: now })
      .eq('id', ref.entityId)
      .eq('project_id', projectId)
    return
  }
  const { data: pkg } = await supabase
    .from('workshop_packages')
    .select('schedule_fields')
    .eq('id', ref.entityId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!pkg) return
  const fields =
    pkg.schedule_fields && typeof pkg.schedule_fields === 'object'
      ? { ...(pkg.schedule_fields as Record<string, unknown>) }
      : {}
  fields.percent_complete = pct
  fields.physical_percent_complete = pct
  await supabase
    .from('workshop_packages')
    .update({ schedule_fields: fields, updated_at: now })
    .eq('id', ref.entityId)
    .eq('project_id', projectId)
}

/**
 * DELETE /api/supervisor/daily-progress
 * Body: { projectId, deletions: [{ activityId, reportDate }] }
 * Removes the progress history of those activities on those days.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const deletions = (Array.isArray(body.deletions) ? body.deletions : [])
      .map((row: Record<string, unknown>) => ({
        ref: parseDailyReportActivityRef(String(row.activityId ?? '')),
        reportDate: String(row.reportDate ?? ''),
      }))
      .filter((d: { ref: { entityId: string }; reportDate: string }) => d.ref.entityId && /^\d{4}-\d{2}-\d{2}$/.test(d.reportDate))
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    if (deletions.length === 0) {
      return NextResponse.json({ error: 'deletions خالی است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    let deleted = 0
    for (const { ref, reportDate } of deletions) {
      const table = ref.kind === 'package' ? 'package_progress_updates' : 'task_progress_updates'
      const column = ref.kind === 'package' ? 'package_id' : 'task_id'
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('project_id', projectId)
        .eq(column, ref.entityId)
        .eq('progress_date', reportDate)
        .select('id')
      if (error) throw new Error(error.message)
      if ((data ?? []).length === 0) {
        const { count } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq(column, ref.entityId)
          .eq('progress_date', reportDate)
        if (count) {
          throw new Error(
            ref.kind === 'package'
              ? 'حذف گزارش زیرشاخه‌ها هنوز در دیتابیس فعال نشده است؛ فایل database/102-package-progress-delete.sql را یک بار در Supabase SQL Editor اجرا کنید.'
              : 'حذف گزارش در دیتابیس مجاز نیست.'
          )
        }
      }
      deleted += (data ?? []).length
      if ((data ?? []).length > 0) await restoreLatestReportedPercent(supabase, projectId, ref)
    }

    try {
      await persistParentProgressRollup(supabase, projectId)
    } catch (error) {
      console.error('[supervisor/daily-progress] heading rollup failed', error)
    }
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'حذف گزارش ناموفق بود'
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
