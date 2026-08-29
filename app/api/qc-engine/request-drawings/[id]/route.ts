import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteRequestDrawing, requireQcEngineUser, signRequestDrawing } from '@/lib/qc-engine/service'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireQcEngineUser(createClient())
    const signed = await signRequestDrawing(params.id)
    return NextResponse.json(signed)
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'دانلود نقشه درخواست ناموفق بود' },
      { status }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { canWrite } = await requireQcEngineUser(createClient())
    if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await deleteRequestDrawing(params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حذف نقشه ناموفق بود' },
      { status }
    )
  }
}
