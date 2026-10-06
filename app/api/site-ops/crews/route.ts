import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { ensureDefaultCrew, listCrews } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required', code: 'VALIDATION' }, { status: 400 })
    }
    const crews = await listCrews(supabase, projectId)
    return NextResponse.json({ crews })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const projectId = String(body.projectId ?? body.project_id ?? '')
    const name = String(body.name ?? '').trim()
    if (!projectId || !name) {
      return NextResponse.json(
        { error: 'projectId and name are required', code: 'VALIDATION' },
        { status: 400 }
      )
    }
    const crew = await ensureDefaultCrew(supabase, projectId, name)
    return NextResponse.json({ crew })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
