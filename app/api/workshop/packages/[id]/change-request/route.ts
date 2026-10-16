/**
 * @file app/api/workshop/packages/[id]/change-request/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { requestPackageChange, workshopErrorResponse } from '@/features/workshop/lib/service'

type Ctx = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const change = body.change ?? body
    const pkg = await requestPackageChange(supabase, params.id, {
      change: {
        name: change.name,
        quantity: change.quantity !== undefined ? Number(change.quantity) : undefined,
        uom: change.uom,
        location: change.location,
        crew: change.crew,
        note: change.note,
      },
      comment: body.comment ?? null,
    })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
