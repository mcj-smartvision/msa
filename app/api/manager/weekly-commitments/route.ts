import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { assertManagerAccess, todayIsoTehran } from '@/features/manager/lib/access'
import { loadScheduleCommitments } from '@/features/manager/lib/load-schedule-commitments'
import { ppcTrace } from '@/features/calc-trace/lib/build'
import { attachTraceHistory } from '@/features/calc-trace/lib/history'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/**
 * GET /api/manager/weekly-commitments?projectId= — PPC history and this week's commitments.
 * Commitments come from the schedule until committed weekly plans (loadWeeklyCommitments) are entered.
 * System admins also get the PPC calculation trace (`traces`).
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const service = createServiceClient()
    const result = await loadScheduleCommitments(supabase, service, projectId)
    if (!(await isSystemAdmin(supabase, user.id))) {
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
    }
    const data = result.status === 'ok' ? result.data : null
    const traces = {
      'home.ppc': ppcTrace('home.ppc', data?.weeks.filter((w) => !w.live).at(-1) ?? null, data?.source ?? 'schedule'),
    }
    await attachTraceHistory(service, projectId, traces, todayIsoTehran())
    return NextResponse.json({ ...result, traces }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
