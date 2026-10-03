import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import { loadMemberPositionKeys, requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { ROLE_DASHBOARD_ACCESS } from '@/lib/schedule/access'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import { workshopErrorResponse } from '@/lib/workshop/service'
import { getControlsSnapshot } from '@/server/controls/get-controls-snapshot'

const UNITS = ['days', 'weeks', 'months'] as const

/** GET /api/project-manager/controls?projectId=&asOf=&unit= — inputs, ControlsSnapshot and every ExplainedKpi. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const projectId = params.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')
    const unit = params.get('unit') ?? 'months'
    if (!(UNITS as readonly string[]).includes(unit)) throw new SiteOpsError('VALIDATION', 'unit نامعتبر است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    if (!(await isSystemAdmin(supabase, user.id))) {
      const keys = await loadMemberPositionKeys(supabase, user.id, projectId)
      const allowed = ROLE_DASHBOARD_ACCESS['project-manager'] as string[]
      if (!keys.some((key) => allowed.includes(key))) {
        throw new SiteOpsError('FORBIDDEN', 'فقط مدیر پروژه به شاخص‌های کنترل پروژه دسترسی دارد')
      }
    }

    const result = await getControlsSnapshot(projectId, toIsoDateOnly(params.get('asOf')) ?? undefined, {
      periodUnit: unit as (typeof UNITS)[number],
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
