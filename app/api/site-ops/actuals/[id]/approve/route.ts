/**
 * @file app/api/site-ops/actuals/[id]/approve/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/service, features/site-ops/lib/http
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { decideActual } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json().catch(() => ({}))
    const approve = body.approve !== false && body.status !== 'REJECTED'
    const actual = await decideActual(supabase, params.id, approve)
    return NextResponse.json({ actual })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
