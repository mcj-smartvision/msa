import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteCommitment, recordCommitmentOutcome, updateCommitment } from '@/lib/wwp/service'
import { workshopErrorResponse } from '@/lib/workshop/service'

type Ctx = { params: { id: string } }

/**
 * PATCH /api/wwp/commitments/:id
 *   { outcome: { isCompleted, rootCauseCategory?, rootCauseNote?, actualOutput? } } — PM only, FROZEN week
 *   { description?, taskId?, packageId?, wbsCode?, assignedTo?, plannedOutput?, outputUom?, sortOrder? }
 *                                                                                — planner / supervisor, DRAFT
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    if (body.outcome) {
      const o = body.outcome
      const commitment = await recordCommitmentOutcome(supabase, params.id, {
        isCompleted: Boolean(o.isCompleted),
        rootCauseCategory: o.rootCauseCategory ?? null,
        rootCauseNote: o.rootCauseNote ?? null,
        actualOutput: o.actualOutput === undefined ? undefined : o.actualOutput == null ? null : Number(o.actualOutput),
      })
      return NextResponse.json({ commitment })
    }
    const commitment = await updateCommitment(supabase, params.id, {
      description: body.description,
      taskId: body.taskId,
      packageId: body.packageId,
      wbsCode: body.wbsCode,
      assignedTo: body.assignedTo,
      plannedOutput: body.plannedOutput === undefined ? undefined : body.plannedOutput == null ? null : Number(body.plannedOutput),
      outputUom: body.outputUom,
      sortOrder: body.sortOrder,
    })
    return NextResponse.json({ commitment })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

/** DELETE /api/wwp/commitments/:id — DRAFT week only (planner / site supervisor). */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    await deleteCommitment(createClient(), params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
