import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { sendToToday, workshopErrorResponse } from '@/features/workshop/lib/service'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const date = String(body.date ?? new Date().toISOString().slice(0, 10))
    const plannedQty = Number(body.plannedQty ?? body.planned_qty)
    const assignment = await sendToToday(supabase, params.id, { date, plannedQty })
    return NextResponse.json({ assignment })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
