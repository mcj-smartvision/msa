import type { SupabaseClient } from '@supabase/supabase-js'
import { parseCrePhase1Export, type CrePhase1Export } from '@/features/cre-contract/lib'
import {
approveActual,
assertPermission,
buildDailyReport,
enrichPackageFields,
generateDailyPlanDraft,
isExceptionFlag,
issueDailyPlan,
promoteCreRun,
setPaymentFlag,
submitActual,
transitionPackageStatus,
validateChildRollup,
type BlockerType,
type PackageStatus,
type PaymentFlag,
type SiteOpsRole,
} from '@/features/site-ops/domain'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { writeSiteOpsAudit } from './audit'
import {
assertProjectAccess,
loadMemberPositionKeys,
requireUser,
resolveSiteOpsRoles,
} from './auth'

function fieldValue(field: unknown): unknown {
  if (field && typeof field === 'object' && 'value' in (field as object)) {
    return (field as { value: unknown }).value
  }
  return field
}

async function rolesFor(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<SiteOpsRole[]> {
  const keys = await loadMemberPositionKeys(supabase, userId, projectId)
  return resolveSiteOpsRoles(supabase, userId, projectId, keys)
}

export async function importCreRun(
  supabase: SupabaseClient,
  params: { projectId: string; json: unknown }
) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, params.projectId)
  const roles = await rolesFor(supabase, user.id, params.projectId)
  assertPermission(roles, 'cre.import')

  const parsed = parseCrePhase1Export(params.json)
  const { data, error } = await supabase
    .from('site_ops_cre_runs')
    .insert({
      project_id: params.projectId,
      policy_version: parsed.policy_version,
      gate: parsed.summary.gate,
      overall_score: parsed.summary.overall_score,
      blocker_count: parsed.summary.blocker_count,
      forecast: parsed.summary.forecast,
      raw_json: parsed,
      summary_json: parsed.summary,
      imported_by: user.id,
    })
    .select('*')
    .single()

  if (error) throw new SiteOpsError('VALIDATION', error.message)

  await writeSiteOpsAudit(supabase, {
    projectId: params.projectId,
    actorId: user.id,
    action: 'cre.import',
    entityType: 'cre_run',
    entityId: data.id,
    payload: { gate: data.gate, score: data.overall_score },
  })

  return data
}

export async function getCreRun(supabase: SupabaseClient, id: string) {
  const user = await requireUser(supabase)
  const { data, error } = await supabase.from('site_ops_cre_runs').select('*').eq('id', id).maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!data) throw new SiteOpsError('NOT_FOUND', 'CRE run not found')
  await assertProjectAccess(supabase, user.id, data.project_id)
  return data
}

export async function listCreRuns(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const { data, error } = await supabase
    .from('site_ops_cre_runs')
    .select('id, project_id, policy_version, gate, overall_score, blocker_count, forecast, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  return data ?? []
}

export async function promoteRun(
  supabase: SupabaseClient,
  creRunId: string,
  options: { force?: boolean; forceReason?: string; taskUids?: number[] }
) {
  const run = await getCreRun(supabase, creRunId)
  const user = await requireUser(supabase)
  const roles = await rolesFor(supabase, user.id, run.project_id)
  const exportJson = run.raw_json as CrePhase1Export

  const result = promoteCreRun(exportJson, {
    roles,
    force: options.force,
    forceReason: options.forceReason,
    taskUids: options.taskUids,
  })

  const rows = result.snapshots.map((s) => ({
    project_id: run.project_id,
    cre_run_id: creRunId,
    task_uid: s.taskUid,
    wbs: s.wbs,
    name: s.name,
    location_json: s.location,
    quantity_json: s.quantity,
    uom_json: s.uom,
    crew_resource_json: s.crewResource,
    person_day_json: s.personDay,
    progress_method_json: s.progressMethod,
    start_json: s.start,
    finish_json: s.finish,
    readiness_row_status: s.readinessRowStatus,
    force_promoted: s.forcePromoted,
    force_reason: s.forceReason,
    is_active: true,
  }))

  const { data, error } = await supabase
    .from('site_ops_operational_tasks')
    .upsert(rows, { onConflict: 'cre_run_id,task_uid' })
    .select('*')

  if (error) throw new SiteOpsError('VALIDATION', error.message)

  await writeSiteOpsAudit(supabase, {
    projectId: run.project_id,
    actorId: user.id,
    action: result.forceUsed ? 'cre.force_promote' : 'cre.promote',
    entityType: 'cre_run',
    entityId: creRunId,
    payload: {
      count: data?.length ?? 0,
      skipped: result.skipped,
      forceReason: options.forceReason ?? null,
    },
  })

  return { snapshots: data ?? [], skipped: result.skipped, forceUsed: result.forceUsed }
}

export async function listOperationalTasks(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const { data, error } = await supabase
    .from('site_ops_operational_tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('task_uid', { ascending: true })
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  return data ?? []
}

export async function createDailyPlan(
  supabase: SupabaseClient,
  params: {
    projectId: string
    planDate: string
    notes?: string
    allowNotReadyOverride?: boolean
    overrideReason?: string
    workOrders: Array<{
      operationalTaskId: string
      plannedQuantity: number
      plannedPersonDays: number
      assignedCrewId?: string | null
      location?: string | null
      shift?: string | null
      constraints?: string[]
    }>
  }
) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, params.projectId)
  const roles = await rolesFor(supabase, user.id, params.projectId)

  const { count } = await supabase
    .from('site_ops_operational_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', params.projectId)
    .eq('is_active', true)

  const { data: latestRun } = await supabase
    .from('site_ops_cre_runs')
    .select('id, gate')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const draft = generateDailyPlanDraft({
    roles,
    planDate: params.planDate,
    notes: params.notes,
    latestGate: (latestRun?.gate as 'CONTROL_READY' | 'NOT_CONTROL_READY') ?? null,
    allowNotReadyOverride: params.allowNotReadyOverride,
    overrideReason: params.overrideReason,
    promotedTaskCount: count ?? 0,
    workOrders: params.workOrders.map((wo) => ({
      ...wo,
      assignedCrewId: wo.assignedCrewId ?? null,
    })),
  })

  const { data: plan, error } = await supabase
    .from('site_ops_daily_plans')
    .insert({
      project_id: params.projectId,
      plan_date: draft.planDate,
      status: 'DRAFT',
      notes: draft.notes,
      cre_run_id: latestRun?.id ?? null,
      gate_at_issue: latestRun?.gate ?? null,
      override_used: draft.overrideUsed,
      override_reason: draft.overrideReason,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) throw new SiteOpsError('VALIDATION', error.message)

  const woRows = draft.workOrders.map((wo) => ({
    daily_plan_id: plan.id,
    operational_task_id: wo.operationalTaskId,
    planned_quantity: wo.plannedQuantity,
    planned_person_days: wo.plannedPersonDays,
    assigned_crew_id: wo.assignedCrewId,
    location: wo.location,
    shift: wo.shift,
    status: 'PLANNED',
    constraints: wo.constraints,
  }))

  const { data: workOrders, error: woError } = await supabase
    .from('site_ops_work_orders')
    .insert(woRows)
    .select('*')

  if (woError) throw new SiteOpsError('VALIDATION', woError.message)

  await writeSiteOpsAudit(supabase, {
    projectId: params.projectId,
    actorId: user.id,
    action: 'plan.draft',
    entityType: 'daily_plan',
    entityId: plan.id,
    payload: { overrideUsed: draft.overrideUsed, workOrderCount: workOrders?.length ?? 0 },
  })

  return { plan, workOrders: workOrders ?? [] }
}

export async function issuePlan(supabase: SupabaseClient, planId: string) {
  const user = await requireUser(supabase)
  const { data: plan, error } = await supabase
    .from('site_ops_daily_plans')
    .select('*, site_ops_work_orders(id)')
    .eq('id', planId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!plan) throw new SiteOpsError('NOT_FOUND', 'Daily plan not found')

  await assertProjectAccess(supabase, user.id, plan.project_id)
  const roles = await rolesFor(supabase, user.id, plan.project_id)
  const woCount = Array.isArray(plan.site_ops_work_orders) ? plan.site_ops_work_orders.length : 0
  issueDailyPlan({ roles, status: plan.status, workOrderCount: woCount })

  const { data: updated, error: upErr } = await supabase
    .from('site_ops_daily_plans')
    .update({ status: 'ISSUED', issued_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .select('*')
    .single()
  if (upErr) throw new SiteOpsError('VALIDATION', upErr.message)

  await writeSiteOpsAudit(supabase, {
    projectId: plan.project_id,
    actorId: user.id,
    action: 'plan.issue',
    entityType: 'daily_plan',
    entityId: planId,
  })

  return updated
}

export async function getPlanByDate(supabase: SupabaseClient, projectId: string, planDate: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const { data: plan, error } = await supabase
    .from('site_ops_daily_plans')
    .select('*')
    .eq('project_id', projectId)
    .eq('plan_date', planDate)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!plan) return null

  const { data: workOrders } = await supabase
    .from('site_ops_work_orders')
    .select('*, site_ops_operational_tasks(*), site_ops_actual_entries(*)')
    .eq('daily_plan_id', plan.id)

  return { plan, workOrders: workOrders ?? [] }
}

export async function listDailyPlans(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const { data, error } = await supabase
    .from('site_ops_daily_plans')
    .select('*')
    .eq('project_id', projectId)
    .order('plan_date', { ascending: false })
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  return data ?? []
}

export async function getWorkOrder(supabase: SupabaseClient, workOrderId: string) {
  const user = await requireUser(supabase)
  const { data: wo, error } = await supabase
    .from('site_ops_work_orders')
    .select('*, site_ops_operational_tasks(*), site_ops_daily_plans(*), site_ops_actual_entries(*)')
    .eq('id', workOrderId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!wo) throw new SiteOpsError('NOT_FOUND', 'Work order not found')
  const plan = wo.site_ops_daily_plans as { project_id: string }
  await assertProjectAccess(supabase, user.id, plan.project_id)
  return wo
}

export async function submitWorkOrderActual(
  supabase: SupabaseClient,
  workOrderId: string,
  body: {
    actualQuantity: number
    actualPersonDays: number
    actualUom?: string | null
    progressMethod?: string | null
    evidenceNotes?: string | null
    actualStart?: string | null
    actualFinish?: string | null
  }
) {
  const wo = await getWorkOrder(supabase, workOrderId)
  const user = await requireUser(supabase)
  const plan = wo.site_ops_daily_plans as { project_id: string; status: string }
  const task = wo.site_ops_operational_tasks as { uom_json: unknown; crew_resource_json: unknown }
  const roles = await rolesFor(supabase, user.id, plan.project_id)

  const named =
    Boolean(wo.assigned_crew_id) ||
    Boolean(fieldValue(task.crew_resource_json) != null && String(fieldValue(task.crew_resource_json)).length > 0)

  const decision = submitActual({
    roles,
    planStatus: plan.status as 'DRAFT' | 'ISSUED' | 'LOCKED' | 'CLOSED',
    workOrderStatus: wo.status,
    snapshotUom: task.uom_json,
    actualQuantity: body.actualQuantity,
    actualUom: body.actualUom,
    actualPersonDays: body.actualPersonDays,
    namedCrewOrWorkers: named,
    progressMethod: body.progressMethod,
    evidenceNotes: body.evidenceNotes,
    actualStart: body.actualStart,
    actualFinish: body.actualFinish,
  })

  const { data, error } = await supabase
    .from('site_ops_actual_entries')
    .insert({
      work_order_id: workOrderId,
      reported_by: user.id,
      actual_quantity: decision.actualQuantity,
      actual_person_days: decision.actualPersonDays,
      actual_uom: body.actualUom ?? null,
      progress_method: body.progressMethod ?? null,
      evidence_notes: body.evidenceNotes ?? null,
      actual_start: body.actualStart ?? null,
      actual_finish: body.actualFinish ?? null,
      status: 'SUBMITTED',
    })
    .select('*')
    .single()
  if (error) throw new SiteOpsError('VALIDATION', error.message)

  await supabase
    .from('site_ops_work_orders')
    .update({ status: 'IN_PROGRESS' })
    .eq('id', workOrderId)
    .eq('status', 'PLANNED')

  await writeSiteOpsAudit(supabase, {
    projectId: plan.project_id,
    actorId: user.id,
    action: 'actual.submit',
    entityType: 'actual_entry',
    entityId: data.id,
    payload: { workOrderId },
  })

  return data
}

export async function decideActual(
  supabase: SupabaseClient,
  actualId: string,
  approve: boolean
) {
  const user = await requireUser(supabase)
  const { data: actual, error } = await supabase
    .from('site_ops_actual_entries')
    .select('*, site_ops_work_orders(id, daily_plan_id, site_ops_daily_plans(project_id))')
    .eq('id', actualId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!actual) throw new SiteOpsError('NOT_FOUND', 'Actual not found')

  const wo = actual.site_ops_work_orders as {
    site_ops_daily_plans: { project_id: string }
  }
  const projectId = wo.site_ops_daily_plans.project_id
  await assertProjectAccess(supabase, user.id, projectId)
  const roles = await rolesFor(supabase, user.id, projectId)
  const decision = approveActual({ roles, status: actual.status, approve })

  const { data, error: upErr } = await supabase
    .from('site_ops_actual_entries')
    .update({
      status: decision.status,
      approved_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', actualId)
    .select('*')
    .single()
  if (upErr) throw new SiteOpsError('VALIDATION', upErr.message)

  if (decision.status === 'APPROVED') {
    await supabase
      .from('site_ops_work_orders')
      .update({ status: 'DONE' })
      .eq('id', actual.work_order_id)
  }

  await writeSiteOpsAudit(supabase, {
    projectId,
    actorId: user.id,
    action: approve ? 'actual.approve' : 'actual.reject',
    entityType: 'actual_entry',
    entityId: actualId,
  })

  return data
}

export async function buildReportForDate(
  supabase: SupabaseClient,
  projectId: string,
  planDate: string
) {
  const bundle = await getPlanByDate(supabase, projectId, planDate)
  if (!bundle) throw new SiteOpsError('NOT_FOUND', 'No daily plan for this date')

  const lines = bundle.workOrders.map((wo: Record<string, unknown>) => {
    const task = wo.site_ops_operational_tasks as {
      task_uid: number
      name: string
    }
    const actuals = (wo.site_ops_actual_entries as Array<{
      actual_quantity: number
      actual_person_days: number
      status: string
      created_at: string
    }>) ?? []
    const approved = actuals.find((a) => a.status === 'APPROVED') ?? null
    const latest = [...actuals].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null

    return {
      workOrderId: String(wo.id),
      taskUid: task.task_uid,
      taskName: task.name,
      location: (wo.location as string | null) ?? null,
      crewId: (wo.assigned_crew_id as string | null) ?? null,
      plannedQuantity: Number(wo.planned_quantity),
      plannedPersonDays: Number(wo.planned_person_days),
      constraints: (wo.constraints as string[]) ?? [],
      approvedActual: approved
        ? {
            actualQuantity: Number(approved.actual_quantity),
            actualPersonDays: Number(approved.actual_person_days),
            status: approved.status,
          }
        : null,
      latestActual: latest
        ? {
            actualQuantity: Number(latest.actual_quantity),
            actualPersonDays: Number(latest.actual_person_days),
            status: latest.status,
          }
        : null,
    }
  })

  const report = buildDailyReport({
    planDate,
    projectId,
    planStatus: bundle.plan.status,
    gate: bundle.plan.gate_at_issue,
    lines,
  })

  return report
}

export async function ensureDefaultCrew(
  supabase: SupabaseClient,
  projectId: string,
  name: string
) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const { data: existing } = await supabase
    .from('site_ops_crews')
    .select('*')
    .eq('project_id', projectId)
    .eq('name', name)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('site_ops_crews')
    .insert({ project_id: projectId, name, cre_resource_name: name })
    .select('*')
    .single()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  return data
}

export async function listCrews(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const { data, error } = await supabase
    .from('site_ops_crews')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  return data ?? []
}

export async function enrichOperationalPackage(
  supabase: SupabaseClient,
  packageId: string,
  body: {
    category?: string | null
    locationText?: string | null
    plannedQty?: number | null
    uomText?: string | null
    crewText?: string | null
    opsStatus?: PackageStatus
  }
) {
  const user = await requireUser(supabase)
  const { data: pkg, error } = await supabase
    .from('site_ops_operational_tasks')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!pkg) throw new SiteOpsError('NOT_FOUND', 'Package not found')

  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await rolesFor(supabase, user.id, pkg.project_id)
  const fields = enrichPackageFields({ roles, ...body })

  const { data, error: upErr } = await supabase
    .from('site_ops_operational_tasks')
    .update({
      ...fields,
      enriched_by: user.id,
      enriched_at: new Date().toISOString(),
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (upErr) throw new SiteOpsError('VALIDATION', upErr.message)

  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'package.enrich',
    entityType: 'operational_task',
    entityId: packageId,
    payload: fields,
  })
  return data
}

export async function updatePaymentFlag(
  supabase: SupabaseClient,
  packageId: string,
  body: { flag: PaymentFlag; reason?: string | null }
) {
  const user = await requireUser(supabase)
  const { data: pkg, error } = await supabase
    .from('site_ops_operational_tasks')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!pkg) throw new SiteOpsError('NOT_FOUND', 'Package not found')

  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await rolesFor(supabase, user.id, pkg.project_id)
  const fields = setPaymentFlag({
    roles,
    flag: body.flag,
    reason: body.reason,
    previousFlag: pkg.payment_flag as PaymentFlag,
  })

  const { data, error: upErr } = await supabase
    .from('site_ops_operational_tasks')
    .update({
      ...fields,
      payment_flag_owner: user.id,
      pm_risk_acknowledged: false,
      pm_acknowledged_by: null,
      pm_acknowledged_at: null,
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (upErr) throw new SiteOpsError('VALIDATION', upErr.message)

  if (isExceptionFlag(body.flag)) {
    await supabase.from('site_ops_approvals').insert({
      project_id: pkg.project_id,
      entity_type: 'operational_task',
      entity_id: packageId,
      requested_by: user.id,
      approver_role: 'PM',
      decision: 'PENDING',
      note: body.reason ?? fields.payment_flag_reason,
    })
  }

  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'package.payment_flag',
    entityType: 'operational_task',
    entityId: packageId,
    payload: fields,
  })
  return data
}

export async function decomposePackage(
  supabase: SupabaseClient,
  parentId: string,
  children: Array<{
    name: string
    plannedQty: number
    uomText?: string | null
    locationText?: string | null
    crewText?: string | null
  }>
) {
  const user = await requireUser(supabase)
  const { data: parent, error } = await supabase
    .from('site_ops_operational_tasks')
    .select('*')
    .eq('id', parentId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!parent) throw new SiteOpsError('NOT_FOUND', 'Parent package not found')

  await assertProjectAccess(supabase, user.id, parent.project_id)
  const roles = await rolesFor(supabase, user.id, parent.project_id)
  assertPermission(roles, 'package.decompose')

  const parentQty =
    parent.planned_qty != null
      ? Number(parent.planned_qty)
      : Number(fieldValue(parent.quantity_json) ?? NaN)
  validateChildRollup({
    parentPlannedQty: Number.isFinite(parentQty) ? parentQty : null,
    childrenPlannedQty: children.map((c) => c.plannedQty),
  })

  const rows = children.map((c, idx) => ({
    project_id: parent.project_id,
    cre_run_id: parent.cre_run_id,
    task_uid: parent.task_uid * 1000 + idx + 1,
    wbs: parent.wbs ? `${parent.wbs}.${idx + 1}` : String(idx + 1),
    name: c.name,
    location_json: parent.location_json,
    quantity_json: { value: c.plannedQty, state: 'VALID' },
    uom_json: { value: c.uomText ?? parent.uom_text ?? fieldValue(parent.uom_json), state: 'VALID' },
    crew_resource_json: { value: c.crewText ?? parent.crew_text, state: 'VALID' },
    person_day_json: parent.person_day_json,
    progress_method_json: parent.progress_method_json,
    start_json: parent.start_json,
    finish_json: parent.finish_json,
    readiness_row_status: parent.readiness_row_status,
    force_promoted: false,
    is_active: true,
    parent_id: parent.id,
    ops_status: 'Ready',
    planned_qty: c.plannedQty,
    uom_text: c.uomText ?? parent.uom_text,
    location_text: c.locationText ?? parent.location_text,
    crew_text: c.crewText ?? parent.crew_text,
    category: parent.category,
    payment_flag: parent.payment_flag,
    payment_flag_reason: parent.payment_flag_reason,
    enriched_by: user.id,
    enriched_at: new Date().toISOString(),
  }))

  const { data, error: insErr } = await supabase
    .from('site_ops_operational_tasks')
    .insert(rows)
    .select('*')
  if (insErr) throw new SiteOpsError('VALIDATION', insErr.message)

  await writeSiteOpsAudit(supabase, {
    projectId: parent.project_id,
    actorId: user.id,
    action: 'package.decompose',
    entityType: 'operational_task',
    entityId: parentId,
    payload: { childCount: data?.length ?? 0 },
  })
  return data ?? []
}

export async function setPackageStatus(
  supabase: SupabaseClient,
  packageId: string,
  nextStatus: PackageStatus
) {
  const user = await requireUser(supabase)
  const { data: pkg, error } = await supabase
    .from('site_ops_operational_tasks')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!pkg) throw new SiteOpsError('NOT_FOUND', 'Package not found')

  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await rolesFor(supabase, user.id, pkg.project_id)
  const next = transitionPackageStatus({
    roles,
    from: (pkg.ops_status as PackageStatus) ?? 'Draft',
    to: nextStatus,
    paymentFlag: (pkg.payment_flag as PaymentFlag) ?? 'NotForPayment',
    pmRiskAcknowledged: Boolean(pkg.pm_risk_acknowledged),
  })

  const { data, error: upErr } = await supabase
    .from('site_ops_operational_tasks')
    .update(next)
    .eq('id', packageId)
    .select('*')
    .single()
  if (upErr) throw new SiteOpsError('VALIDATION', upErr.message)

  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'package.status',
    entityType: 'operational_task',
    entityId: packageId,
    payload: next,
  })
  return data
}

export async function createBlocker(
  supabase: SupabaseClient,
  body: {
    projectId: string
    packageId: string
    planDate?: string | null
    blockerType?: BlockerType
    note: string
  }
) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, body.projectId)
  const roles = await rolesFor(supabase, user.id, body.projectId)
  assertPermission(roles, 'blocker.write')

  const { data, error } = await supabase
    .from('site_ops_blockers')
    .insert({
      project_id: body.projectId,
      operational_task_id: body.packageId,
      plan_date: body.planDate ?? null,
      blocker_type: body.blockerType ?? 'other',
      note: body.note.trim(),
      is_open: true,
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error) throw new SiteOpsError('VALIDATION', error.message)

  await supabase
    .from('site_ops_operational_tasks')
    .update({ ops_status: 'Blocked' })
    .eq('id', body.packageId)

  await writeSiteOpsAudit(supabase, {
    projectId: body.projectId,
    actorId: user.id,
    action: 'blocker.write',
    entityType: 'blocker',
    entityId: data.id,
    payload: { packageId: body.packageId, type: body.blockerType ?? 'other' },
  })
  return data
}

export async function listExceptions(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const roles = await rolesFor(supabase, user.id, projectId)
  assertPermission(roles, 'exception.view')

  const { data: flagged } = await supabase
    .from('site_ops_operational_tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .in('payment_flag', ['QuantityIncomplete', 'NeedsChangeReview'])
    .order('created_at', { ascending: false })

  const { data: pending } = await supabase
    .from('site_ops_approvals')
    .select('*')
    .eq('project_id', projectId)
    .eq('decision', 'PENDING')
    .order('created_at', { ascending: false })

  const { data: openBlockers } = await supabase
    .from('site_ops_blockers')
    .select('*, site_ops_operational_tasks(name, task_uid)')
    .eq('project_id', projectId)
    .eq('is_open', true)
    .order('created_at', { ascending: false })

  return {
    paymentRiskPackages: flagged ?? [],
    pendingApprovals: pending ?? [],
    openBlockers: openBlockers ?? [],
  }
}

export async function acknowledgeException(
  supabase: SupabaseClient,
  packageId: string,
  note?: string
) {
  const user = await requireUser(supabase)
  const { data: pkg, error } = await supabase
    .from('site_ops_operational_tasks')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()
  if (error) throw new SiteOpsError('VALIDATION', error.message)
  if (!pkg) throw new SiteOpsError('NOT_FOUND', 'Package not found')

  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await rolesFor(supabase, user.id, pkg.project_id)
  assertPermission(roles, 'exception.acknowledge')

  const { data, error: upErr } = await supabase
    .from('site_ops_operational_tasks')
    .update({
      pm_risk_acknowledged: true,
      pm_acknowledged_by: user.id,
      pm_acknowledged_at: new Date().toISOString(),
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (upErr) throw new SiteOpsError('VALIDATION', upErr.message)

  await supabase
    .from('site_ops_approvals')
    .update({
      decision: 'ACKNOWLEDGED',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      note: note ?? null,
    })
    .eq('entity_id', packageId)
    .eq('decision', 'PENDING')

  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'exception.acknowledge',
    entityType: 'operational_task',
    entityId: packageId,
    payload: { note: note ?? null },
  })
  return data
}

