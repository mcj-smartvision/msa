import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMemberPositionKeys, requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { todayTehranIso } from '@/lib/time/tehran'
import {
  checkWwpAction,
  hasWwpRole,
  projectWeekNumber,
  validateOutcome,
  weekBounds,
  wwpForbiddenMessage,
  type OutcomeInput,
  type PolicyResult,
  type WwpAction,
  type WwpStatus,
} from './policy'

/**
 * Weekly Work Plan service. `supabase` must be the caller's session client (not the service
 * role), so RLS and the lifecycle triggers apply on top of the checks here.
 */

type Row = Record<string, unknown>

export interface WwpPlan {
  id: string
  projectId: string
  weekNumber: number
  startDate: string
  endDate: string
  status: WwpStatus
  frozenAt: string | null
  closedAt: string | null
  notes: string | null
}

export interface WwpCommitment {
  id: string
  wwpId: string
  taskId: string | null
  packageId: string | null
  wbsCode: string | null
  description: string
  assignedTo: string | null
  plannedOutput: number | null
  actualOutput: number | null
  outputUom: string | null
  isCompleted: boolean | null
  rootCauseCategory: string | null
  rootCauseNote: string | null
  sortOrder: number
}

export interface CommitmentInput {
  taskId?: string | null
  packageId?: string | null
  wbsCode?: string | null
  description: string
  assignedTo?: string | null
  plannedOutput?: number | null
  outputUom?: string | null
  sortOrder?: number
}

function mapPlan(row: Row): WwpPlan {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    weekNumber: Number(row.week_number),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    status: row.status as WwpStatus,
    frozenAt: (row.frozen_at as string | null) ?? null,
    closedAt: (row.closed_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }
}

function num(value: unknown): number | null {
  return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
}

function mapCommitment(row: Row): WwpCommitment {
  return {
    id: String(row.id),
    wwpId: String(row.wwp_id),
    taskId: (row.task_id as string | null) ?? null,
    packageId: (row.package_id as string | null) ?? null,
    wbsCode: (row.wbs_code as string | null) ?? null,
    description: String(row.description ?? ''),
    assignedTo: (row.assigned_to as string | null) ?? null,
    plannedOutput: num(row.planned_output),
    actualOutput: num(row.actual_output),
    outputUom: (row.output_uom as string | null) ?? null,
    isCompleted: (row.is_completed as boolean | null) ?? null,
    rootCauseCategory: (row.root_cause_category as string | null) ?? null,
    rootCauseNote: (row.root_cause_note as string | null) ?? null,
    sortOrder: Number(row.sort_order) || 0,
  }
}

function enforce(result: PolicyResult): void {
  if ('reason_fa' in result) throw new SiteOpsError(result.code, result.reason_fa)
}

/** Postgres errors from the guards arrive as plain messages; keep them readable and typed. */
function fail(error: { message: string; code?: string }): never {
  if (/does not exist|schema cache|Could not find/i.test(error.message)) {
    throw new SiteOpsError('VALIDATION', 'جدول‌های برنامهٔ هفتگی (WWP) هنوز روی پایگاه داده اجرا نشده‌اند')
  }
  if (error.code === '42501' || /row-level security/i.test(error.message)) throw new SiteOpsError('FORBIDDEN', error.message)
  if (error.code === '23505') throw new SiteOpsError('VALIDATION', 'برای این هفته قبلاً برنامه ساخته شده است')
  throw new SiteOpsError('VALIDATION', error.message)
}

async function actor(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  const keys = await loadMemberPositionKeys(supabase, user.id, projectId)
  return { user, keys }
}

async function loadPlan(supabase: SupabaseClient, planId: string): Promise<WwpPlan> {
  const { data, error } = await supabase.from('weekly_work_plans').select('*').eq('id', planId).maybeSingle()
  if (error) fail(error)
  if (!data) throw new SiteOpsError('NOT_FOUND', 'برنامهٔ هفتگی پیدا نشد')
  return mapPlan(data as Row)
}

async function loadCommitment(supabase: SupabaseClient, commitmentId: string): Promise<WwpCommitment> {
  const { data, error } = await supabase.from('wwp_commitments').select('*').eq('id', commitmentId).maybeSingle()
  if (error) fail(error)
  if (!data) throw new SiteOpsError('NOT_FOUND', 'تعهد پیدا نشد')
  return mapCommitment(data as Row)
}

async function commitmentCounts(supabase: SupabaseClient, planId: string) {
  const { data, error } = await supabase.from('wwp_commitments').select('is_completed').eq('wwp_id', planId)
  if (error) fail(error)
  const rows = (data ?? []) as Row[]
  return { total: rows.length, open: rows.filter((r) => r.is_completed == null).length }
}

async function authorize(supabase: SupabaseClient, plan: WwpPlan, action: WwpAction, counts?: { total: number; open: number }) {
  const { keys } = await actor(supabase, plan.projectId)
  enforce(
    checkWwpAction({
      action,
      positionKeys: keys,
      status: plan.status,
      startDate: plan.startDate,
      endDate: plan.endDate,
      today: todayTehranIso(),
      commitmentCount: counts?.total,
      openOutcomeCount: counts?.open,
    })
  )
}

export async function listWeeklyPlans(
  supabase: SupabaseClient,
  projectId: string
): Promise<Array<WwpPlan & { commitments: WwpCommitment[] }>> {
  await requireUser(supabase)
  const { data, error } = await supabase
    .from('weekly_work_plans')
    .select('*, wwp_commitments(*)')
    .eq('project_id', projectId)
    .order('start_date', { ascending: false })
  if (error) fail(error)
  return ((data ?? []) as Row[]).map((row) => ({
    ...mapPlan(row),
    commitments: ((row.wwp_commitments as Row[] | null) ?? []).map(mapCommitment).sort((a, b) => a.sortOrder - b.sortOrder),
  }))
}

export async function createWeeklyPlan(
  supabase: SupabaseClient,
  input: { projectId: string; weekStart: string; notes?: string | null }
): Promise<WwpPlan> {
  const { keys } = await actor(supabase, input.projectId)
  if (!hasWwpRole(keys, 'edit_draft')) throw new SiteOpsError('FORBIDDEN', wwpForbiddenMessage('edit_draft'))
  const bounds = weekBounds(input.weekStart)
  if (!bounds) throw new SiteOpsError('VALIDATION', 'شروع هفته باید یک شنبه (YYYY-MM-DD) باشد')

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('start_date')
    .eq('id', input.projectId)
    .maybeSingle()
  if (projectError) fail(projectError)
  const projectStart = project?.start_date ? String(project.start_date).slice(0, 10) : null
  let weekNumber: number
  if (projectStart) {
    weekNumber = projectWeekNumber(projectStart, bounds.start)
    if (weekNumber < 1) throw new SiteOpsError('VALIDATION', 'هفته قبل از شروع پروژه است')
  } else {
    const { data: last, error } = await supabase
      .from('weekly_work_plans')
      .select('week_number')
      .eq('project_id', input.projectId)
      .order('week_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) fail(error)
    weekNumber = (Number(last?.week_number) || 0) + 1
  }

  const { data, error } = await supabase
    .from('weekly_work_plans')
    .insert({
      project_id: input.projectId,
      week_number: weekNumber,
      start_date: bounds.start,
      end_date: bounds.end,
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error) fail(error)
  return mapPlan(data as Row)
}

function commitmentPatch(input: Partial<CommitmentInput>): Row {
  const patch: Row = {}
  if (input.taskId !== undefined) patch.task_id = input.taskId || null
  if (input.packageId !== undefined) patch.package_id = input.packageId || null
  if (input.wbsCode !== undefined) patch.wbs_code = input.wbsCode?.trim() || null
  if (input.description !== undefined) {
    if (!input.description?.trim()) throw new SiteOpsError('VALIDATION', 'شرح تعهد الزامی است')
    patch.description = input.description.trim()
  }
  if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo || null
  if (input.plannedOutput !== undefined) {
    if (input.plannedOutput != null && (!Number.isFinite(input.plannedOutput) || input.plannedOutput < 0)) {
      throw new SiteOpsError('VALIDATION', 'مقدار برنامه‌ای نامعتبر است')
    }
    patch.planned_output = input.plannedOutput
  }
  if (input.outputUom !== undefined) patch.output_uom = input.outputUom?.trim() || null
  if (input.sortOrder !== undefined) patch.sort_order = Math.trunc(Number(input.sortOrder) || 0)
  return patch
}

export async function addCommitment(supabase: SupabaseClient, planId: string, input: CommitmentInput): Promise<WwpCommitment> {
  const plan = await loadPlan(supabase, planId)
  await authorize(supabase, plan, 'edit_draft')
  const { data, error } = await supabase
    .from('wwp_commitments')
    .insert({ wwp_id: plan.id, ...commitmentPatch(input) })
    .select('*')
    .single()
  if (error) fail(error)
  return mapCommitment(data as Row)
}

export async function updateCommitment(
  supabase: SupabaseClient,
  commitmentId: string,
  input: Partial<CommitmentInput>
): Promise<WwpCommitment> {
  const commitment = await loadCommitment(supabase, commitmentId)
  const plan = await loadPlan(supabase, commitment.wwpId)
  await authorize(supabase, plan, 'edit_draft')
  const patch = commitmentPatch(input)
  if (Object.keys(patch).length === 0) return commitment
  const { data, error } = await supabase.from('wwp_commitments').update(patch).eq('id', commitmentId).select('*').single()
  if (error) fail(error)
  return mapCommitment(data as Row)
}

export async function deleteCommitment(supabase: SupabaseClient, commitmentId: string): Promise<void> {
  const commitment = await loadCommitment(supabase, commitmentId)
  const plan = await loadPlan(supabase, commitment.wwpId)
  await authorize(supabase, plan, 'edit_draft')
  const { error } = await supabase.from('wwp_commitments').delete().eq('id', commitmentId)
  if (error) fail(error)
}

export async function freezeWeeklyPlan(supabase: SupabaseClient, planId: string): Promise<WwpPlan> {
  const plan = await loadPlan(supabase, planId)
  await authorize(supabase, plan, 'freeze', await commitmentCounts(supabase, planId))
  const { data, error } = await supabase.from('weekly_work_plans').update({ status: 'FROZEN' }).eq('id', planId).select('*').single()
  if (error) fail(error)
  return mapPlan(data as Row)
}

export async function recordCommitmentOutcome(
  supabase: SupabaseClient,
  commitmentId: string,
  input: OutcomeInput
): Promise<WwpCommitment> {
  const commitment = await loadCommitment(supabase, commitmentId)
  const plan = await loadPlan(supabase, commitment.wwpId)
  await authorize(supabase, plan, 'record_outcome')
  enforce(validateOutcome(input))
  const { data, error } = await supabase
    .from('wwp_commitments')
    .update({
      is_completed: input.isCompleted,
      root_cause_category: input.isCompleted ? null : input.rootCauseCategory,
      root_cause_note: input.isCompleted ? null : input.rootCauseNote?.trim() || null,
      ...(input.actualOutput !== undefined ? { actual_output: input.actualOutput } : {}),
    })
    .eq('id', commitmentId)
    .select('*')
    .single()
  if (error) fail(error)
  return mapCommitment(data as Row)
}

export async function closeWeeklyPlan(supabase: SupabaseClient, planId: string): Promise<WwpPlan> {
  const plan = await loadPlan(supabase, planId)
  await authorize(supabase, plan, 'close', await commitmentCounts(supabase, planId))
  const { data, error } = await supabase.from('weekly_work_plans').update({ status: 'CLOSED' }).eq('id', planId).select('*').single()
  if (error) fail(error)
  return mapPlan(data as Row)
}

export async function deleteDraftPlan(supabase: SupabaseClient, planId: string): Promise<void> {
  const plan = await loadPlan(supabase, planId)
  await authorize(supabase, plan, 'edit_draft')
  const { error } = await supabase.from('weekly_work_plans').delete().eq('id', planId)
  if (error) fail(error)
}
