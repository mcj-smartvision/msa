import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import {
  buildScheduleXmlDownload,
  fetchScheduleImportRow,
  scheduleDownloadHeaders,
} from '@/lib/schedule/schedule-download'

async function canAccessProjectSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string
) {
  const admin = await isSystemAdmin(supabase, userId)
  if (admin) return true

  const { data: member } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  return Boolean(member)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const importRow = await fetchScheduleImportRow(supabase, params.id)
    if (!importRow) {
      return NextResponse.json({ error: 'فایل برنامه پیدا نشد.' }, { status: 404 })
    }

    if (importRow.status !== 'completed') {
      return NextResponse.json({ error: 'این ورود هنوز تکمیل نشده است.' }, { status: 400 })
    }

    if (!(await canAccessProjectSchedule(supabase, user.id, importRow.project_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { body, fileName } = await buildScheduleXmlDownload(importRow.project_id, importRow, {
      originalOnly: true,
    })

    const payload =
      typeof body === 'string' ? body : Buffer.from(body instanceof ArrayBuffer ? body : new Uint8Array(body))

    return new NextResponse(payload, { headers: scheduleDownloadHeaders(fileName) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'دانلود برنامه انجام نشد.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
