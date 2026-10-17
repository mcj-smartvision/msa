/**
 * @file app/api/manager/daily-reports/route.ts
 * @purpose فهرست گزارش‌های منتظر تأیید و تأیید توسط مدیر
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر / آرشیو گزارش روزانه
 * @depends-on shared/lib/supabase/server, features/admin/lib/access, features/site-ops/lib/auth, features/supervisor/lib/daily-report-workflow, features/schedule/services/schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import {
  assertProjectAccess,
  loadMemberPositionKeys,
  requireUser,
  resolveSiteOpsRoles,
} from '@/features/site-ops/lib/auth'
import { canManagerApproveDailyReport, parseWorkflowStatus } from '@/features/supervisor/lib/daily-report-workflow'
import { approveDailyReport } from '@/features/schedule/services/schedule'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

async function assertCanApprove(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectId: string
) {
  await assertProjectAccess(supabase, userId, projectId)
  if (await isSystemAdmin(supabase, userId)) return
  const keys = await loadMemberPositionKeys(supabase, userId, projectId)
  if (keys.includes('project_manager') || keys.includes('site_manager')) return
  const roles = await resolveSiteOpsRoles(supabase, userId, projectId, keys)
  if (roles.includes('PM') || roles.includes('SITE_MANAGER')) return
  throw new WorkshopError('FORBIDDEN', 'فقط مدیر پروژه می‌تواند گزارش را تأیید کند')
}

/** GET ?projectId= — pending submitted reports */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertCanApprove(supabase, user.id, projectId)

    const { data, error } = await supabase
      .from('daily_reports')
      .select(
        'id, report_no, report_date, workflow_status, approved_by_manager, submitted_to_manager_at, approved_at, raw_text, site_supervisor_id'
      )
      .eq('project_id', projectId)
      .in('workflow_status', ['submitted', 'approved'])
      .order('report_date', { ascending: false })
      .limit(80)

    if (error) {
      if (/workflow_status|schema cache|column/i.test(error.message)) {
        return NextResponse.json({
          pending: [],
          recent: [],
          migrationRequired: true,
          message: 'migration 112 لازم است',
        })
      }
      throw new Error(error.message)
    }

    const mapped = (data ?? []).map((row) => {
      let workflowStatus = parseWorkflowStatus(row.workflow_status)
      if (row.approved_by_manager) workflowStatus = 'approved'
      return {
        id: row.id,
        reportNo: row.report_no,
        reportDate: row.report_date,
        workflowStatus,
        submittedAt: row.submitted_to_manager_at,
        approvedAt: row.approved_at,
        notePreview: String(row.raw_text ?? '').slice(0, 280),
        supervisorId: row.site_supervisor_id,
        approvedByManager: Boolean(row.approved_by_manager),
      }
    })

    return NextResponse.json({
      pending: mapped.filter((r) => r.workflowStatus === 'submitted' && !r.approvedByManager),
      recent: mapped,
    })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    if (error instanceof SiteOpsError) {
      const status = error.code === 'FORBIDDEN' ? 403 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    const message = error instanceof Error ? error.message : 'خواندن گزارش‌ها ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST { reportId } — approve */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const reportId = String(body.reportId ?? '')
    if (!reportId) {
      return NextResponse.json({ error: 'reportId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)

    const { data: report, error } = await supabase
      .from('daily_reports')
      .select('id, project_id, workflow_status, approved_by_manager')
      .eq('id', reportId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!report) return NextResponse.json({ error: 'گزارش پیدا نشد' }, { status: 404 })

    await assertCanApprove(supabase, user.id, String(report.project_id))

    if (report.approved_by_manager) {
      return NextResponse.json({ error: 'گزارش قبلاً تأیید شده است' }, { status: 409 })
    }

    const status = parseWorkflowStatus(report.workflow_status)
    if (!canManagerApproveDailyReport(status) && status !== 'submitted') {
      // If workflow column missing path already filtered; require submitted
      if (status !== 'submitted') {
        return NextResponse.json({ error: 'فقط گزارش ارسال‌شده قابل تأیید است' }, { status: 409 })
      }
    }

    await approveDailyReport(supabase, reportId, user.id)
    const { error: wfErr } = await supabase
      .from('daily_reports')
      .update({ workflow_status: 'approved' } as never)
      .eq('id', reportId)
    if (wfErr && !/workflow_status|schema cache|column/i.test(wfErr.message)) {
      throw new Error(wfErr.message)
    }

    return NextResponse.json({ ok: true, reportId, workflowStatus: 'approved' })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    if (error instanceof SiteOpsError) {
      const status = error.code === 'FORBIDDEN' ? 403 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    const message = error instanceof Error ? error.message : 'تأیید گزارش ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
