import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  deletePackage,
  listPackageEvents,
  updatePackage,
  workshopErrorResponse,
} from '@/lib/workshop/service'

type Ctx = { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const pkg = await updatePackage(supabase, params.id, {
      name: body.name,
      quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
      uom: body.uom,
      location: body.location,
      crew: body.crew,
      note: body.note,
      flagForReview: body.flagForReview ?? body.flag_for_review,
      reviewReason: body.reviewReason ?? body.review_reason,
      weightPercent:
        body.weightPercent !== undefined
          ? body.weightPercent
          : body.weight_percent !== undefined
            ? body.weight_percent
            : undefined,
    })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const result = await deletePackage(supabase, params.id)
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const events = await listPackageEvents(supabase, params.id)
    return NextResponse.json({ events })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
