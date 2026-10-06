import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { persistPlannedWeights } from '@/features/schedule/lib/persist-planned-weights'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/**
 * POST /api/schedule/planned-weights
 * Body: { projectId, activityId? }
 * Writes planned monthly weights once. Skips activities whose baseline is unchanged.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = String(body.projectId ?? '')
    const activityId = typeof body.activityId === 'string' ? body.activityId : undefined
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const result = await persistPlannedWeights(supabase, projectId, activityId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'ذخیره وزن طراحی‌شده ناموفق بود'
    const missing = /activity_planned_weights|schema cache|does not exist/i.test(message)
    return NextResponse.json(
      {
        error: missing
          ? 'جدول activity_planned_weights هنوز ساخته نشده. فایل database/94-activity-planned-weights.sql را در Supabase اجرا کنید.'
          : message,
      },
      { status: missing ? 503 : 500 }
    )
  }
}
