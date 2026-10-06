import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { listApprovalInbox, workshopErrorResponse } from '@/features/workshop/lib/service'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    const supabase = createClient()
    const result = await listApprovalInbox(supabase, projectId)
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
