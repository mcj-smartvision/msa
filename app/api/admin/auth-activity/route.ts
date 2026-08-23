import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import { createServiceClient } from '@/lib/supabase/service'
import type { AuthActivityUser } from '@/types/admin'

export const dynamic = 'force-dynamic'

/** Last sign-in timestamps for system admin idle/live session counts. Read-only. */
export async function GET() {
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

  try {
    const service = createServiceClient()
    const users: AuthActivityUser[] = []
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      for (const row of data.users) {
        users.push({
          id: row.id,
          lastSignInAt: row.last_sign_in_at ?? null,
          createdAt: row.created_at,
        })
      }
      if (data.users.length < 200) break
    }
    return NextResponse.json({ users })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auth activity unavailable' },
      { status: 500 }
    )
  }
}
