import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { assertManagerAccess } from '@/lib/manager/access'
import { getPeriodComparison } from '@/lib/manager/load-period-comparison'
import type { ManagerPeriod } from '@/lib/manager/overview-types'
import { workshopErrorResponse } from '@/lib/workshop/service'

const PERIODS: ManagerPeriod[] = ['today', 'week', 'month']

/** GET /api/manager/period-comparison?projectId=&period=today|week|month */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    const period = request.nextUrl.searchParams.get('period') as ManagerPeriod | null
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')
    if (!period || !PERIODS.includes(period)) throw new SiteOpsError('VALIDATION', 'period نامعتبر است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const comparison = await getPeriodComparison(projectId, period, { service: createServiceClient() })
    return NextResponse.json(comparison, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
