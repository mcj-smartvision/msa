import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { parseEmployerPurchaseInput } from '@/features/finance/lib/employer-purchases'
import {
  createEmployerPurchase,
  listEmployerPurchases,
  listPurchaseTaskOptions,
  purchaseErrorResponse,
} from '@/features/finance/lib/employer-purchases-service'

/** GET /api/finance/employer-purchases?projectId= — the project's purchases and the activities they can be shared to. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')
    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const [purchases, tasks] = await Promise.all([
      listEmployerPurchases(supabase, projectId),
      listPurchaseTaskOptions(supabase, projectId),
    ])
    return NextResponse.json({ purchases, tasks }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return purchaseErrorResponse(error)
  }
}

/** POST /api/finance/employer-purchases — body: { projectId, ...purchase, allocations: [{ taskId, sharePercent }] } */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const projectId = String(body.projectId ?? '')
    if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')
    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const id = await createEmployerPurchase(supabase, projectId, parseEmployerPurchaseInput(body))
    return NextResponse.json({ id })
  } catch (error) {
    return purchaseErrorResponse(error)
  }
}
