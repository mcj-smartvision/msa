import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPackage, workshopErrorResponse } from '@/lib/workshop/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const pkg = await createPackage(supabase, {
      projectId: String(body.projectId ?? body.project_id ?? ''),
      parentScheduleNodeId: body.parentScheduleNodeId ?? body.parent_schedule_node_id ?? null,
      parentPackageId: body.parentPackageId ?? body.parent_package_id ?? null,
      name: String(body.name ?? ''),
      quantity: Number(body.quantity),
      uom: String(body.uom ?? ''),
      location: body.location,
      crew: body.crew,
      note: body.note,
      flagForReview: Boolean(body.flagForReview ?? body.flag_for_review),
      reviewReason: body.reviewReason ?? body.review_reason,
      wbsCode: body.wbsCode ?? body.wbs_code ?? null,
      weightPercent:
        body.weightPercent !== undefined
          ? body.weightPercent
          : body.weight_percent !== undefined
            ? body.weight_percent
            : undefined,
    })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
