import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { attendanceErrorResponse } from '@/features/attendance/lib/service'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { loadMemberPositionKeys } from '@/features/site-ops/lib/auth'
import { AttendanceError } from '@/features/attendance/lib/domain'

const READ_POSITIONS = new Set([
  'security',
  'site_manager',
  'project_manager',
  'planning_engineer',
  'technical_office',
])

/** Active project members for gate identification picker */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const user = await requireUser(supabase)
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    await assertProjectAccess(supabase, user.id, projectId)
    const admin = await isSystemAdmin(supabase, user.id)
    if (!admin) {
      const keys = await loadMemberPositionKeys(supabase, user.id, projectId)
      if (!keys.some((k) => READ_POSITIONS.has(k))) {
        throw new AttendanceError('FORBIDDEN', 'دسترسی ندارید')
      }
    }

    const { data, error } = await supabase
      .from('v_project_members_with_positions')
      .select('user_id, full_name, email, contact_email, personnel_code')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('full_name')

    if (error) throw new AttendanceError('VALIDATION', error.message)

    const members = (data ?? []).map((r) => ({
      userId: String(r.user_id),
      fullName: String(r.full_name || r.email || 'بدون نام'),
      email: (r.contact_email as string) || (r.email as string) || null,
      personnelCode: (r.personnel_code as string) ?? null,
    }))

    return NextResponse.json({ members })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}
