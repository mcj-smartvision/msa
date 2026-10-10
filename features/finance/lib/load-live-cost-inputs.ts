import type { SupabaseClient } from '@supabase/supabase-js'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { schedulePhysicalPercent } from '@/features/schedule/lib/physical-progress'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { enumerateProjectJalaliMonths, projectDateSpan } from '@/features/schedule/lib/monthly-deducted-weight'
import { taskCurrentDates as taskDates } from '@/features/schedule/lib/leaf-activities'
import { buildActivities as buildEvmActivities } from '@/features/evm/lib/load-project-evm'
import { listEmployerPurchases } from '@/features/finance/lib/employer-purchases-service'
import type { EmployerPurchase } from '@/features/finance/lib/employer-purchases'
import { loadOverheadMonths } from '@/features/finance/lib/overhead-months'
import type { OverheadMonthAmount } from '@/features/finance/lib/live-workshop-cost'
import type { CostActivity } from '@/features/finance/lib/workshop-cost-curve'

type Row = Record<string, unknown>

export interface LiveCostInputs {
  taskRows: Row[]
  packageRows: Row[]
  evm: ReturnType<typeof buildEvmActivities>
  /** Leaf activities with contract value and progress history (the contractor part of the cost). */
  leafActivities: CostActivity[]
  /** Leaf activities plus parent activities that only carry employer-purchase shares. */
  activities: CostActivity[]
  purchases: EmployerPurchase[]
  /** Recorded overhead months (empty when the workbook has none). */
  overheadMonths: OverheadMonthAmount[]
  /** Overhead months, or zero-amount Jalali months from the project start when none are recorded. */
  months: OverheadMonthAmount[]
}

async function loadPurchases(supabase: SupabaseClient, projectId: string): Promise<EmployerPurchase[]> {
  try {
    return await listEmployerPurchases(supabase, projectId)
  } catch (error) {
    if (error instanceof Error && /employer_purchase|schema cache|does not exist/i.test(error.message)) return []
    throw error
  }
}

/** Everything the live workshop cost model reads; the caller has already authorized project access. */
export async function loadLiveCostInputs(
  supabase: SupabaseClient,
  projectId: string,
  todayIso: string
): Promise<LiveCostInputs> {
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
    progressRes.error && /task_progress_updates|schema cache|does not exist/i.test(progressRes.error.message)
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

  const taskRows = (tasks ?? []) as Row[]
  const packageRows = (packages ?? []) as Row[]
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

  return { taskRows, packageRows, evm, leafActivities, activities, purchases, overheadMonths, months }
}
