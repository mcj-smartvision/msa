import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectTask } from '@/types/schedule'
import { fetchProjectTasksSummary } from '@/lib/schedule/msp-import'
import { compareWbs } from '@/lib/schedule/wbs-utils'
import { nextChildWbs } from '@/lib/workshop/wbs-numbering'
import {
  readPackageQuantityCertainty,
  readPackageUnitPrice,
} from '@/lib/workshop/package-commercial'

type PackageRow = {
  id: string
  project_id: string
  project_task_id?: string | null
  parent_package_id?: string | null
  name: string
  wbs_code?: string | null
  quantity?: number | null
  quantity_certainty?: string | null
  unit_price?: number | null
  uom?: string | null
  start_date?: string | null
  finish_date?: string | null
  weight_percent?: number | null
  subcontractor_id?: string | null
  schedule_fields?: Record<string, unknown> | null
  approval_status?: string | null
  status?: string | null
  created_at: string
  updated_at: string
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const day = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return `${day}T12:00:00.000Z`
}

/** Derive WBS for packages when DB lacks workshop_packages.wbs_code (migration 49). */
function resolvePackageWbsCodes(
  packages: PackageRow[],
  taskWbsById: Map<string, string | null>
): Map<string, string> {
  const byId = new Map(packages.map((row) => [row.id, row]))
  const resolved = new Map<string, string>()
  const childrenOfTask = new Map<string, PackageRow[]>()
  const childrenOfPackage = new Map<string, PackageRow[]>()

  for (const row of packages) {
    if (row.wbs_code?.trim()) {
      resolved.set(row.id, row.wbs_code.trim())
      continue
    }
    if (row.parent_package_id) {
      const list = childrenOfPackage.get(row.parent_package_id) ?? []
      list.push(row)
      childrenOfPackage.set(row.parent_package_id, list)
    } else if (row.project_task_id) {
      const list = childrenOfTask.get(row.project_task_id) ?? []
      list.push(row)
      childrenOfTask.set(row.project_task_id, list)
    }
  }

  const assignUnder = (parentWbs: string | null, kids: PackageRow[]) => {
    kids
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .forEach((kid, index) => {
        if (!resolved.has(kid.id)) {
          resolved.set(kid.id, nextChildWbs(parentWbs, index))
        }
        const nested = childrenOfPackage.get(kid.id) ?? []
        if (nested.length) assignUnder(resolved.get(kid.id) ?? null, nested)
      })
  }

  for (const [taskId, kids] of childrenOfTask) {
    assignUnder(taskWbsById.get(taskId) ?? null, kids)
  }

  // Orphan package trees (no task parent) — still assign local codes
  for (const row of packages) {
    if (resolved.has(row.id)) continue
    if (row.parent_package_id && byId.has(row.parent_package_id)) continue
    assignUnder(null, [row])
  }

  for (const row of packages) {
    if (!resolved.has(row.id)) resolved.set(row.id, row.id.slice(0, 8))
  }

  return resolved
}

function packageToPreviewTask(row: PackageRow, wbs: string | null): ProjectTask {
  const start = toIsoDate(row.start_date)
  const finish = toIsoDate(row.finish_date)
  const fields = (row.schedule_fields ?? {}) as Record<string, unknown>
  const totalFloat =
    fields.total_float_days == null || fields.total_float_days === ''
      ? null
      : Number(fields.total_float_days)
  const certainty = readPackageQuantityCertainty(row as Record<string, unknown>)
  const unitPrice = readPackageUnitPrice(row as Record<string, unknown>)

  return {
    id: row.id,
    project_id: row.project_id,
    msp_uid: null,
    external_id: null,
    wbs_code: wbs,
    outline_number: wbs,
    outline_level: wbs ? wbs.split('.').length : null,
    name: row.name,
    start_planned: start,
    finish_planned: finish,
    start_current: start,
    finish_current: finish,
    baseline_start: start,
    baseline_finish: finish,
    percent_complete:
      Number(fields.physical_percent_complete ?? fields.percent_complete ?? 0) || 0,
    physical_percent_complete:
      fields.physical_percent_complete == null
        ? Number(fields.percent_complete ?? 0) || 0
        : Number(fields.physical_percent_complete),
    is_critical: Boolean(fields.is_critical),
    is_summary: false,
    is_milestone: false,
    schedule_weight:
      row.weight_percent == null ? null : Number(row.weight_percent),
    physical_weight:
      row.weight_percent == null ? null : Number(row.weight_percent),
    duration_days:
      fields.duration_days == null ? null : Number(fields.duration_days),
    remaining_duration_days: null,
    total_float_days:
      fields.total_float_days == null || fields.total_float_days === ''
        ? null
        : Number(fields.total_float_days),
    free_float_days: null,
    notes: null,
    subcontractor_id: row.subcontractor_id ?? null,
    resolved_subcontractor_id: row.subcontractor_id ?? null,
    quantity_certainty: certainty,
    unit_price: unitPrice,
    schedule_quantity: Number(row.quantity ?? 0) || 0,
    schedule_uom: row.uom || 'm',
    row_origin: 'package',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function fetchWorkshopPackageRows(
  supabase: SupabaseClient,
  projectId: string
) {
  const attempts = [
    '*',
    'id, project_id, project_task_id, parent_package_id, name, location, quantity, uom, status, origin, approval_status, schedule_fields, start_date, finish_date, subcontractor_id, quantity_certainty, unit_price, weight_percent, wbs_code, created_at, updated_at',
    'id, project_id, project_task_id, parent_package_id, name, location, quantity, uom, status, origin, approval_status, schedule_fields, created_at, updated_at',
    'id, project_id, project_task_id, parent_package_id, name, quantity, uom, status, created_at, updated_at',
  ] as const

  let lastError: { message: string; code?: string } | null = null
  for (const columns of attempts) {
    const result = await supabase
      .from('workshop_packages')
      .select(columns)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (!result.error) return result
    lastError = result.error
    if (result.error.code === '42P01') return result
    if (!/does not exist/i.test(result.error.message ?? '')) return result
  }
  return { data: null, error: lastError }
}

/**
 * Same commercial tree as ویرایش برنامه: MSP tasks + workshop زیرشاخه‌ها.
 * Used by ارسال برنامه so saves in EDIT appear without re-import.
 */
export async function fetchSchedulePreviewWithPackages(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  count: number
  tasks: ProjectTask[]
  packagePredecessorLabels?: Record<string, string>
}> {
  const [taskSummary, packagesResult] = await Promise.all([
    fetchProjectTasksSummary(supabase, projectId),
    fetchWorkshopPackageRows(supabase, projectId),
  ])

  if (packagesResult.error) {
    if (packagesResult.error.code === '42P01') {
      return {
        count: taskSummary.count,
        tasks: taskSummary.tasks.map((t) => ({ ...t, row_origin: 'task' as const })),
      }
    }
    throw new Error(packagesResult.error.message)
  }

  const taskRows = taskSummary.tasks.map((t) => {
    const physical =
      t.physical_percent_complete != null && Number.isFinite(Number(t.physical_percent_complete))
        ? Number(t.physical_percent_complete)
        : Number(t.percent_complete) || 0
    return {
      ...t,
      row_origin: 'task' as const,
      schedule_quantity: t.schedule_quantity ?? t.quantity ?? null,
      schedule_uom: t.schedule_uom ?? t.uom ?? null,
      percent_complete: physical,
      physical_percent_complete: physical,
    }
  })

  const packages = (packagesResult.data ?? []) as PackageRow[]
  const taskWbsById = new Map(
    taskSummary.tasks.map((task) => [task.id, task.wbs_code ?? null])
  )
  const wbsByPackageId = resolvePackageWbsCodes(packages, taskWbsById)
  const packagePredecessorLabels: Record<string, string> = {}
  const packageRows = packages.map((row) => {
    const fields =
      row.schedule_fields && typeof row.schedule_fields === 'object'
        ? (row.schedule_fields as Record<string, unknown>)
        : {}
    const pred = fields.predecessors ?? fields.predecessor_label
    if (pred != null && String(pred).trim()) {
      packagePredecessorLabels[row.id] = String(pred).trim()
    }
    return packageToPreviewTask(row, wbsByPackageId.get(row.id) ?? row.wbs_code ?? null)
  })

  const tasks = [...taskRows, ...packageRows].sort((a, b) =>
    compareWbs(a.wbs_code, b.wbs_code)
  )

  return { count: tasks.length, tasks, packagePredecessorLabels }
}
