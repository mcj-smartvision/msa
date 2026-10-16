/**
 * @file app/api/workshop/packages/[id]/comment/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { commentOnPackage, workshopErrorResponse } from '@/features/workshop/lib/service'

type Ctx = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const result = await commentOnPackage(supabase, params.id, String(body.comment ?? ''))
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
