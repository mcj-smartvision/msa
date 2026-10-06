import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
assertProjectMember,
loadQcEngineDashboard,
requireQcEngineUser,
} from '@/features/qc/engine/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { user, context } = await requireQcEngineUser(supabase)
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    await assertProjectMember(supabase, user.id, projectId, context.isSystemAdmin)
    const data = await loadQcEngineDashboard(projectId)
    return NextResponse.json(data)
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'بارگذاری ناموفق بود' },
      { status }
    )
  }
}
