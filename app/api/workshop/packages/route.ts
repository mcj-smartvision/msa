import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkPackageSiblingWeights, createPackage, workshopErrorResponse } from '@/lib/workshop/service'

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
      quantityCertainty: body.quantityCertainty ?? body.quantity_certainty,
      unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : undefined,
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
      subcontractorId:
        body.subcontractorId !== undefined
          ? body.subcontractorId
          : body.subcontractor_id !== undefined
            ? body.subcontractor_id
            : undefined,
      scheduleFields: body.scheduleFields ?? body.schedule_fields,
      startDate:
        body.startDate !== undefined
          ? body.startDate
          : body.start_date !== undefined
            ? body.start_date
            : undefined,
      finishDate:
        body.finishDate !== undefined
          ? body.finishDate
          : body.finish_date !== undefined
            ? body.finish_date
            : undefined,
    })
    const weightWarning = await checkPackageSiblingWeights(supabase, pkg).catch(() => null)
    return NextResponse.json({ package: pkg, weightWarning })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
