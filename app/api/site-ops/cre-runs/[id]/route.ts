/**
 * @file app/api/site-ops/cre-runs/[id]/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/service, features/site-ops/lib/http
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getCreRun } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const run = await getCreRun(supabase, params.id)
    return NextResponse.json({ run })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
