import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { submitWorkOrderActual } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const actual = await submitWorkOrderActual(supabase, params.id, {
      actualQuantity: Number(body.actualQuantity ?? body.actual_quantity),
      actualPersonDays: Number(body.actualPersonDays ?? body.actual_person_days),
      actualUom: body.actualUom ?? body.actual_uom,
      progressMethod: body.progressMethod ?? body.progress_method,
      evidenceNotes: body.evidenceNotes ?? body.evidence_notes,
      actualStart: body.actualStart ?? body.actual_start,
      actualFinish: body.actualFinish ?? body.actual_finish,
    })
    return NextResponse.json({ actual })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
