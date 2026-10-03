import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { WorkshopError } from '@/lib/workshop/domain'
import { workshopErrorResponse } from '@/lib/workshop/service'
import { readPackageUnitPrice } from '@/lib/workshop/package-commercial'
import {
  packageSchedulePhysicalPercent,
  schedulePhysicalPercent,
} from '@/lib/schedule/physical-progress'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import {
  enumerateProjectJalaliMonths,
  projectDateSpan,
} from '@/lib/schedule/monthly-deducted-weight'
import {
  buildLiveWorkshopCostModel,
  type ContractorActivityCost,
} from '@/lib/finance/live-workshop-cost'
import { loadOverheadMonths } from '@/lib/finance/overhead-months'
import {
  isLeafPackage,
  isLeafTask,
  taskCurrentDates as taskDates,
} from '@/lib/schedule/leaf-activities'
import { todayTehranIso } from '@/lib/time/tehran'

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
    ] = await Promise.all([
      loadOverheadMonths(supabase, projectId),
      supabase.from('project_tasks').select('*').eq('project_id', projectId),
      supabase.from('workshop_packages').select('*').eq('project_id', projectId),
      supabase
        .from('task_progress_updates')
        .select('task_id, progress_date, percent_complete')
        .eq('project_id', projectId)
        .order('progress_date', { ascending: true }),
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
    const activities: ContractorActivityCost[] = []
    const dateSpanItems: Array<{ startDate: string | null; finishDate: string | null }> = []

    for (const row of taskRows) {
      if (!isLeafTask(row, taskRows, packageRows)) continue
      const dates = taskDates(row)
      dateSpanItems.push({ startDate: dates.start, finishDate: dates.finish })
      activities.push({
        id: String(row.id),
        contractValue: (Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
        currentPercent: schedulePhysicalPercent(row) ?? 0,
        start: dates.start,
        finish: dates.finish,
        progressHistory: historyById.get(String(row.id)) ?? [],
      })
    }

    for (const row of packageRows) {
      if (!isLeafPackage(row, packageRows)) continue
      const fields =
        row.schedule_fields && typeof row.schedule_fields === 'object'
          ? (row.schedule_fields as Record<string, unknown>)
          : {}
      const dates = {
        start: toIsoDateOnly((row.start_date as string) ?? null),
        finish: toIsoDateOnly((row.finish_date as string) ?? null),
      }
      dateSpanItems.push({ startDate: dates.start, finishDate: dates.finish })
      activities.push({
        id: String(row.id),
        contractValue: (Number(row.quantity) || 0) * readPackageUnitPrice(row),
        currentPercent: packageSchedulePhysicalPercent(fields) ?? 0,
        start: dates.start,
        finish: dates.finish,
        progressHistory: historyById.get(String(row.id)) ?? [],
      })
    }

    const span = projectDateSpan(dateSpanItems)
    const start = span.start ?? overheadMonths[0]?.startIso ?? todayIso
    const months = enumerateProjectJalaliMonths(start, todayIso)
    const model = buildLiveWorkshopCostModel({
      overheadMonths:
        overheadMonths.length > 0
          ? overheadMonths
          : months.map((month) => ({
              startIso: month.startIso,
              endIso: month.endIso,
              label: month.label,
              amountToman: 0,
            })),
      activities,
      todayIso,
    })

    return NextResponse.json(
      {
        ...model,
        activityCount: activities.length,
        monthLabels: overheadMonths.map((month) => month.label),
        monthAmounts: overheadMonths.map((month) => month.amountToman),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
