import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { addActual, workshopErrorResponse } from '@/features/workshop/lib/service'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const actual = await addActual(supabase, params.id, {
      actualQty: Number(body.actualQty ?? body.actual_qty),
      status: body.status,
      note: body.note,
    })
    return NextResponse.json({ actual })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
