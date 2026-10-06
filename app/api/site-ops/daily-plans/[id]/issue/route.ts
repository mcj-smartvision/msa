import { NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { issuePlan } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const plan = await issuePlan(supabase, params.id)
    return NextResponse.json({ plan })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
