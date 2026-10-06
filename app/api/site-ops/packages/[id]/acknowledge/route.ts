import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { acknowledgeException } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json().catch(() => ({}))
    const pkg = await acknowledgeException(supabase, params.id, body.note)
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
