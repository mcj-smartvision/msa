import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { assertManagerAccess } from '@/features/manager/lib/access'
import { getPeriodComparison } from '@/features/manager/lib/load-period-comparison'
import type { ManagerPeriod } from '@/features/manager/lib/overview-types'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

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
