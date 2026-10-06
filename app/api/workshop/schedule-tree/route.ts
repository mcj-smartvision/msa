import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getScheduleTree, workshopErrorResponse } from '@/features/workshop/lib/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است', code: 'VALIDATION' }, { status: 400 })
    }
    const tree = await getScheduleTree(supabase, projectId)
    return NextResponse.json(tree, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
