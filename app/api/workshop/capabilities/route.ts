import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getWorkshopCapabilities, workshopErrorResponse } from '@/features/workshop/lib/service'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    const supabase = createClient()
    const capabilities = await getWorkshopCapabilities(supabase, projectId)
    return NextResponse.json(capabilities)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
