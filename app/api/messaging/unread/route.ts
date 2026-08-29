import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { messagingErrorResponse, unreadTotal, unreadTotalAllProjects } from '@/lib/messaging/service'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    const supabase = createClient()
    const unread = projectId
      ? await unreadTotal(supabase, projectId)
      : await unreadTotalAllProjects(supabase)
    return NextResponse.json({ unread })
  } catch (error) {
    return messagingErrorResponse(error)
  }
}
