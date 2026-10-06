import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { captureProgressSnapshots } from '@/features/schedule/lib/progress-snapshots'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  return bearer === secret || request.headers.get('x-cron-secret') === secret
}

/**
 * GET /api/schedule/progress-snapshots?projectId=
 * Reported cumulative percents used to compute Earned.
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

    const snapshots = []
    const pageSize = 1000
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('progress_snapshots')
        .select('activity_id, snapshot_month, jalali_month, cumulative_percent')
        .eq('project_id', projectId)
        .order('snapshot_month', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) throw new Error(error.message)
      const batch = data ?? []
      snapshots.push(...batch)
      if (batch.length < pageSize) break
      from += pageSize
    }
    return NextResponse.json({ snapshots })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'خواندن تاریخچه پیشرفت ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/schedule/progress-snapshots
 * Body: { projectId?, force?: boolean }
 * - force=true: snapshot the current Jalali month now (bootstrap from today)
 * - force omitted: write only on the last day of the Jalali month
 * Cron: Authorization: Bearer $CRON_SECRET (all projects, service role)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    const force = body.force === true

    if (cronAuthorized(request)) {
      const supabase = createServiceClient()
      const result = await captureProgressSnapshots(supabase, {
        projectId: projectId || undefined,
        force,
      })
      return NextResponse.json({ ok: true, ...result })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    if (projectId) await assertProjectAccess(supabase, user.id, projectId)

    const result = await captureProgressSnapshots(supabase, {
      projectId: projectId || undefined,
      force,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'ثبت اسنپ‌شات پیشرفت ناموفق بود'
    const missing = /progress_snapshots|schema cache|does not exist/i.test(message)
    return NextResponse.json(
      {
        error: missing
          ? 'جدول progress_snapshots هنوز ساخته نشده. فایل database/93-progress-snapshots.sql را در Supabase اجرا کنید.'
          : message,
      },
      { status: missing ? 503 : 500 }
    )
  }
}
