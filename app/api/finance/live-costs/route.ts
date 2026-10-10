import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import { buildLiveWorkshopCostModel } from '@/features/finance/lib/live-workshop-cost'
import { buildCostCurve, buildItemCosts } from '@/features/finance/lib/workshop-cost-curve'
import { loadLiveCostInputs } from '@/features/finance/lib/load-live-cost-inputs'
import { buildLiveCostTraces } from '@/features/finance/lib/live-cost-traces'
import { attachTraceHistory } from '@/features/calc-trace/lib/history'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import { todayTehranIso } from '@/shared/lib/time/tehran'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const todayIso = todayTehranIso()

    const { evm, leafActivities, activities, purchases, overheadMonths, months } = await loadLiveCostInputs(
      supabase,
      projectId,
      todayIso
    )
    const datedPurchases = purchases.map((p) => ({ date: p.purchaseDate, amount: p.amount }))
    const model = buildLiveWorkshopCostModel({
      overheadMonths: months,
      activities: leafActivities,
      purchases: datedPurchases,
      todayIso,
    })
    const items = buildItemCosts({ overheadMonths: months, activities, purchases, todayIso })
    const curve = buildCostCurve({ overheadMonths: months, activities, purchases: datedPurchases, todayIso })

    let traces
    if (await isSystemAdmin(supabase, user.id)) {
      traces = buildLiveCostTraces({ model, curve, budgetBasis: evm.basis, activities: leafActivities })
      await attachTraceHistory(createServiceClient(), projectId, traces, todayIso)
    }

    return NextResponse.json(
      {
        ...model,
        activityCount: leafActivities.length,
        monthLabels: overheadMonths.map((month) => month.label),
        monthAmounts: overheadMonths.map((month) => month.amountToman),
        budgetBasis: evm.basis,
        curve,
        items: { ...items, rows: items.rows.sort((a, b) => compareWbs(a.wbs, b.wbs)) },
        ...(traces ? { traces } : {}),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
