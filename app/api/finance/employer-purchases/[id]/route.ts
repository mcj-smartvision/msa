import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { parseEmployerPurchaseInput } from '@/features/finance/lib/employer-purchases'
import {
  deleteEmployerPurchase,
  purchaseErrorResponse,
  updateEmployerPurchase,
} from '@/features/finance/lib/employer-purchases-service'

async function authorize(projectId: string) {
  if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')
  const supabase = createClient()
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  return supabase
}

/** PATCH /api/finance/employer-purchases/:id — replaces the purchase and its shares. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const projectId = String(body.projectId ?? '')
    const supabase = await authorize(projectId)
    await updateEmployerPurchase(supabase, projectId, params.id, parseEmployerPurchaseInput(body))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return purchaseErrorResponse(error)
  }
}

/** DELETE /api/finance/employer-purchases/:id?projectId= */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    const supabase = await authorize(projectId)
    await deleteEmployerPurchase(supabase, projectId, params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return purchaseErrorResponse(error)
  }
}
