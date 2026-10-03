import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { assertManagerAccess } from '@/lib/manager/access'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import { getExplainedCumulativeProgress } from '@/server/controls/get-explained-cumulative-progress'
import { workshopErrorResponse } from '@/lib/workshop/service'

/** GET /api/manager/cumulative-progress?projectId=&asOf= — explained Planned / Actual cumulative % with WBS breakdown. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const projectId = params.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')
    const rawAsOf = params.get('asOf')
    const asOf = rawAsOf ? toIsoDateOnly(rawAsOf) : null
    if (rawAsOf && !asOf) throw new SiteOpsError('VALIDATION', 'asOf نامعتبر است (YYYY-MM-DD)')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    let result
    try {
      result = await getExplainedCumulativeProgress(projectId, asOf ?? undefined, { service: createServiceClient() })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('تاریخ محاسبه')) throw new SiteOpsError('VALIDATION', error.message)
      throw error
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
