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
