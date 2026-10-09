import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import { schedulePhysicalPercent } from '@/features/schedule/lib/physical-progress'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import {
enumerateProjectJalaliMonths,
projectDateSpan,
} from '@/features/schedule/lib/monthly-deducted-weight'
import { buildLiveWorkshopCostModel } from '@/features/finance/lib/live-workshop-cost'
import { buildCostCurve, buildItemCosts, type CostActivity } from '@/features/finance/lib/workshop-cost-curve'
import { listEmployerPurchases } from '@/features/finance/lib/employer-purchases-service'
import type { EmployerPurchase } from '@/features/finance/lib/employer-purchases'
import { loadOverheadMonths } from '@/features/finance/lib/overhead-months'
import { buildActivities as buildEvmActivities } from '@/features/evm/lib/load-project-evm'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import { taskCurrentDates as taskDates } from '@/features/schedule/lib/leaf-activities'
import { todayTehranIso } from '@/shared/lib/time/tehran'

async function loadPurchases(
  supabase: ReturnType<typeof createClient>,
  projectId: string
): Promise<EmployerPurchase[]> {
  try {
    return await listEmployerPurchases(supabase, projectId)
  } catch (error) {
    if (error instanceof Error && /employer_purchase|schema cache|does not exist/i.test(error.message)) return []
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const todayIso = todayTehranIso()

    const [
      overheadMonths,
      { data: tasks, error: taskError },
      { data: packages, error: packageError },
      progressRes,
      project,
      purchases,
    ] = await Promise.all([
      loadOverheadMonths(supabase, projectId),
      supabase.from('project_tasks').select('*').eq('project_id', projectId),
      supabase.from('workshop_packages').select('*').eq('project_id', projectId),
      supabase
        .from('task_progress_updates')
        .select('task_id, progress_date, percent_complete')
        .eq('project_id', projectId)
        .order('progress_date', { ascending: true }),
      supabase.from('projects').select('budget').eq('id', projectId).maybeSingle(),
      loadPurchases(supabase, projectId),
    ])

    if (taskError) throw new WorkshopError('VALIDATION', taskError.message)
    if (packageError) throw new WorkshopError('VALIDATION', packageError.message)
    const progressRows =
      progressRes.error &&
      /task_progress_updates|schema cache|does not exist/i.test(progressRes.error.message)
        ? []
        : (progressRes.data ?? [])

    const historyById = new Map<string, Array<{ date: string; percent: number }>>()
    for (const row of progressRows ?? []) {
      const id = String((row as { task_id?: string }).task_id ?? '').replace(/^package:/, '')
      const date = toIsoDateOnly((row as { progress_date?: string }).progress_date ?? null)
      const percent = Number((row as { percent_complete?: number }).percent_complete)
      if (!id || !date || !Number.isFinite(percent)) continue
      const list = historyById.get(id) ?? []
      list.push({ date, percent })
      historyById.set(id, list)
    }

    const taskRows = (tasks ?? []) as Array<Record<string, unknown>>
    const packageRows = (packages ?? []) as Array<Record<string, unknown>>
    const tasksById = new Map(taskRows.map((row) => [String(row.id), row]))
    const packagesById = new Map(packageRows.map((row) => [String(row.id), row]))
    const projectBudget = project.data?.budget != null ? Number(project.data.budget) : null
    const evm = buildEvmActivities(taskRows, packageRows, projectBudget)

    const leafActivities: CostActivity[] = evm.activities.map((a) => {
      const pkg = a.kind === 'package' ? packagesById.get(a.id) : undefined
      const dates = pkg
        ? {
            start: toIsoDateOnly((pkg.start_date as string) ?? null),
            finish: toIsoDateOnly((pkg.finish_date as string) ?? null),
          }
        : taskDates(tasksById.get(a.id) ?? {})
      return {
        ...a,
        contractValue: a.quantity * a.unitPrice,
        currentPercent: a.physicalPercent,
        start: dates.start,
        finish: dates.finish,
        progressHistory: historyById.get(a.id) ?? [],
      }
    })

    // Purchases may be shared to an activity whose packages are the leaves; it carries no contract value or weight of its own.
    const activities = [...leafActivities]
    const known = new Set(activities.map((a) => a.id))
    for (const taskId of new Set(purchases.flatMap((p) => p.allocations.map((al) => al.taskId)))) {
      const row = taskId && !known.has(taskId) ? tasksById.get(taskId) : undefined
      if (!row) continue
      const dates = taskDates(row)
      known.add(taskId!)
      activities.push({
        id: taskId!,
        name: String(row.name ?? ''),
        wbs: row.wbs_code ? String(row.wbs_code) : null,
        budget: 0,
        weight: 0,
        baselineStart: null,
        baselineFinish: null,
        physicalPercent: schedulePhysicalPercent(row) ?? 0,
        contractValue: 0,
        currentPercent: schedulePhysicalPercent(row) ?? 0,
        start: dates.start,
        finish: dates.finish,
        progressHistory: historyById.get(taskId!) ?? [],
      })
    }

    const span = projectDateSpan(leafActivities.map((a) => ({ startDate: a.start, finishDate: a.finish })))
    const start = span.start ?? overheadMonths[0]?.startIso ?? todayIso
    const months =
      overheadMonths.length > 0
        ? overheadMonths
        : enumerateProjectJalaliMonths(start, todayIso).map((month) => ({
            startIso: month.startIso,
            endIso: month.endIso,
            label: month.label,
            amountToman: 0,
          }))
    const datedPurchases = purchases.map((p) => ({ date: p.purchaseDate, amount: p.amount }))
    const model = buildLiveWorkshopCostModel({
      overheadMonths: months,
      activities: leafActivities,
      purchases: datedPurchases,
      todayIso,
    })
    const items = buildItemCosts({ overheadMonths: months, activities, purchases, todayIso })

    return NextResponse.json(
      {
        ...model,
        activityCount: leafActivities.length,
        monthLabels: overheadMonths.map((month) => month.label),
        monthAmounts: overheadMonths.map((month) => month.amountToman),
        budgetBasis: evm.basis,
        curve: buildCostCurve({ overheadMonths: months, activities, purchases: datedPurchases, todayIso }),
        items: { ...items, rows: items.rows.sort((a, b) => compareWbs(a.wbs, b.wbs)) },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
