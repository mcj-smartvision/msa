import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import {
canUploadProjectDrawings,
canViewProjectDrawings,
deleteDrawing,
signDrawingDownload,
} from '@/features/technical-office/lib/drawings'

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
    const signed = await signDrawingDownload(params.id)
    return NextResponse.json(signed)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'لینک دانلود ساخته نشد.' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)
  if (!canUploadProjectDrawings(context)) {
    return NextResponse.json({ error: 'حذف نقشه فقط برای دفتر فنی است.' }, { status: 403 })
  }

  try {
    await deleteDrawing(params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حذف نقشه ناموفق بود.' },
      { status: 400 }
    )
  }
}
