import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { fetchPositions, seedProjectPositions } from '@/features/admin/services/admin'

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

    const body = await request.json()
    const projectId = String(body.project_id ?? '')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    await seedProjectPositions(supabase, projectId)
    const positions = await fetchPositions(supabase, projectId)

    return NextResponse.json({ count: positions.length, positions }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seed positions failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
