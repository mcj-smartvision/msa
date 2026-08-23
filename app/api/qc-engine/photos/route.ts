import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireQcEngineUser, uploadResultPhoto } from '@/lib/qc-engine/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { canWrite } = await requireQcEngineUser(supabase)
    if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const form = await request.formData()
    const file = form.get('file')
    const resultId = String(form.get('resultId') ?? '')
    const itemId = String(form.get('itemId') ?? '')
    if (!resultId || !itemId || !(file instanceof File)) {
      return NextResponse.json({ error: 'فایل و نتیجه لازم است.' }, { status: 400 })
    }
    const id = await uploadResultPhoto({
      resultId,
      itemId,
      file,
      caption: String(form.get('caption') ?? ''),
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
