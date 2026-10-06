import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { decidePackageChange, workshopErrorResponse } from '@/features/workshop/lib/service'

type Ctx = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const decision = body.decision === 'reject' ? 'reject' : 'approve'
    const pkg = await decidePackageChange(supabase, params.id, {
      decision,
      comment: body.comment ?? null,
    })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
