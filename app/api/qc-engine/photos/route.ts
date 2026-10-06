import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { requireQcEngineUser, uploadResultPhoto, uploadRequestInspectionMedia } from '@/features/qc/engine/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { user, canWrite } = await requireQcEngineUser(supabase)
    if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const form = await request.formData()
    const file = form.get('file')
    const requestId = String(form.get('requestId') ?? '')
    const resultId = String(form.get('resultId') ?? '')
    const itemId = String(form.get('itemId') ?? '')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'فایل لازم است.' }, { status: 400 })
    }
    const caption = String(form.get('caption') ?? '')
    if (requestId) {
      const id = await uploadRequestInspectionMedia({
        requestId,
        inspectorId: user.id,
        file,
        caption,
      })
      return NextResponse.json({ id })
    }
    if (!resultId || !itemId) {
      return NextResponse.json({ error: 'فایل و نتیجه لازم است.' }, { status: 400 })
    }
    const id = await uploadResultPhoto({
      resultId,
      itemId,
      file,
      caption,
    })
    return NextResponse.json({ id })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'آپلود عکس ناموفق بود' },
      { status }
    )
  }
}
