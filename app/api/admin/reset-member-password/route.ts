import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { fetchProjectMember, updateProjectMember } from '@/features/admin/services/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await isSystemAdmin(supabase, user.id)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { member_id, password } = await request.json()

    if (!member_id || !password) {
      return NextResponse.json({ error: 'member_id and password are required' }, { status: 400 })
    }

    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const member = await fetchProjectMember(supabase, member_id)
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const service = createServiceClient()
    const { error: authError } = await service.auth.admin.updateUserById(member.user_id, {
      password: String(password),
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const updated = await updateProjectMember(supabase, member_id, { password: String(password) }, user.id)

    return NextResponse.json({ member: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
