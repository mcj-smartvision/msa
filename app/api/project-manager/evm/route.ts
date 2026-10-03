import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isSystemAdmin } from '@/lib/admin/access'
import { loadMemberPositionKeys, requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { ROLE_DASHBOARD_ACCESS } from '@/lib/schedule/access'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import { loadProjectEvm } from '@/lib/evm/load-project-evm'
import { workshopErrorResponse } from '@/lib/workshop/service'
import { todayTehranIso } from '@/lib/time/tehran'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new SiteOpsError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)

    if (!(await isSystemAdmin(supabase, user.id))) {
      const keys = await loadMemberPositionKeys(supabase, user.id, projectId)
      const allowed = ROLE_DASHBOARD_ACCESS['project-manager'] as string[]
      if (!keys.some((key) => allowed.includes(key))) {
        throw new SiteOpsError('FORBIDDEN', 'فقط مدیر پروژه به شاخص‌های EVM دسترسی دارد')
      }
    }

    const today = todayTehranIso()
    const asOf = toIsoDateOnly(request.nextUrl.searchParams.get('asOf')) ?? today

    const snapshot = await loadProjectEvm(createServiceClient(), projectId, { asOf, today })
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
