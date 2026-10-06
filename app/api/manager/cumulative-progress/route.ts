import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { assertManagerAccess } from '@/features/manager/lib/access'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { getExplainedCumulativeProgress } from '@/features/project-controls/server/get-explained-cumulative-progress'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

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
