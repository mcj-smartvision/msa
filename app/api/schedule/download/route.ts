import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import {
  buildScheduleXmlDownload,
  fetchLatestCompletedImport,
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

/**
 * GET /api/schedule/download?projectId=...
 * Downloads the latest completed MSP XML for a project (stored file or regenerated export).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    if (!(await canAccessProjectSchedule(supabase, user.id, projectId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const originalOnly = request.nextUrl.searchParams.get('original') === '1'
    const importRow = await fetchLatestCompletedImport(supabase, projectId)
    const { body, fileName } = await buildScheduleXmlDownload(projectId, importRow, {
      originalOnly,
    })

    const payload =
      typeof body === 'string' ? body : Buffer.from(body instanceof ArrayBuffer ? body : new Uint8Array(body))

    return new NextResponse(payload, { headers: scheduleDownloadHeaders(fileName) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'دانلود برنامه انجام نشد.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
