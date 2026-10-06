import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { loadMemberPositionKeys, requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { ROLE_DASHBOARD_ACCESS } from '@/features/schedule/lib/access'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { loadProjectEvm } from '@/features/evm/lib/load-project-evm'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import { todayTehranIso } from '@/shared/lib/time/tehran'

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
