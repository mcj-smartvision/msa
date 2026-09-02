import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reportSupervisorPackageProgress, workshopErrorResponse } from '@/lib/workshop/service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const date = String(body.date ?? new Date().toISOString().slice(0, 10))
    const result = await reportSupervisorPackageProgress(supabase, params.id, {
      date,
      progressPercent: Number(body.progressPercent ?? body.progress_percent ?? 0),
      note: body.note ?? null,
    })
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
