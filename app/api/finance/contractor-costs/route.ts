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
import { buildContractorMonthlyCostModel } from '@/lib/finance/contractor-monthly-cost'

function taskDates(row: Record<string, unknown>): { start: string | null; finish: string | null } {
  return {
    start: toIsoDateOnly(
      (row.start_current as string) ?? (row.start_planned as string) ?? null
    ),
    finish: toIsoDateOnly(
      (row.finish_current as string) ?? (row.finish_planned as string) ?? null
    ),
  }
}

function isLeafTask(
  row: Record<string, unknown>,
  tasks: Array<Record<string, unknown>>,
  packages: Array<Record<string, unknown>>
): boolean {
  const id = String(row.id)
  if (row.is_summary) return false
  if (packages.some((pkg) => String(pkg.project_task_id ?? '') === id)) return false
  if (tasks.some((other) => String(other.parent_id ?? '') === id)) return false
  const wbs = String(row.wbs_code ?? '').trim()
  if (
    wbs &&
    tasks.some(
      (other) =>
        String(other.id) !== id && String(other.wbs_code ?? '').trim().startsWith(`${wbs}.`)
    )
  ) {
    return false
  }
  return true
}

function inheritContractorId(
  row: Record<string, unknown>,
  tasks: Array<Record<string, unknown>>
): string | null {
  if (row.subcontractor_id) return String(row.subcontractor_id)
  const parentId = row.parent_id ? String(row.parent_id) : ''
  if (!parentId) {
    const wbs = String(row.wbs_code ?? '').trim()
    if (!wbs.includes('.')) return null
    const parentWbs = wbs.slice(0, wbs.lastIndexOf('.'))
    const parent = tasks.find((item) => String(item.wbs_code ?? '').trim() === parentWbs)
    return parent ? inheritContractorId(parent, tasks) : null
  }
  const parent = tasks.find((item) => String(item.id) === parentId)
  return parent ? inheritContractorId(parent, tasks) : null
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const [{ data: tasks, error: taskError }, { data: packages, error: packageError }, { data: contractors }] =
      await Promise.all([
        supabase.from('project_tasks').select('*').eq('project_id', projectId),
        supabase.from('workshop_packages').select('*').eq('project_id', projectId),
        supabase.from('project_subcontractors').select('id, name').eq('project_id', projectId),
      ])
    if (taskError) throw new WorkshopError('VALIDATION', taskError.message)
    if (packageError) throw new WorkshopError('VALIDATION', packageError.message)

    const taskRows = (tasks ?? []) as Array<Record<string, unknown>>
    const packageRows = (packages ?? []) as Array<Record<string, unknown>>
    const names = new Map(
      (contractors ?? []).map((row) => [String(row.id), String(row.name ?? '')])
    )

    const rows: Array<{
      contractorId: string | null
      contractorName: string
      contractValue: number
      executed: number
      start: string | null
      finish: string | null
    }> = []
    const dateItems: Array<{ startDate: string | null; finishDate: string | null }> = []

    for (const row of taskRows) {
      if (!isLeafTask(row, taskRows, packageRows)) continue
      const dates = taskDates(row)
      const value = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0)
      const percent = schedulePhysicalPercent(row) ?? 0
      const contractorId = inheritContractorId(row, taskRows)
      dateItems.push({ startDate: dates.start, finishDate: dates.finish })
      rows.push({
        contractorId,
        contractorName: contractorId ? names.get(contractorId) || 'پیمانکار' : 'بدون پیمانکار',
        contractValue: value,
        executed: value * (percent / 100),
        start: dates.start,
        finish: dates.finish,
      })
    }

    for (const row of packageRows) {
      if (packageRows.some((other) => String(other.parent_package_id ?? '') === String(row.id))) {
        continue
      }
      const fields =
        row.schedule_fields && typeof row.schedule_fields === 'object'
          ? (row.schedule_fields as Record<string, unknown>)
          : {}
      const dates = {
        start: toIsoDateOnly((row.start_date as string) ?? null),
        finish: toIsoDateOnly((row.finish_date as string) ?? null),
      }
      const parentTask = row.project_task_id
        ? taskRows.find((task) => String(task.id) === String(row.project_task_id))
        : undefined
      const contractorId =
        row.subcontractor_id
          ? String(row.subcontractor_id)
          : parentTask
            ? inheritContractorId(parentTask, taskRows)
            : null
      const value = (Number(row.quantity) || 0) * readPackageUnitPrice(row)
      const percent = packageSchedulePhysicalPercent(fields) ?? 0
      dateItems.push({ startDate: dates.start, finishDate: dates.finish })
      rows.push({
        contractorId,
        contractorName: contractorId ? names.get(contractorId) || 'پیمانکار' : 'بدون پیمانکار',
        contractValue: value,
        executed: value * (percent / 100),
        start: dates.start,
        finish: dates.finish,
      })
    }

    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })
    const span = projectDateSpan(dateItems)
    const months = enumerateProjectJalaliMonths(span.start ?? todayIso, span.finish ?? todayIso)
    const model = buildContractorMonthlyCostModel({ months, rows })

    return NextResponse.json(model, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
