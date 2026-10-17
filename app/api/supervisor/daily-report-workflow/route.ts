/**
 * @file app/api/supervisor/daily-report-workflow/route.ts
 * @purpose ثبت پیش‌نویس و ارسال گزارش روزانه به مدیر
 * @safe-to-edit CAREFUL
 * @affects تب ثبت گزارش روزانه
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/auth, features/supervisor/lib/persist-daily-report-meta, features/supervisor/lib/daily-report-workflow, features/weather/lib/report-stamp, shared/lib/time/tehran
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import {
  canSaveDailyReport,
  canSendDailyReportToManager,
  parseWorkflowStatus,
  type DailyReportWorkflowStatus,
} from '@/features/supervisor/lib/daily-report-workflow'
import {
  ensureOpenDraftReport,
  findOpenDraftReport,
  submitOpenDraftToManager,
} from '@/features/supervisor/lib/persist-daily-report-meta'
import { parseLipartaDailyReport } from '@/features/site-report/lib/parse-structured'
import {
  siteReportFallbackNote,
  siteReportHasContent,
} from '@/features/site-report/lib/report-content'
import { checkSiteReportReadyToSend } from '@/features/site-report/lib/validate-report'
import { parseWeatherSnapshot } from '@/features/weather/lib/report-stamp'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

const WORKFLOW_MISSING = /workflow_status|schema cache|column|migration_required/i

/**
 * GET ?projectId= — open draft for this supervisor (editable until sent)
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

    try {
      const draft = await findOpenDraftReport(supabase, projectId, user.id)
      if (!draft) {
        return NextResponse.json({
          reportId: null,
          reportNo: null,
          reportDate: todayTehranIso(),
          workflowStatus: 'draft' as const,
          note: '',
          structuredJson: null,
          openDraft: true,
        })
      }
      return NextResponse.json({
        reportId: draft.id,
        reportNo: draft.reportNo,
        reportDate: draft.reportDate,
        workflowStatus: draft.workflowStatus as DailyReportWorkflowStatus,
        note: draft.note,
        structuredJson: draft.structuredJson,
        openDraft: true,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      if (WORKFLOW_MISSING.test(message)) {
        return NextResponse.json({
          reportId: null,
          reportNo: null,
          reportDate: todayTehranIso(),
          workflowStatus: 'draft' as const,
          note: '',
          structuredJson: null,
          openDraft: true,
          migrationRequired: true,
        })
      }
      throw e
    }
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'خواندن وضعیت گزارش ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST { action: 'save' | 'send_to_manager', projectId, note?, weather?, reportDate? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = String(body.action ?? '')
    const projectId = String(body.projectId ?? '')
    const note = typeof body.note === 'string' ? body.note : ''
    const weather = parseWeatherSnapshot(body.weather)
    const structured = parseLipartaDailyReport(body.structuredJson)
    const workingDate =
      typeof body.reportDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.reportDate)
        ? body.reportDate
        : todayTehranIso()

    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    if (action !== 'save' && action !== 'send_to_manager' && action !== 'finalize') {
      return NextResponse.json({ error: 'action نامعتبر است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const resolvedNote =
      note.trim() ||
      (structured && siteReportHasContent(structured) ? siteReportFallbackNote(structured) : '')

    // legacy alias: finalize → save (no longer locks)
    if (action === 'save' || action === 'finalize') {
      const existing = await findOpenDraftReport(supabase, projectId, user.id)
      const status = existing?.workflowStatus ?? 'draft'
      if (!canSaveDailyReport(status)) {
        return NextResponse.json({ error: 'گزارش ارسال‌شده قابل ویرایش نیست' }, { status: 409 })
      }
      if (!resolvedNote && !existing?.note.trim() && !siteReportHasContent(structured)) {
        return NextResponse.json(
          { error: 'قبل از ثبت، فرم یا یادداشت را پر کنید' },
          { status: 400 }
        )
      }
      try {
        const header = await ensureOpenDraftReport(supabase, {
          projectId,
          supervisorId: user.id,
          reportDate: workingDate,
          note: resolvedNote || existing?.note || null,
          weather,
          structuredJson: structured,
        })
        return NextResponse.json({
          ok: true,
          reportId: header.id,
          reportNo: header.reportNo,
          reportDate: header.reportDate,
          workflowStatus: 'draft' as const,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : ''
        if (WORKFLOW_MISSING.test(message)) {
          return NextResponse.json(
            {
              error: 'migration_required',
              message:
                'ستون گردش‌کار آماده نیست — فایل‌های database/112 و database/113 را در Supabase اجرا کنید.',
            },
            { status: 503 }
          )
        }
        throw e
      }
    }

    // send_to_manager — archive with send date, then client opens a new blank draft
    const existing = await findOpenDraftReport(supabase, projectId, user.id)
    const status = existing?.workflowStatus ?? 'draft'
    if (!canSendDailyReportToManager(status)) {
      return NextResponse.json({ error: 'گزارش قبلاً ارسال شده است' }, { status: 409 })
    }

    if (structured && siteReportHasContent(structured)) {
      const readiness = checkSiteReportReadyToSend(structured)
      if (!readiness.ok && !note.trim()) {
        return NextResponse.json(
          {
            error: 'فرم ناقص است',
            message: `قبل از ارسال این بخش‌ها را کامل کنید: ${readiness.missingMandatory.join('، ')}`,
          },
          { status: 400 }
        )
      }
    }

    const sendDate = todayTehranIso()
    try {
      const header = await submitOpenDraftToManager(supabase, {
        projectId,
        supervisorId: user.id,
        sendDate,
        note: resolvedNote || existing?.note || null,
        weather,
        structuredJson: structured,
      })
      return NextResponse.json({
        ok: true,
        reportId: header.id,
        reportNo: header.reportNo,
        reportDate: header.reportDate,
        workflowStatus: 'submitted' as const,
        archived: true,
        openNewDraft: true,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ارسال ناموفق بود'
      if (WORKFLOW_MISSING.test(message)) {
        return NextResponse.json(
          {
            error: 'migration_required',
            message:
              'ستون گردش‌کار آماده نیست — فایل‌های database/112 و database/113 را در Supabase اجرا کنید.',
          },
          { status: 503 }
        )
      }
      if (/فرم|یادداشت/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 400 })
      }
      throw e
    }
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'به‌روزرسانی وضعیت گزارش ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
