/**
 * @file app/api/supervisor/daily-report-photos/route.ts
 * @purpose API عکس‌های گزارش روزانه سرپرست
 * @safe-to-edit CAREFUL
 * @affects تب ثبت گزارش روزانه
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/auth, features/supervisor/lib/daily-report-photos, features/supervisor/lib/persist-daily-report-meta, features/weather/lib/report-stamp
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import {
  DAILY_REPORT_PHOTO_BUCKET,
  DAILY_REPORT_PHOTO_LIMITS,
  dailyReportPhotoStoragePath,
  photoFileExt,
  validateDailyReportPhotoFile,
  type DailyReportPhotoItem,
} from '@/features/supervisor/lib/daily-report-photos'
import { canEditDailyReportContent, parseWorkflowStatus } from '@/features/supervisor/lib/daily-report-workflow'
import {
  ensureOpenDraftReport,
  findOpenDraftReport,
} from '@/features/supervisor/lib/persist-daily-report-meta'
import { parseWeatherSnapshot } from '@/features/weather/lib/report-stamp'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

const TABLE_MISSING = /daily_report_photos|schema cache|does not exist/i

async function signPhotoUrl(
  supabase: ReturnType<typeof createClient>,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DAILY_REPORT_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw new Error(error?.message || 'signed url failed')
  return data.signedUrl
}

/**
 * GET ?projectId=&reportDate=  → one day
 * GET ?projectId=              → all days for this project (history)
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    const reportDate = request.nextUrl.searchParams.get('reportDate') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    if (reportDate && !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return NextResponse.json({ error: 'reportDate نامعتبر است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    if (!reportDate) {
      const { data: rows, error } = await supabase
        .from('daily_report_photos')
        .select(
          'id, daily_report_id, report_date, storage_path, file_name, content_type, byte_size, created_at, daily_reports(report_no, site_supervisor_id, workflow_status)'
        )
        .eq('project_id', projectId)
        .order('report_date', { ascending: false })
        .order('sort_order', { ascending: true })

      if (error) {
        if (TABLE_MISSING.test(error.message)) {
          return NextResponse.json({ photosByDate: {} })
        }
        throw new Error(error.message)
      }

      const photosByDate: Record<string, DailyReportPhotoItem[]> = {}
      for (const row of rows ?? []) {
        const linked = row.daily_reports as
          | { report_no?: string | null; site_supervisor_id?: string | null; workflow_status?: string | null }
          | { report_no?: string | null; site_supervisor_id?: string | null; workflow_status?: string | null }[]
          | null
        const header = Array.isArray(linked) ? linked[0] : linked
        if (header?.site_supervisor_id && header.site_supervisor_id !== user.id) continue
        const wf = header?.workflow_status
        if (wf === 'draft' || wf === 'finalized') continue
        const date = String(row.report_date)
        const reportId = String(row.daily_report_id)
        const reportNo =
          typeof header?.report_no === 'string' && header.report_no.trim()
            ? header.report_no.trim()
            : `DR-${date.replace(/-/g, '')}-${reportId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
        const url = await signPhotoUrl(supabase, String(row.storage_path))
        const item: DailyReportPhotoItem = {
          id: String(row.id),
          dailyReportId: reportId,
          reportNo,
          reportDate: date,
          fileName: String(row.file_name),
          contentType: row.content_type ? String(row.content_type) : null,
          byteSize: typeof row.byte_size === 'number' ? row.byte_size : null,
          url,
          createdAt: String(row.created_at),
        }
        ;(photosByDate[date] ??= []).push(item)
      }
      return NextResponse.json({ photosByDate })
    }

    // Compose page: photos belong to the open draft (not a locked day row)
    const draft = await findOpenDraftReport(supabase, projectId, user.id)
    if (!draft) {
      return NextResponse.json({
        reportId: null,
        reportNo: null,
        reportDate,
        photos: [] as DailyReportPhotoItem[],
      })
    }

    const fullRows = await supabase
      .from('daily_report_photos')
      .select(
        'id, daily_report_id, report_date, storage_path, file_name, content_type, byte_size, created_at, caption, linked_activity_or_location'
      )
      .eq('daily_report_id', draft.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    const rowsQuery =
      fullRows.error &&
      /caption|linked_activity_or_location|schema cache|column/i.test(fullRows.error.message)
        ? await supabase
            .from('daily_report_photos')
            .select(
              'id, daily_report_id, report_date, storage_path, file_name, content_type, byte_size, created_at'
            )
            .eq('daily_report_id', draft.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
        : fullRows

    const { data: rows, error } = rowsQuery

    if (error) {
      if (TABLE_MISSING.test(error.message)) {
        return NextResponse.json(
          { error: 'migration_required', message: 'جدول عکس گزارش روزانه آماده نیست — migration 111 را اجرا کنید.' },
          { status: 503 }
        )
      }
      throw new Error(error.message)
    }

    const photos: DailyReportPhotoItem[] = []
    for (const row of rows ?? []) {
      const url = await signPhotoUrl(supabase, String(row.storage_path))
      photos.push({
        id: String(row.id),
        dailyReportId: String(row.daily_report_id),
        reportNo: draft.reportNo,
        reportDate: String(row.report_date),
        fileName: String(row.file_name),
        contentType: row.content_type ? String(row.content_type) : null,
        byteSize: typeof row.byte_size === 'number' ? row.byte_size : null,
        url,
        createdAt: String(row.created_at),
        caption:
          typeof (row as unknown as { caption?: string }).caption === 'string'
            ? (row as unknown as { caption: string }).caption
            : null,
        linkedActivityOrLocation:
          typeof (row as unknown as { linked_activity_or_location?: string }).linked_activity_or_location ===
          'string'
            ? (row as unknown as { linked_activity_or_location: string }).linked_activity_or_location
            : null,
      })
    }

    return NextResponse.json({
      reportId: draft.id,
      reportNo: draft.reportNo,
      reportDate: draft.reportDate,
      photos,
    })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'خواندن عکس‌ها ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST multipart: projectId, reportDate, file, note?, weatherJson?
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const projectId = String(form.get('projectId') ?? '')
    const reportDate = String(form.get('reportDate') ?? '')
    const note = String(form.get('note') ?? '')
    const weatherRaw = form.get('weatherJson')
    const file = form.get('file')

    if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return NextResponse.json({ error: 'projectId و reportDate لازم است' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'فایل تصویر لازم است' }, { status: 400 })
    }
    const invalid = validateDailyReportPhotoFile(file)
    if (invalid === 'format') {
      return NextResponse.json({ error: 'فقط JPEG، PNG یا WebP' }, { status: 400 })
    }
    if (invalid === 'size') {
      return NextResponse.json({ error: 'حجم فایل حداکثر ۱۰ مگابایت' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const weather =
      typeof weatherRaw === 'string' && weatherRaw.trim()
        ? parseWeatherSnapshot(JSON.parse(weatherRaw) as unknown)
        : null

    const header = await ensureOpenDraftReport(supabase, {
      projectId,
      supervisorId: user.id,
      reportDate,
      note: note || null,
      weather,
    })

    const { data: headerRow } = await supabase
      .from('daily_reports')
      .select('workflow_status, approved_by_manager')
      .eq('id', header.id)
      .maybeSingle()
    const wf = headerRow?.approved_by_manager
      ? 'approved'
      : parseWorkflowStatus(headerRow?.workflow_status)
    if (!canEditDailyReportContent(wf)) {
      return NextResponse.json({ error: 'گزارش قفل است و عکس جدید پذیرفته نمی‌شود' }, { status: 409 })
    }

    const { count, error: countError } = await supabase
      .from('daily_report_photos')
      .select('id', { count: 'exact', head: true })
      .eq('daily_report_id', header.id)

    if (countError) {
      if (TABLE_MISSING.test(countError.message)) {
        return NextResponse.json(
          { error: 'migration_required', message: 'جدول عکس گزارش روزانه آماده نیست — migration 111 را اجرا کنید.' },
          { status: 503 }
        )
      }
      throw new Error(countError.message)
    }
    if ((count ?? 0) >= DAILY_REPORT_PHOTO_LIMITS.maxCount) {
      return NextResponse.json({ error: `حداکثر ${DAILY_REPORT_PHOTO_LIMITS.maxCount} عکس` }, { status: 400 })
    }

    const photoId = crypto.randomUUID()
    const ext = photoFileExt(file)
    const path = dailyReportPhotoStoragePath({
      projectId,
      reportDate,
      reportId: header.id,
      photoId,
      ext,
    })

    const bytes = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(DAILY_REPORT_PHOTO_BUCKET)
      .upload(path, bytes, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
    if (uploadError) throw new Error(uploadError.message)

    const { data: row, error: insertError } = await supabase
      .from('daily_report_photos')
      .insert({
        id: photoId,
        daily_report_id: header.id,
        project_id: projectId,
        report_date: reportDate,
        storage_bucket: DAILY_REPORT_PHOTO_BUCKET,
        storage_path: path,
        file_name: file.name || `photo.${ext}`,
        content_type: file.type || 'image/jpeg',
        byte_size: file.size,
        sort_order: count ?? 0,
        created_by: user.id,
      })
      .select('id, daily_report_id, report_date, storage_path, file_name, content_type, byte_size, created_at')
      .single()

    if (insertError) {
      await supabase.storage.from(DAILY_REPORT_PHOTO_BUCKET).remove([path])
      throw new Error(insertError.message)
    }

    const url = await signPhotoUrl(supabase, path)
    const photo: DailyReportPhotoItem = {
      id: String(row.id),
      dailyReportId: header.id,
      reportNo: header.reportNo,
      reportDate,
      fileName: String(row.file_name),
      contentType: row.content_type ? String(row.content_type) : null,
      byteSize: typeof row.byte_size === 'number' ? row.byte_size : null,
      url,
      createdAt: String(row.created_at),
    }

    return NextResponse.json({
      reportId: header.id,
      reportNo: header.reportNo,
      reportDate,
      photo,
    })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'آپلود عکس ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE ?photoId= */
export async function DELETE(request: NextRequest) {
  try {
    const photoId = request.nextUrl.searchParams.get('photoId') ?? ''
    if (!photoId) {
      return NextResponse.json({ error: 'photoId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)

    const { data: row, error } = await supabase
      .from('daily_report_photos')
      .select('id, project_id, storage_path, created_by, daily_report_id')
      .eq('id', photoId)
      .maybeSingle()

    if (error) {
      if (TABLE_MISSING.test(error.message)) {
        return NextResponse.json(
          { error: 'migration_required', message: 'جدول عکس گزارش روزانه آماده نیست — migration 111 را اجرا کنید.' },
          { status: 503 }
        )
      }
      throw new Error(error.message)
    }
    if (!row) return NextResponse.json({ error: 'عکس پیدا نشد' }, { status: 404 })

    await assertProjectAccess(supabase, user.id, String(row.project_id))

    const { data: report } = await supabase
      .from('daily_reports')
      .select('workflow_status, approved_by_manager')
      .eq('id', row.daily_report_id)
      .maybeSingle()
    const wf = report?.approved_by_manager
      ? 'approved'
      : parseWorkflowStatus(report?.workflow_status)
    if (!canEditDailyReportContent(wf)) {
      return NextResponse.json({ error: 'گزارش قفل است و حذف عکس مجاز نیست' }, { status: 409 })
    }

    const { error: delError } = await supabase.from('daily_report_photos').delete().eq('id', photoId)
    if (delError) throw new Error(delError.message)

    await supabase.storage.from(DAILY_REPORT_PHOTO_BUCKET).remove([String(row.storage_path)])

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'حذف عکس ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
