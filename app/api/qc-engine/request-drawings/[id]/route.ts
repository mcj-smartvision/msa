import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireQcEngineUser, signRequestDrawing } from '@/lib/qc-engine/service'

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
