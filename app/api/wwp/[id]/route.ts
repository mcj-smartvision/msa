import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { addCommitment, closeWeeklyPlan, deleteDraftPlan, freezeWeeklyPlan } from '@/features/wwp/lib/service'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

type Ctx = { params: { id: string } }

/**
 * POST /api/wwp/:id { action: 'freeze' }                       — PM / planner, no later than Saturday
 * POST /api/wwp/:id { action: 'close' }                        — PM only, from Friday, all outcomes recorded
 * POST /api/wwp/:id { action: 'add_commitment', commitment }   — planner / site supervisor, DRAFT only
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    switch (body.action) {
      case 'freeze':
        return NextResponse.json({ plan: await freezeWeeklyPlan(supabase, params.id) })
      case 'close':
        return NextResponse.json({ plan: await closeWeeklyPlan(supabase, params.id) })
      case 'add_commitment': {
        const c = body.commitment ?? {}
        const commitment = await addCommitment(supabase, params.id, {
          taskId: c.taskId ?? null,
          packageId: c.packageId ?? null,
          wbsCode: c.wbsCode ?? null,
          description: String(c.description ?? ''),
          assignedTo: c.assignedTo ?? null,
          plannedOutput: c.plannedOutput == null ? null : Number(c.plannedOutput),
          outputUom: c.outputUom ?? null,
          sortOrder: c.sortOrder,
        })
        return NextResponse.json({ commitment }, { status: 201 })
      }
      default:
        throw new SiteOpsError('VALIDATION', 'action نامعتبر است (freeze | close | add_commitment)')
    }
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

/** DELETE /api/wwp/:id — only a DRAFT plan (planner / site supervisor). */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    await deleteDraftPlan(createClient(), params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
