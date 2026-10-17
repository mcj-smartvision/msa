/**
 * @file app/api/supervisor/daily-report-photos/file/route.ts
 * @purpose سرو عکس گزارش از طریق API (بدون وابستگی به signed URL در مرورگر)
 * @safe-to-edit CAREFUL
 * @affects آرشیو و پیش‌نمایش چاپ
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/auth, features/supervisor/lib/daily-report-photos
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { DAILY_REPORT_PHOTO_BUCKET } from '@/features/supervisor/lib/daily-report-photos'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** GET ?photoId= — streams the photo for project members */
export async function GET(request: NextRequest) {
  try {
    const photoId = request.nextUrl.searchParams.get('photoId') ?? ''
    if (!photoId) {
      return NextResponse.json({ error: 'photoId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)

    const { data: row, error } = await supabase
      .from('daily_report_photos')
      .select('id, project_id, storage_path, content_type, file_name')
      .eq('id', photoId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!row) return NextResponse.json({ error: 'عکس پیدا نشد' }, { status: 404 })

    await assertProjectAccess(supabase, user.id, String(row.project_id))

    const { data: file, error: dlError } = await supabase.storage
      .from(DAILY_REPORT_PHOTO_BUCKET)
      .download(String(row.storage_path))

    if (dlError || !file) {
      return NextResponse.json({ error: dlError?.message || 'دانلود عکس ناموفق بود' }, { status: 404 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const contentType = row.content_type || file.type || 'image/jpeg'
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="${encodeURIComponent(String(row.file_name || 'photo.jpg'))}"`,
      },
    })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'خواندن عکس ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
