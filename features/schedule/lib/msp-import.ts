import type { SupabaseClient } from '@supabase/supabase-js'
import type { MspImportResult, ProjectTask, ScheduleImport } from '@/shared/types/schedule'
import { parseMspXml } from '@/features/schedule/lib/msp-parser'
import { computeBaselineStartFromTasks } from '@/features/schedule/lib/dates'
import { setScheduleBaselineAfterImport } from '@/features/schedule/lib/apply-actual-start'
import { sortTasksByScheduleDate } from '@/features/schedule/lib/task-view-date'
import { storeScheduleXml } from '@/features/schedule/lib/schedule-files'
import { wipeProjectScheduleBeforeImport } from '@/features/schedule/lib/wipe-project-schedule'
import {
carrySupervisorProgress,
reapplyCarriedSupervisorProgress,
} from '@/features/schedule/lib/reapply-supervisor-progress'
import { validateMspImport, type MspImportReport } from '@/features/schedule/lib/msp-import-validate'
import { runProjectCpmCalculation } from '@/features/schedule/lib/run-project-cpm'

export interface MspParsedTask {
  msp_uid: number
  external_id?: string | null
  wbs_code: string | null
  outline_number?: string | null
  outline_level?: number | null
  name: string
  start_planned: string | null
  finish_planned: string | null
  percent_complete: number
  physical_percent_complete?: number | null
  is_critical: boolean
  is_summary: boolean
  is_milestone?: boolean
  /** Activity weight from MSP custom field (وزن) */
  schedule_weight: number | null
  /** Number1 / physical weight */
  physical_weight?: number | null
  duration_days?: number | null
  remaining_duration_days?: number | null
  obs_code?: string | null
  cbs_code?: string | null
  constraint_type?: string | null
  constraint_date?: string | null
  deadline?: string | null
  baseline_start?: string | null
  baseline_finish?: string | null
  baseline_duration_days?: number | null
  baseline_cost?: number | null
  baseline_work_hours?: number | null
  actual_start?: string | null
  actual_finish?: string | null
  work_hours?: number | null
  cost?: number | null
  fixed_cost?: number | null
  notes?: string | null
  flag?: boolean
  priority?: number | null
  is_manual_scheduled?: boolean
  has_split?: boolean
  is_recurring_master?: boolean
  parent_msp_uid?: number | null
}

export interface MspParsedDependency {
  predecessor_uid: number
  successor_uid: number
  relation_type: 'FS' | 'SS' | 'FF' | 'SF'
  lag_duration: number
  lag_days?: number | null
  lag_is_percentage?: boolean
}

export interface MspParsedResource {
  msp_uid: number
  name: string
  type: 'work' | 'material' | 'cost'
  standard_rate?: number | null
  unit_of_measure?: string | null
  wasUnnamed?: boolean
}

export interface MspParsedAssignment {
  task_uid: number
  resource_uid: number
  units_percent?: number | null
  work_hours?: number | null
  cost?: number | null
}

export interface MspParsedSegment {
  task_uid: number
  segment_start: string
  segment_finish: string
  sort_order: number
}

export interface MspParsedCalendar {
  msp_uid: number
  name: string
  working_days: Record<string, boolean>
  daily_shifts: Array<{ start: string; end: string }>
  exceptions: unknown[]
  minutes_per_day: number
  is_default?: boolean
}

export interface MspParseResult {
  tasks: MspParsedTask[]
  dependencies: MspParsedDependency[]
  resources: MspParsedResource[]
  assignments: MspParsedAssignment[]
  segments: MspParsedSegment[]
  calendars: MspParsedCalendar[]
  unnamedResourceCount: number
}

export { parseMspXml }

export type MspImportPreviewResult = {
  dry_run: true
  report: MspImportReport
  tasks_found: number
  dependencies_found: number
  resources_found: number
  file_name: string
}

export type MspImportCommitResult = MspImportResult & {
  dry_run?: false
  report: MspImportReport
}

/** Parse + validate only — no wipe / insert. */
export function previewMspImport(
  fileName: string,
  xmlContent: string
): MspImportPreviewResult {
  const parsed = parseMspXml(xmlContent)
  const report = validateMspImport(parsed.tasks, parsed.dependencies, {
    unnamedResourceCount: parsed.unnamedResourceCount,
  })
  return {
    dry_run: true,
    report,
    tasks_found: parsed.tasks.length,
    dependencies_found: parsed.dependencies.length,
    resources_found: parsed.resources.length,
    file_name: fileName,
  }
}

/** Persist parsed MSP data into Supabase (idempotent by project_id + msp_uid). */
export async function importMspScheduleToProject(
  supabase: SupabaseClient,
  projectId: string,
  fileName: string,
  xmlContent: string,
  importedBy: string,
  options?: { dryRun?: boolean; skipCpm?: boolean }
): Promise<MspImportPreviewResult | MspImportCommitResult> {
  const parsed = parseMspXml(xmlContent)
  const report = validateMspImport(parsed.tasks, parsed.dependencies, {
    unnamedResourceCount: parsed.unnamedResourceCount,
  })

  if (options?.dryRun) {
    return {
      dry_run: true,
      report,
      tasks_found: parsed.tasks.length,
      dependencies_found: parsed.dependencies.length,
      resources_found: parsed.resources.length,
      file_name: fileName,
    }
  }

  if (report.blocked) {
    throw new Error(
      report.issues.find((i) => i.code === 'CYCLE')?.message ??
        'Import متوقف شد: حلقه در وابستگی‌ها'
    )
  }

  const { data: importRow, error: importError } = await supabase
    .from('schedule_imports')
    .insert({
      project_id: projectId,
      file_name: fileName,
      status: 'processing',
      imported_by: importedBy,
    })
    .select()
    .single()

  if (importError) throw new Error(importError.message)

  try {
    try {
      const storagePath = await storeScheduleXml(projectId, importRow.id, xmlContent)
      await supabase
        .from('schedule_imports')
        .update({ storage_path: storagePath, storage_bucket: 'project-schedules' })
        .eq('id', importRow.id)
    } catch {
      /* storage optional */
    }

    // Keep direct contractor assignments across full MSP replacement. UID is the
    // primary stable key; WBS is a fallback when the source regenerated UIDs.
    const priorContractorByUid = new Map<number, string>()
    const priorContractorByWbs = new Map<string, string>()
    const priorCertaintyByUid = new Map<number, 'حدودی' | 'قطعی'>()
    const priorCertaintyByWbs = new Map<string, 'حدودی' | 'قطعی'>()
    const priorUnitPriceByUid = new Map<number, number>()
    const priorUnitPriceByWbs = new Map<string, number>()
    const priorQuery = await supabase
      .from('project_tasks')
      .select('msp_uid, wbs_code, subcontractor_id, quantity_certainty, unit_price')
      .eq('project_id', projectId)
    let priorAssignments:
      | Array<{
          msp_uid: unknown
          wbs_code: unknown
          subcontractor_id: unknown
          quantity_certainty?: unknown
          unit_price?: unknown
        }>
      | null = priorQuery.data
    let priorAssignmentsError = priorQuery.error
    const quantityCertaintySupported = !priorAssignmentsError
    if (priorAssignmentsError?.code === '42703') {
      const fallback = await supabase
        .from('project_tasks')
        .select('msp_uid, wbs_code, subcontractor_id')
        .eq('project_id', projectId)
      priorAssignments = fallback.data
      priorAssignmentsError = fallback.error
    }
    if (priorAssignmentsError && priorAssignmentsError.code !== '42703') {
      throw new Error(priorAssignmentsError.message)
    }
    for (const previous of priorAssignments ?? []) {
      const contractorId = previous.subcontractor_id as string | null
      const certainty = previous.quantity_certainty === 'قطعی' ? 'قطعی' : 'حدودی'
      const unitPrice = Math.max(0, Number(previous.unit_price) || 0)
      if (contractorId && previous.msp_uid != null) {
        priorContractorByUid.set(Number(previous.msp_uid), contractorId)
      }
      const previousWbs = String(previous.wbs_code ?? '').trim()
      if (contractorId && previousWbs) priorContractorByWbs.set(previousWbs, contractorId)
      if (previous.msp_uid != null) {
        priorCertaintyByUid.set(Number(previous.msp_uid), certainty)
        priorUnitPriceByUid.set(Number(previous.msp_uid), unitPrice)
      }
      if (previousWbs) {
        priorCertaintyByWbs.set(previousWbs, certainty)
        priorUnitPriceByWbs.set(previousWbs, unitPrice)
      }
    }

    const carriedSupervisorProgress = await carrySupervisorProgress(supabase, projectId)

    await wipeProjectScheduleBeforeImport(supabase, projectId)

    const uidToTaskId = new Map<number, string>()
    let tasksImported = 0

    for (const task of parsed.tasks) {
      const row: Record<string, unknown> = {
        project_id: projectId,
        msp_uid: task.msp_uid,
        external_id: task.external_id ?? String(task.msp_uid),
        wbs_code: task.wbs_code,
        outline_number: task.outline_number ?? task.wbs_code,
        outline_level: task.outline_level,
        name: task.name,
        start_planned: task.start_planned,
        finish_planned: task.finish_planned,
        // Baseline only if present in file — never invent from planned dates
        baseline_start: task.baseline_start ?? null,
        baseline_finish: task.baseline_finish ?? null,
        baseline_duration_days: task.baseline_duration_days ?? null,
        baseline_cost: task.baseline_cost ?? null,
        baseline_work_hours: task.baseline_work_hours ?? null,
        start_current: task.start_planned,
        finish_current: task.finish_planned,
        percent_complete: task.percent_complete,
        physical_percent_complete:
          task.physical_percent_complete ?? task.percent_complete,
        is_critical: false, // always recomputed by CPM — never trust file
        is_summary: task.is_summary,
        is_milestone: Boolean(task.is_milestone),
        schedule_weight: task.schedule_weight,
        physical_weight: task.physical_weight ?? task.schedule_weight,
        duration_days: task.duration_days,
        remaining_duration_days: task.remaining_duration_days,
        obs_code: task.obs_code,
        cbs_code: task.cbs_code,
        constraint_type: task.constraint_type,
        constraint_date: task.constraint_date,
        deadline: task.deadline,
        actual_start: task.actual_start,
        actual_finish: task.actual_finish,
        work_hours: task.work_hours,
        cost: task.cost,
        fixed_cost: task.fixed_cost,
        notes: task.notes,
        flag: Boolean(task.flag),
        priority: task.priority,
        is_manual_scheduled: Boolean(task.is_manual_scheduled),
        has_split: Boolean(task.has_split),
        is_recurring_master: Boolean(task.is_recurring_master),
        subcontractor_id:
          priorContractorByUid.get(task.msp_uid) ??
          priorContractorByWbs.get(task.wbs_code?.trim() ?? '') ??
          null,
        source_file: fileName,
        imported_at: new Date().toISOString(),
        status_date: new Date().toISOString(),
      }
      if (quantityCertaintySupported) {
        row.quantity_certainty =
          priorCertaintyByUid.get(task.msp_uid) ??
          priorCertaintyByWbs.get(task.wbs_code?.trim() ?? '') ??
          'حدودی'
        row.unit_price =
          priorUnitPriceByUid.get(task.msp_uid) ??
          priorUnitPriceByWbs.get(task.wbs_code?.trim() ?? '') ??
          0
      }

      const { data, error } = await supabase
        .from('project_tasks')
        .upsert(row, { onConflict: 'project_id,msp_uid' })
        .select('id, msp_uid')
        .single()

      if (error) throw new Error(error.message)
      if (data?.msp_uid != null) uidToTaskId.set(data.msp_uid, data.id)
      tasksImported++
    }

    await reapplyCarriedSupervisorProgress(
      supabase,
      projectId,
      importedBy,
      carriedSupervisorProgress,
      parsed.tasks.flatMap((task) => {
        const id = uidToTaskId.get(task.msp_uid)
        if (!id) return []
        return [{ id, mspUid: task.msp_uid, wbs: String(task.wbs_code ?? '').trim() }]
      })
    )

    // Wire parent_id from WBS
    for (const task of parsed.tasks) {
      if (task.parent_msp_uid == null) continue
      const id = uidToTaskId.get(task.msp_uid)
      const parentId = uidToTaskId.get(task.parent_msp_uid)
      if (!id || !parentId) continue
      await supabase.from('project_tasks').update({ parent_id: parentId }).eq('id', id)
    }

    let dependenciesImported = 0
    for (const dep of parsed.dependencies) {
      const predecessorId = uidToTaskId.get(dep.predecessor_uid)
      const successorId = uidToTaskId.get(dep.successor_uid)
      if (!predecessorId || !successorId) continue

      const { error } = await supabase.from('task_dependencies').upsert(
        {
          project_id: projectId,
          predecessor_task_id: predecessorId,
          successor_task_id: successorId,
          relation_type: dep.relation_type,
          lag_duration: dep.lag_duration,
          lag_days: dep.lag_days ?? null,
          lag_is_percentage: Boolean(dep.lag_is_percentage),
        },
        { onConflict: 'project_id,predecessor_task_id,successor_task_id,relation_type' }
      )

      if (error) throw new Error(error.message)
      dependenciesImported++
    }

    // Calendars
    for (const cal of parsed.calendars) {
      const { error } = await supabase
        .from('schedule_calendars')
        .insert({
          project_id: projectId,
          name: cal.name,
          working_days: cal.working_days,
          daily_shifts: cal.daily_shifts,
          exceptions: cal.exceptions,
          minutes_per_day: cal.minutes_per_day,
          is_default: Boolean(cal.is_default),
        })
      if (error && error.code !== '42P01') {
        /* table may be missing if migration 75 not applied — skip */
        break
      }
    }

    // Resources
    const resourceUidToId = new Map<number, string>()
    for (const res of parsed.resources) {
      const { data, error } = await supabase
        .from('schedule_resources')
        .insert({
          project_id: projectId,
          external_id: String(res.msp_uid),
          name: res.name,
          type: res.type,
          standard_rate: res.standard_rate,
          unit_of_measure: res.unit_of_measure,
        })
        .select('id')
        .single()
      if (error && error.code === '42P01') break
      if (error) continue
      if (data?.id) resourceUidToId.set(res.msp_uid, data.id)
    }

    for (const a of parsed.assignments) {
      const activityId = uidToTaskId.get(a.task_uid)
      const resourceId = resourceUidToId.get(a.resource_uid)
      if (!activityId || !resourceId) continue
      await supabase.from('schedule_assignments').upsert(
        {
          project_id: projectId,
          activity_id: activityId,
          resource_id: resourceId,
          units_percent: a.units_percent,
          work_hours: a.work_hours,
          cost: a.cost,
        },
        { onConflict: 'activity_id,resource_id' }
      )
    }

    for (const seg of parsed.segments) {
      const activityId = uidToTaskId.get(seg.task_uid)
      if (!activityId) continue
      await supabase.from('schedule_task_segments').insert({
        project_id: projectId,
        activity_id: activityId,
        segment_start: seg.segment_start,
        segment_finish: seg.segment_finish,
        sort_order: seg.sort_order,
      })
    }

    await supabase
      .from('schedule_imports')
      .update({
        status: 'completed',
        tasks_imported: tasksImported,
        dependencies_imported: dependenciesImported,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRow.id)

    const baseline_start =
      computeBaselineStartFromTasks(
        parsed.tasks.map((t) => ({
          baseline_start: t.baseline_start ?? t.start_planned,
          start_planned: t.start_planned,
        }))
      ) ?? new Date().toISOString().slice(0, 10)

    await setScheduleBaselineAfterImport(supabase, projectId, baseline_start)

    try {
      // Planned for every activity, then the project S-curve rows. No user action.
      const { persistPlannedWeights } = await import('@/features/schedule/lib/persist-planned-weights')
      await persistPlannedWeights(supabase, projectId)
    } catch {
      /* planned weights optional until migration 94 */
    }

    // Stage 3 — always recompute float/critical via system CPM
    if (!options?.skipCpm) {
      try {
        await runProjectCpmCalculation(supabase, projectId)
      } catch {
        /* CPM optional if graph incomplete; floats stay null until calculate */
      }
    }

    return {
      import_id: importRow.id,
      tasks_imported: tasksImported,
      dependencies_imported: dependenciesImported,
      baseline_start,
      needs_start_confirmation: true,
      report,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed'
    await supabase
      .from('schedule_imports')
      .update({
        status: 'failed',
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRow.id)
    throw new Error(message)
  }
}

export async function fetchScheduleImports(
  supabase: SupabaseClient,
  projectId: string,
  limit = 10
): Promise<ScheduleImport[]> {
  const { data, error } = await supabase
    .from('schedule_imports')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []) as ScheduleImport[]
}

export async function fetchProjectTasksSummary(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ count: number; tasks: ProjectTask[] }> {
  const [{ data, error, count }, { data: calcs }] = await Promise.all([
    supabase
      .from('project_tasks')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .limit(500),
    supabase
      .from('schedule_calculations')
      .select('task_id, total_float, free_float, is_critical')
      .eq('project_id', projectId),
  ])

  if (error) {
    if (error.code === '42P01') return { count: 0, tasks: [] }
    throw new Error(error.message)
  }

  const calcByTask = new Map(
    (calcs ?? []).map((c) => [
      c.task_id as string,
      {
        total_float: c.total_float as number | null,
        free_float: (c as { free_float?: number | null }).free_float ?? null,
        is_critical: Boolean(c.is_critical),
      },
    ])
  )

  const tasks = sortTasksByScheduleDate(
    ((data ?? []) as ProjectTask[]).map((t) => {
      const calc = calcByTask.get(t.id)
      if (!calc) return t
      return {
        ...t,
        total_float_days: t.total_float_days ?? calc.total_float,
        free_float_days: t.free_float_days ?? calc.free_float,
        is_critical: t.is_critical || calc.is_critical,
      }
    })
  )

  return { count: count ?? 0, tasks }
}
