import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { canViewProjectDrawings, getProjectDrawing } from '@/lib/technical-office/drawings'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)
  if (!canViewProjectDrawings(context)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const drawing = await getProjectDrawing(params.id)
    if (!drawing) {
      return NextResponse.json({ error: 'نقشه پیدا نشد.' }, { status: 404 })
    }
    return NextResponse.json({ drawing })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'بارگذاری نقشه ناموفق بود.' },
      { status: 400 }
    )
  }
}
