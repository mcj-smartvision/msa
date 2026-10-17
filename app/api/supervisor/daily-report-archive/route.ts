/**
 * @file app/api/supervisor/daily-report-archive/route.ts
 * @purpose فهرست آرشیو گزارش روزانه سرپرست
 * @safe-to-edit CAREFUL
 * @affects صفحه آرشیو گزارش روزانه
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/auth, features/supervisor/lib/daily-report-archive
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { listArchivedDailyReports } from '@/features/supervisor/lib/daily-report-archive'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** GET ?projectId= — archived (submitted/approved) reports for this supervisor */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const reports = await listArchivedDailyReports(supabase, projectId, user.id)
    return NextResponse.json({ reports })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'خواندن آرشیو ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
