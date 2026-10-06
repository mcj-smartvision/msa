import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectMember, createInspectableItem, requireQcEngineUser } from '@/features/qc/engine/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { user, context, canWrite } = await requireQcEngineUser(supabase)
    if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    if (!projectId) return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    await assertProjectMember(supabase, user.id, projectId, context.isSystemAdmin)
    const item = await createInspectableItem({
      projectId,
      code: String(body.code ?? ''),
      name: body.name,
      disciplineKey: String(body.disciplineKey ?? ''),
      topicKey: String(body.topicKey ?? ''),
      elementTypeKey: String(body.elementTypeKey ?? ''),
      floor: body.floor,
      gridX: body.gridX,
      gridY: body.gridY,
      createdBy: user.id,
    })
    return NextResponse.json({ item })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ثبت آیتم ناموفق بود' },
      { status }
    )
  }
}
