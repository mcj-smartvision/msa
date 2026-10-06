import { NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'

export const dynamic = 'force-dynamic'

/** Current user's last site login (Supabase auth last_sign_in_at). */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = createServiceClient()
    const { data, error } = await service.auth.admin.getUserById(user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const lastLoginAt = data.user.last_sign_in_at ?? data.user.created_at ?? null
    return NextResponse.json({ lastLoginAt })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login time unavailable' },
      { status: 500 }
    )
  }
}
