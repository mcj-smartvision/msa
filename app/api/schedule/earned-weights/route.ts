import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { persistEarnedWeights } from '@/features/schedule/lib/persist-earned-weights'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

/** POST /api/schedule/earned-weights  Body: { projectId } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = String(body.projectId ?? '')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }
    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const result = await persistEarnedWeights(supabase, projectId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof WorkshopError) return workshopErrorResponse(error)
    const message = error instanceof Error ? error.message : 'ذخیره وزن کسب‌شده ناموفق بود'
    const missing = /activity_earned_weights|progress_snapshots|schema cache|does not exist/i.test(
      message
    )
    return NextResponse.json(
      {
        error: missing
          ? 'جدول activity_earned_weights یا progress_snapshots هنوز ساخته نشده. فایل‌های database/93 و database/95 را در Supabase اجرا کنید.'
          : message,
      },
      { status: missing ? 503 : 500 }
    )
  }
}
