import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { fetchAllProjectTasks } from '@/features/schedule/services/schedule'
import { isSystemAdmin } from '@/features/admin/lib/access'
import {
assertProjectAccess,
loadMemberPositionKeys,
requireUser,
} from '@/features/site-ops/lib/auth'
import { writeSiteOpsAudit } from '@/features/site-ops/lib/audit'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import {
mapSitePilotPositionToSiteOpsRoles,
type SiteOpsRole,
} from '@/features/site-ops/domain'
import {
assertCanDeletePackage,
assertCanEditPackage,
assertCanRequestChange,
assertCanSendToToday,
assertCanSubmitForApproval,
canReviseChangeRequest,
WORKSHOP_SKIP_PM_APPROVAL,
type ApprovalStatus,
} from './approvals'
import {
inferReviewReason,
validateCreatePackage,
WorkshopError,
} from './domain'
import {
encodePackageWeightInNote,
resolvePackageWeight,
stripPackageWeightFromNote,
} from './package-weight'
import {
encodePackageCommercialInNote,
mergePackageScheduleFields,
readPackageQuantityCertainty,
readPackageUnitPrice,
stripPackageCommercialFromNote,
} from './package-commercial'
import {
buildScheduleHierarchy,
enrichScheduleTreeWithWbs,
nextChildWbs,
} from './wbs-numbering'
import { fetchTaskPredecessorDisplay, fetchTaskPredecessorLabels } from '@/features/schedule/lib/predecessor-labels'
import { seedNewPackageProgressFields } from '@/features/workshop/lib/header-rules'
import { resolveSiblingWeights, type WeightIssue } from '@/features/schedule/lib/weight-consistency'
import { normalizeScheduleWeightPercent } from '@/features/schedule/lib/weighted-progress'
import type {
CreatePackageInput,
PackageChangePayload,
ScheduleTreeNode,
UpdatePackageInput,
WorkshopPackageNode,
} from './types'

function mapPackage(row: Record<string, unknown>, children: WorkshopPackageNode[] = []): WorkshopPackageNode {
  const storedWbs = (row.wbs_code as string) ?? null
  const noteClean = stripPackageCommercialFromNote(stripPackageWeightFromNote(row.note as string))
  return {
    id: String(row.id),
    kind: 'package',
    wbs: storedWbs,
    name: String(row.name),
    location: (row.location as string) ?? null,
    quantity: Number(row.quantity),
    quantityCertainty: readPackageQuantityCertainty(row),
    unitPrice: readPackageUnitPrice(row),
    uom: String(row.uom),
    crew: (row.crew as string) ?? null,
    note: noteClean || null,
    status: row.status as WorkshopPackageNode['status'],
    approvalStatus: ((row.approval_status as ApprovalStatus) ?? 'draft') as WorkshopPackageNode['approvalStatus'],
    lastPmComment: (row.last_pm_comment as string) ?? null,
    pendingChange: (row.pending_change as PackageChangePayload) ?? null,
    flagForReview: Boolean(row.flag_for_review),
    reviewReason: (row.review_reason as string) ?? null,
    weightPercent: resolvePackageWeight(row),
    origin: (row.origin as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    finishDate: (row.finish_date as string) ?? null,
    subcontractorId: (row.subcontractor_id as string) ?? null,
    resolvedSubcontractorId: null,
    scheduleFields:
      row.schedule_fields && typeof row.schedule_fields === 'object'
        ? (row.schedule_fields as Record<string, unknown>)
        : {},
    children,
  }
}

function assertHasRole(roles: SiteOpsRole[], allowed: SiteOpsRole[]) {
  if (!roles.some((r) => allowed.includes(r))) {
    throw new WorkshopError('FORBIDDEN', 'دسترسی برای این عملیات ندارید')
  }
}

const WORKSHOP_WRITE_ROLES: SiteOpsRole[] = [
  'TECHNICAL_OFFICE',
  'SITE_MANAGER',
  'PM',
  'PLANNER',
  'PROJECT_CONTROLS',
]

const WORKSHOP_WRITE_POSITIONS = new Set([
  'technical_office',
  'project_manager',
  'planning_engineer',
  'civil_engineer',
  'site_manager',
])

export function canWriteWorkshop(roles: SiteOpsRole[]): boolean {
  return roles.some((r) => WORKSHOP_WRITE_ROLES.includes(r))
}

/**
 * Workshop roles from project positions + grants.
 * System admin does NOT get write by default if their only project position is supervisor —
 * otherwise testing the supervisor dashboard always looks "editable".
 */
async function resolveWorkshopRoles(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<SiteOpsRole[]> {
  const keys = await loadMemberPositionKeys(supabase, userId, projectId)
  const roles = new Set<SiteOpsRole>(mapSitePilotPositionToSiteOpsRoles(keys))

  const { data: grants } = await supabase
    .from('site_ops_role_grants')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)

  for (const g of grants ?? []) {
    if (g.role) roles.add(g.role as SiteOpsRole)
  }

  const admin = await isSystemAdmin(supabase, userId)
  const hasWritePosition = keys.some((k) => WORKSHOP_WRITE_POSITIONS.has(k))

  if (admin) {
    roles.add('TECHNICAL_OFFICE')
    roles.add('PM')
    roles.add('SITE_MANAGER')
    roles.add('PROJECT_CONTROLS')
  }

  // Supervisor-only members without write positions
  if (!admin && keys.includes('site_supervisor') && !hasWritePosition) {
    roles.add('SUPERVISOR')
  }

  if (roles.size === 0) roles.add('VIEWER')
  return [...roles]
}

async function resolveRoles(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<SiteOpsRole[]> {
  // Prefer position-aware workshop roles (do not use blanket admin write).
  return resolveWorkshopRoles(supabase, userId, projectId)
}

export async function getWorkshopCapabilities(
  supabase: SupabaseClient,
  projectId: string
) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const roles = await resolveWorkshopRoles(supabase, user.id, projectId)
  const canWrite = canWriteWorkshop(roles)
  const canApprove = roles.some((r) => r === 'PM' || r === 'SITE_MANAGER')
  const canComment = roles.some((r) =>
    ['PM', 'SITE_MANAGER', 'TECHNICAL_OFFICE', 'SUPERVISOR'].includes(r)
  )
  return {
    roles,
    canWrite,
    canApprove,
    canComment,
    readOnly: !canWrite,
  }
}

/**
 * Absolute-weight check for the sibling group a package belongs to (children must sum to the
 * parent's weight). Returned as a warning with the save response; it never blocks the save.
 */
export async function checkPackageSiblingWeights(
  supabase: SupabaseClient,
  pkg: Record<string, unknown>
): Promise<WeightIssue | null> {
  const parentPackageId = pkg.parent_package_id ? String(pkg.parent_package_id) : null
  const parentTaskId = pkg.project_task_id ? String(pkg.project_task_id) : null
  if (!parentPackageId && !parentTaskId) return null

  let siblingsQuery = supabase.from('workshop_packages').select('*').eq('project_id', String(pkg.project_id))
  siblingsQuery = parentPackageId
    ? siblingsQuery.eq('parent_package_id', parentPackageId)
    : siblingsQuery.eq('project_task_id', parentTaskId!).is('parent_package_id', null)
  const [siblings, parent] = await Promise.all([
    siblingsQuery,
    parentPackageId
      ? supabase.from('workshop_packages').select('*').eq('id', parentPackageId).maybeSingle()
      : supabase.from('project_tasks').select('id, name, schedule_weight, physical_weight').eq('id', parentTaskId!).maybeSingle(),
  ])
  if (siblings.error || parent.error || !parent.data) return null

  const parentRow = parent.data as Record<string, unknown>
  const parentWeight = parentPackageId
    ? resolvePackageWeight(parentRow)
    : normalizeScheduleWeightPercent(Number(parentRow.physical_weight ?? parentRow.schedule_weight))
  const rows = (siblings.data ?? []) as Record<string, unknown>[]
  return resolveSiblingWeights(parentWeight, rows.map(resolvePackageWeight), {
    id: String(parentRow.id),
    label: String(parentRow.name ?? '') || null,
  }).issue
}

async function loadPackage(supabase: SupabaseClient, packageId: string) {
  const { data, error } = await supabase
    .from('workshop_packages')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()
  if (error) throw new WorkshopError('VALIDATION', error.message)
  if (!data) throw new WorkshopError('NOT_FOUND', 'پکیج پیدا نشد')
  return data
}

async function writeApprovalEvent(
  supabase: SupabaseClient,
  opts: {
    projectId: string
    packageId: string
    eventType: string
    comment?: string | null
    proposedChange?: PackageChangePayload | null
    actorId: string
  }
) {
  await supabase.from('workshop_approval_events').insert({
    project_id: opts.projectId,
    package_id: opts.packageId,
    event_type: opts.eventType,
    comment: opts.comment?.trim() || null,
    proposed_change: opts.proposedChange ?? null,
    actor_id: opts.actorId,
  })
}

function normalizeChangePayload(input: UpdatePackageInput | PackageChangePayload): PackageChangePayload {
  const out: PackageChangePayload = {}
  if (input.name !== undefined) {
    const name = input.name?.trim()
    if (!name) throw new WorkshopError('VALIDATION', 'نام را وارد کنید')
    out.name = name
  }
  if (input.quantity !== undefined) {
    if (!(Number(input.quantity) > 0)) throw new WorkshopError('VALIDATION', 'مقدار باید بزرگ‌تر از صفر باشد')
    out.quantity = Number(input.quantity)
  }
  if (input.uom !== undefined) {
    const uom = input.uom?.trim()
    if (!uom) throw new WorkshopError('VALIDATION', 'واحد را انتخاب کنید')
    out.uom = uom
  }
  if (input.location !== undefined) out.location = input.location?.trim() || null
  if (input.crew !== undefined) out.crew = input.crew?.trim() || null
  if (input.note !== undefined) out.note = input.note?.trim() || null
  return out
}

function clampPackageWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value * 10000) / 10000)
}

const OPTIONAL_PACKAGE_COLUMNS = [
  'weight_percent',
  'wbs_code',
  'start_date',
  'finish_date',
  'subcontractor_id',
  'schedule_fields',
  'quantity_certainty',
  'unit_price',
] as const

function isMissingColumnError(message: string, column: string): boolean {
  return new RegExp(column, 'i').test(message) && /column|schema|could not find/i.test(message)
}

/** Insert workshop_packages row, omitting optional columns if DB schema lacks them. */
async function insertPackageRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let payload = { ...row }

  for (let attempt = 0; attempt <= OPTIONAL_PACKAGE_COLUMNS.length; attempt += 1) {
    const { data, error } = await supabase
      .from('workshop_packages')
      .insert(payload)
      .select('*')
      .single()

    if (!error && data) return data as Record<string, unknown>

    if (!error) throw new WorkshopError('VALIDATION', 'ذخیره نشد')

    const missing = OPTIONAL_PACKAGE_COLUMNS.find(
      (col) => payload[col] !== undefined && isMissingColumnError(error.message, col)
    )
    if (missing) {
      const next = { ...payload }
      delete next[missing]
      payload = next
      continue
    }

    throw new WorkshopError('VALIDATION', error.message)
  }

  throw new WorkshopError('VALIDATION', 'ذخیره نشد')
}

/** Update workshop_packages row, omitting optional columns if DB schema lacks them. */
async function updatePackageRow(
  supabase: SupabaseClient,
  packageId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let payload = { ...patch }

  for (let attempt = 0; attempt <= OPTIONAL_PACKAGE_COLUMNS.length; attempt += 1) {
    const { data, error } = await supabase
      .from('workshop_packages')
      .update(payload)
      .eq('id', packageId)
      .select('*')
      .single()

    if (!error && data) return data as Record<string, unknown>

    if (!error) throw new WorkshopError('VALIDATION', 'ذخیره نشد')

    const missing = OPTIONAL_PACKAGE_COLUMNS.find(
      (col) => payload[col] !== undefined && isMissingColumnError(error.message, col)
    )
    if (missing) {
      const next = { ...payload }
      delete next[missing]
      payload = next
      continue
    }

    throw new WorkshopError('VALIDATION', error.message)
  }

  throw new WorkshopError('VALIDATION', 'ذخیره نشد')
}

function nestPackages(rows: Record<string, unknown>[]): {
  byTask: Map<string, WorkshopPackageNode[]>
  rootsUnderPackages: WorkshopPackageNode[]
} {
  const byId = new Map<string, WorkshopPackageNode>()
  for (const row of rows) {
    byId.set(String(row.id), mapPackage(row, []))
  }
  const byTask = new Map<string, WorkshopPackageNode[]>()
  const rootsUnderPackages: WorkshopPackageNode[] = []

  for (const row of rows) {
    const node = byId.get(String(row.id))!
    const parentPkg = row.parent_package_id ? String(row.parent_package_id) : null
    if (parentPkg && byId.has(parentPkg)) {
      byId.get(parentPkg)!.children.push(node)
      continue
    }
    const taskId = row.project_task_id ? String(row.project_task_id) : null
    if (taskId) {
      const list = byTask.get(taskId) ?? []
      list.push(node)
      byTask.set(taskId, list)
    } else {
      rootsUnderPackages.push(node)
    }
  }
  return { byTask, rootsUnderPackages }
}

export async function getScheduleTree(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const capabilities = await getWorkshopCapabilities(supabase, projectId)
  return { ...(await loadScheduleTree(supabase, projectId)), capabilities }
}

/** Schedule tree without the user/access checks (service-role jobs and scripts). */
export async function loadScheduleTree(supabase: SupabaseClient, projectId: string) {
  const tasks = await fetchAllProjectTasks(supabase, projectId)
  const [{ data: packages, error }, { data: calcs }, predecessorDisplay] = await Promise.all([
    supabase
      .from('workshop_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    supabase
      .from('schedule_calculations')
      .select('task_id, total_float')
      .eq('project_id', projectId),
    fetchTaskPredecessorDisplay(supabase, projectId).catch(() => ({
      labels: {} as Record<string, string>,
      tooltips: {} as Record<string, string>,
    })),
  ])
  if (error) throw new WorkshopError('VALIDATION', error.message)

  const floatByTaskId = new Map<string, number>()
  for (const c of calcs ?? []) {
    floatByTaskId.set(c.task_id as string, Number(c.total_float) || 0)
  }

  const { byTask, rootsUnderPackages } = nestPackages((packages ?? []) as Record<string, unknown>[])
  const predecessorLabels = predecessorDisplay.labels

  const nodes: ScheduleTreeNode[] = enrichScheduleTreeWithWbs(
    buildScheduleHierarchy(
      tasks,
      byTask,
      floatByTaskId,
      predecessorLabels,
      predecessorDisplay.tooltips
    )
  )

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const taskContractorMemo = new Map<string, string | null>()
  const resolveTaskContractor = (taskId: string, visiting = new Set<string>()): string | null => {
    if (taskContractorMemo.has(taskId)) return taskContractorMemo.get(taskId) ?? null
    const task = taskById.get(taskId)
    if (!task || visiting.has(taskId)) return task?.subcontractor_id ?? null
    if (task.subcontractor_id) return task.subcontractor_id
    visiting.add(taskId)
    const resolved = task.parent_id ? resolveTaskContractor(task.parent_id, visiting) : null
    visiting.delete(taskId)
    taskContractorMemo.set(taskId, resolved)
    return resolved
  }
  const resolvePackages = (packages: WorkshopPackageNode[], inherited: string | null) => {
    for (const pkg of packages) {
      pkg.resolvedSubcontractorId = pkg.subcontractorId ?? inherited
      resolvePackages(pkg.children, pkg.resolvedSubcontractorId)
    }
  }
  for (const node of nodes) {
    if (!node.taskId) continue
    resolvePackages(node.packages, resolveTaskContractor(node.taskId))
  }

  const dependencyLinkCount = Object.keys(predecessorLabels).reduce((n, id) => {
    const label = predecessorLabels[id]
    if (!label?.trim()) return n
    return n + label.split(',').filter((p) => p.trim()).length
  }, 0)

  return {
    nodes,
    orphanPackages: rootsUnderPackages,
    packageCount: packages?.length ?? 0,
    dependencyLinkCount,
    tasksWithPredecessors: Object.keys(predecessorLabels).length,
  }
}

async function countPackageSiblings(
  supabase: SupabaseClient,
  projectId: string,
  parentPackageId: string | null,
  projectTaskId: string | null
): Promise<number> {
  let query = supabase
    .from('workshop_packages')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (parentPackageId) {
    query = query.eq('parent_package_id', parentPackageId)
  } else if (projectTaskId) {
    query = query.eq('project_task_id', projectTaskId).is('parent_package_id', null)
  } else {
    return 0
  }

  const { count, error } = await query
  if (error) throw new WorkshopError('VALIDATION', error.message)
  return count ?? 0
}

async function clearHeaderCommercialOnFirstChild(
  supabase: SupabaseClient,
  input: CreatePackageInput,
  _createdId: string
) {
  if (input.parentPackageId) {
    const siblings = await countPackageSiblings(
      supabase,
      input.projectId,
      input.parentPackageId,
      null
    )
    if (siblings !== 1) return
    await supabase
      .from('workshop_packages')
      .update({
        quantity: 0,
        unit_price: 0,
        subcontractor_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.parentPackageId)
      .eq('project_id', input.projectId)
    return
  }

  if (!input.parentScheduleNodeId) return
  const siblings = await countPackageSiblings(
    supabase,
    input.projectId,
    null,
    input.parentScheduleNodeId
  )
  if (siblings !== 1) return
  await supabase
    .from('project_tasks')
    .update({
      quantity: null,
      unit_price: null,
      subcontractor_id: null,
    })
    .eq('id', input.parentScheduleNodeId)
    .eq('project_id', input.projectId)
}

async function deletePackageTree(supabase: SupabaseClient, packageId: string) {
  const { data: children, error: childErr } = await supabase
    .from('workshop_packages')
    .select('id')
    .eq('parent_package_id', packageId)
  if (childErr) throw new WorkshopError('VALIDATION', childErr.message)
  for (const child of children ?? []) {
    await deletePackageTree(supabase, String(child.id))
  }
  const { error } = await supabase.from('workshop_packages').delete().eq('id', packageId)
  if (error) throw new WorkshopError('VALIDATION', error.message)
}

async function resolvePackageWbsCode(
  supabase: SupabaseClient,
  packageId: string
): Promise<string | null> {
  const { data: pkg, error } = await supabase
    .from('workshop_packages')
    .select('id, wbs_code, parent_package_id, project_task_id')
    .eq('id', packageId)
    .maybeSingle()
  if (error) throw new WorkshopError('VALIDATION', error.message)
  if (!pkg) return null
  if (pkg.wbs_code) return String(pkg.wbs_code)

  if (pkg.parent_package_id) {
    const parentWbs = await resolvePackageWbsCode(supabase, String(pkg.parent_package_id))
    if (!parentWbs) return null
    const { data: siblings } = await supabase
      .from('workshop_packages')
      .select('id')
      .eq('parent_package_id', pkg.parent_package_id)
      .order('created_at', { ascending: true })
    const index = (siblings ?? []).findIndex((s) => s.id === pkg.id)
    return nextChildWbs(parentWbs, index >= 0 ? index : 0)
  }

  if (pkg.project_task_id) {
    const { data: task } = await supabase
      .from('project_tasks')
      .select('wbs_code')
      .eq('id', pkg.project_task_id)
      .maybeSingle()
    const { data: siblings } = await supabase
      .from('workshop_packages')
      .select('id')
      .eq('project_task_id', pkg.project_task_id)
      .is('parent_package_id', null)
      .order('created_at', { ascending: true })
    const index = (siblings ?? []).findIndex((s) => s.id === pkg.id)
    return nextChildWbs(task?.wbs_code ?? null, index >= 0 ? index : 0)
  }

  return null
}

async function computePackageWbsCode(
  supabase: SupabaseClient,
  projectId: string,
  input: CreatePackageInput
): Promise<string> {
  const clientWbs = input.wbsCode?.trim()
  if (clientWbs) return clientWbs

  if (input.parentPackageId) {
    const parentWbs = await resolvePackageWbsCode(supabase, input.parentPackageId)
    if (!parentWbs) throw new WorkshopError('VALIDATION', 'کد WBS والد مشخص نیست')
    const siblingCount = await countPackageSiblings(
      supabase,
      projectId,
      input.parentPackageId,
      null
    )
    return nextChildWbs(parentWbs, siblingCount)
  }

  if (input.parentScheduleNodeId) {
    const { data: task } = await supabase
      .from('project_tasks')
      .select('wbs_code')
      .eq('id', input.parentScheduleNodeId)
      .eq('project_id', projectId)
      .maybeSingle()
    if (!task) throw new WorkshopError('NOT_FOUND', 'ردیف برنامه پیدا نشد')
    const siblingCount = await countPackageSiblings(
      supabase,
      projectId,
      null,
      input.parentScheduleNodeId
    )
    return nextChildWbs(task.wbs_code ?? null, siblingCount)
  }

  throw new WorkshopError('VALIDATION', 'والد نامعتبر است')
}

export async function createPackage(supabase: SupabaseClient, input: CreatePackageInput) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, input.projectId)
  const roles = await resolveRoles(supabase, user.id, input.projectId)
  assertHasRole(roles, WORKSHOP_WRITE_ROLES)
  const fields = validateCreatePackage(input)

  let startDate = input.startDate ?? null
  let finishDate = input.finishDate ?? null

  if (input.parentScheduleNodeId) {
    const { data: task } = await supabase
      .from('project_tasks')
      .select('id, name, wbs_code, msp_uid, start_current, start_planned, finish_current, finish_planned')
      .eq('id', input.parentScheduleNodeId)
      .eq('project_id', input.projectId)
      .maybeSingle()
    if (!task) throw new WorkshopError('NOT_FOUND', 'ردیف برنامه پیدا نشد')
    if (!startDate) {
      startDate =
        (task.start_current as string) ?? (task.start_planned as string) ?? null
    }
    if (!finishDate) {
      finishDate =
        (task.finish_current as string) ?? (task.finish_planned as string) ?? null
    }
  }

  if (input.parentPackageId) {
    const { data: parentPkg } = await supabase
      .from('workshop_packages')
      .select('id, start_date, finish_date, project_task_id')
      .eq('id', input.parentPackageId)
      .eq('project_id', input.projectId)
      .maybeSingle()
    if (!parentPkg) throw new WorkshopError('NOT_FOUND', 'زیرمجموعه والد پیدا نشد')
    if (!startDate || !finishDate) {
      let start = (parentPkg.start_date as string) ?? null
      let finish = (parentPkg.finish_date as string) ?? null
      if ((!start || !finish) && parentPkg.project_task_id) {
        const { data: task } = await supabase
          .from('project_tasks')
          .select('start_current, start_planned, finish_current, finish_planned')
          .eq('id', parentPkg.project_task_id)
          .maybeSingle()
        start =
          start ??
          (task?.start_current as string) ??
          (task?.start_planned as string) ??
          null
        finish =
          finish ??
          (task?.finish_current as string) ??
          (task?.finish_planned as string) ??
          null
      }
      startDate = startDate ?? start
      finishDate = finishDate ?? finish
    }
  }

  const wbsCode = await computePackageWbsCode(supabase, input.projectId, input)

  if (input.subcontractorId) {
    const { data: contractor } = await supabase
      .from('project_subcontractors')
      .select('id')
      .eq('id', input.subcontractorId)
      .eq('project_id', input.projectId)
      .maybeSingle()
    if (!contractor) {
      throw new WorkshopError('VALIDATION', 'پیمانکار متعلق به این پروژه نیست')
    }
  }

  const inferred = inferReviewReason({
    flagForReview: fields.flag_for_review,
    parentMissingBasis: false,
  })

  const unitPrice = Math.max(0, Number(input.unitPrice) || 0)
  const quantityCertainty = input.quantityCertainty === 'قطعی' ? 'قطعی' : 'حدودی'
  const incomingPreds = String(
    (input.scheduleFields as { predecessors?: string } | undefined)?.predecessors ?? ''
  ).trim()
  let inheritedPreds = incomingPreds
  if (!inheritedPreds && input.parentPackageId) {
    const { data: parentPkg } = await supabase
      .from('workshop_packages')
      .select('schedule_fields')
      .eq('id', input.parentPackageId)
      .eq('project_id', input.projectId)
      .maybeSingle()
    const parentFields =
      parentPkg?.schedule_fields && typeof parentPkg.schedule_fields === 'object'
        ? (parentPkg.schedule_fields as Record<string, unknown>)
        : {}
    inheritedPreds = String(
      parentFields.predecessors ?? parentFields.predecessor_label ?? ''
    ).trim()
  }
  if (!inheritedPreds && input.parentScheduleNodeId) {
    try {
      const labels = await fetchTaskPredecessorLabels(supabase, input.projectId)
      inheritedPreds = labels[input.parentScheduleNodeId] ?? ''
    } catch {
      inheritedPreds = ''
    }
  }
  const scheduleFields = seedNewPackageProgressFields(
    mergePackageScheduleFields(
      {
        ...(input.scheduleFields ?? {}),
        ...(inheritedPreds ? { predecessors: inheritedPreds } : {}),
      },
      {
        unitPrice,
        quantityCertainty,
      }
    )
  )
  const noteWithCommercial = encodePackageCommercialInNote(
    encodePackageWeightInNote(
      fields.note,
      input.weightPercent != null && Number.isFinite(input.weightPercent)
        ? clampPackageWeight(input.weightPercent)
        : null
    ),
    { unitPrice, quantityCertainty }
  )

  const insertBase: Record<string, unknown> = {
    project_id: input.projectId,
    project_task_id: input.parentScheduleNodeId ?? null,
    parent_package_id: input.parentPackageId ?? null,
    name: fields.name,
    location: fields.location,
    quantity: fields.quantity,
    quantity_certainty: quantityCertainty,
    unit_price: unitPrice,
    uom: fields.uom,
    crew: fields.crew,
    note: noteWithCommercial,
    status: inferred.flag ? 'needs_review' : 'ready',
    approval_status: WORKSHOP_SKIP_PM_APPROVAL ? 'approved' : 'draft',
    approved_at: WORKSHOP_SKIP_PM_APPROVAL ? new Date().toISOString() : null,
    approved_by: WORKSHOP_SKIP_PM_APPROVAL ? user.id : null,
    origin: 'user_added',
    flag_for_review: inferred.flag || fields.flag_for_review,
    review_reason: fields.review_reason ?? inferred.note,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (input.weightPercent != null && Number.isFinite(input.weightPercent)) {
    insertBase.weight_percent = clampPackageWeight(input.weightPercent)
  }

  insertBase.wbs_code = wbsCode
  insertBase.subcontractor_id = input.subcontractorId ?? null
  insertBase.schedule_fields = scheduleFields

  if (startDate) insertBase.start_date = String(startDate).slice(0, 10)
  if (finishDate) insertBase.finish_date = String(finishDate).slice(0, 10)

  const created = await insertPackageRow(supabase, insertBase)
  await clearHeaderCommercialOnFirstChild(supabase, input, String(created.id))

  if (created.flag_for_review) {
    await supabase.from('workshop_review_flags').insert({
      project_id: input.projectId,
      entity_type: 'package',
      entity_id: created.id,
      reason_code: inferred.reasonCode ?? 'needs_technical_mapping',
      severity: 'warn',
      status: 'open',
      note: created.review_reason,
      created_by: user.id,
    })
  }

  await writeSiteOpsAudit(supabase, {
    projectId: input.projectId,
    actorId: user.id,
    action: 'workshop.package.create',
    entityType: 'workshop_package',
    entityId: String(created.id),
    payload: { name: created.name, parent_task: input.parentScheduleNodeId, wbs_code: wbsCode },
  })

  return { ...created, wbs_code: created.wbs_code ?? wbsCode }
}

export async function updatePackage(
  supabase: SupabaseClient,
  packageId: string,
  input: UpdatePackageInput
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, WORKSHOP_WRITE_ROLES)

  assertCanEditPackage(
    pkg.approval_status as ApprovalStatus,
    (pkg.origin as string) ?? 'user_added'
  )

  const fields = normalizeChangePayload(input)
  const dbPatch: Record<string, unknown> = {
    ...fields,
    updated_at: new Date().toISOString(),
  }
  if (input.flagForReview !== undefined) {
    dbPatch.flag_for_review = Boolean(input.flagForReview)
  }
  if (input.reviewReason !== undefined) {
    dbPatch.review_reason = input.reviewReason?.trim() || null
  }
  if (input.weightPercent !== undefined) {
    const weight =
      input.weightPercent == null ? null : clampPackageWeight(Number(input.weightPercent))
    dbPatch.weight_percent = weight
    const baseNote =
      input.note !== undefined
        ? input.note?.trim() || null
        : stripPackageWeightFromNote(String(pkg.note ?? '')) || null
    dbPatch.note = encodePackageWeightInNote(baseNote, weight)
  } else if (input.note !== undefined) {
    dbPatch.note = encodePackageWeightInNote(
      input.note?.trim() || null,
      resolvePackageWeight(pkg)
    )
  }

  if (input.startDate !== undefined || input.finishDate !== undefined) {
    const startRaw =
      input.startDate !== undefined ? input.startDate : (pkg.start_date as string | null)
    const finishRaw =
      input.finishDate !== undefined ? input.finishDate : (pkg.finish_date as string | null)
    const start = startRaw ? String(startRaw).slice(0, 10) : null
    const finish = finishRaw ? String(finishRaw).slice(0, 10) : null
    if (start && finish && finish < start) {
      throw new WorkshopError('VALIDATION', 'پایان نمی‌تواند قبل از شروع باشد')
    }
    if (input.startDate !== undefined) dbPatch.start_date = start
    if (input.finishDate !== undefined) dbPatch.finish_date = finish
  }

  if (input.subcontractorId !== undefined) {
    if (input.subcontractorId) {
      const { data: contractor } = await supabase
        .from('project_subcontractors')
        .select('id')
        .eq('id', input.subcontractorId)
        .eq('project_id', pkg.project_id)
        .maybeSingle()
      if (!contractor) {
        throw new WorkshopError('VALIDATION', 'پیمانکار متعلق به این پروژه نیست')
      }
    }
    dbPatch.subcontractor_id = input.subcontractorId || null
  }
  if (input.scheduleFields !== undefined) {
    dbPatch.schedule_fields = input.scheduleFields
  }
  if (input.quantityCertainty !== undefined) {
    if (input.quantityCertainty !== 'حدودی' && input.quantityCertainty !== 'قطعی') {
      throw new WorkshopError('VALIDATION', 'وضعیت مقدار باید حدودی یا قطعی باشد')
    }
    dbPatch.quantity_certainty = input.quantityCertainty
  }
  if (input.unitPrice !== undefined) {
    if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
      throw new WorkshopError('VALIDATION', 'قیمت واحد نامعتبر است')
    }
    dbPatch.unit_price = input.unitPrice
  }

  // Always mirror commercial fields into schedule_fields + note so saves survive
  // when unit_price / quantity_certainty columns are missing in Supabase.
  if (input.unitPrice !== undefined || input.quantityCertainty !== undefined) {
    const existingFields =
      (dbPatch.schedule_fields as Record<string, unknown> | undefined) ??
      (pkg.schedule_fields && typeof pkg.schedule_fields === 'object'
        ? (pkg.schedule_fields as Record<string, unknown>)
        : {})
    const nextPrice =
      input.unitPrice !== undefined
        ? input.unitPrice
        : readPackageUnitPrice(pkg)
    const nextCertainty =
      input.quantityCertainty !== undefined
        ? input.quantityCertainty
        : readPackageQuantityCertainty(pkg)
    dbPatch.schedule_fields = mergePackageScheduleFields(existingFields, {
      unitPrice: nextPrice,
      quantityCertainty: nextCertainty,
    })
    const noteBase =
      dbPatch.note !== undefined
        ? stripPackageCommercialFromNote(String(dbPatch.note ?? ''))
        : stripPackageCommercialFromNote(
            stripPackageWeightFromNote(String(pkg.note ?? ''))
          )
    const withWeight = encodePackageWeightInNote(
      noteBase,
      input.weightPercent !== undefined
        ? input.weightPercent == null
          ? null
          : clampPackageWeight(Number(input.weightPercent))
        : resolvePackageWeight(pkg)
    )
    dbPatch.note = encodePackageCommercialInNote(withWeight, {
      unitPrice: nextPrice,
      quantityCertainty: nextCertainty,
    })
  }

  if (WORKSHOP_SKIP_PM_APPROVAL) {
    const s = pkg.approval_status as ApprovalStatus
    if (s !== 'change_requested') {
      dbPatch.approval_status = 'approved'
      dbPatch.approved_at = new Date().toISOString()
      dbPatch.approved_by = user.id
    }
  }

  const data = await updatePackageRow(supabase, packageId, dbPatch)

  const nextQty = Number(data.quantity ?? pkg.quantity ?? 0) || 0
  const nextUom = String(data.uom ?? pkg.uom ?? 'm')
  const nextPrice =
    input.unitPrice !== undefined
      ? input.unitPrice
      : readPackageUnitPrice(data as Record<string, unknown>) ||
        readPackageUnitPrice(pkg)
  const statementPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.unitPrice !== undefined) statementPatch.unit_price = nextPrice
  if (input.quantity !== undefined) statementPatch.estimated_qty = nextQty
  if (input.uom !== undefined) statementPatch.uom = nextUom
  if (input.quantityCertainty !== undefined) {
    statementPatch.qty_kind = input.quantityCertainty === 'قطعی' ? 'final' : 'estimated'
  }
  if (Object.keys(statementPatch).length > 1) {
    await supabase
      .from('contractor_activity_statements')
      .update(statementPatch)
      .eq('project_id', pkg.project_id)
      .eq('entity_type', 'package')
      .eq('entity_id', packageId)
  }

  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'workshop.package.update',
    entityType: 'workshop_package',
    entityId: packageId,
    payload: { ...fields } as Record<string, unknown>,
  })

  return data
}

export async function deletePackage(supabase: SupabaseClient, packageId: string) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, WORKSHOP_WRITE_ROLES)
  assertCanDeletePackage(
    pkg.approval_status as ApprovalStatus,
    (pkg.origin as string) ?? 'user_added'
  )

  await deletePackageTree(supabase, packageId)

  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'workshop.package.delete',
    entityType: 'workshop_package',
    entityId: packageId,
    payload: { name: pkg.name },
  })

  return { ok: true }
}

export async function submitPackageForApproval(supabase: SupabaseClient, packageId: string) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, WORKSHOP_WRITE_ROLES)

  if (WORKSHOP_SKIP_PM_APPROVAL) {
    const { data, error } = await supabase
      .from('workshop_packages')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', packageId)
      .select('*')
      .single()
    if (error) throw new WorkshopError('VALIDATION', error.message)
    return data
  }

  assertCanSubmitForApproval(pkg.approval_status as ApprovalStatus)

  const { data, error } = await supabase
    .from('workshop_packages')
    .update({
      approval_status: 'pending_approval',
      last_pm_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (error) throw new WorkshopError('VALIDATION', error.message)

  await writeApprovalEvent(supabase, {
    projectId: pkg.project_id,
    packageId,
    eventType: 'submit',
    actorId: user.id,
  })
  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'workshop.package.submit',
    entityType: 'workshop_package',
    entityId: packageId,
    payload: {},
  })
  return data
}

export async function approvePackage(
  supabase: SupabaseClient,
  packageId: string,
  comment?: string | null
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, ['PM', 'SITE_MANAGER'])

  if ((pkg.approval_status as ApprovalStatus) !== 'pending_approval') {
    throw new WorkshopError('VALIDATION', 'فقط موارد در انتظار تأیید قابل تأیید هستند')
  }

  const { data, error } = await supabase
    .from('workshop_packages')
    .update({
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      last_pm_comment: comment?.trim() || null,
      pending_change: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (error) throw new WorkshopError('VALIDATION', error.message)

  await writeApprovalEvent(supabase, {
    projectId: pkg.project_id,
    packageId,
    eventType: 'approve',
    comment,
    actorId: user.id,
  })
  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'workshop.package.approve',
    entityType: 'workshop_package',
    entityId: packageId,
    payload: { comment: comment ?? null },
  })
  return data
}

export async function rejectPackage(
  supabase: SupabaseClient,
  packageId: string,
  comment: string
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, ['PM', 'SITE_MANAGER'])

  if ((pkg.approval_status as ApprovalStatus) !== 'pending_approval') {
    throw new WorkshopError('VALIDATION', 'فقط موارد در انتظار تأیید قابل رد هستند')
  }
  const note = comment?.trim()
  if (!note) throw new WorkshopError('VALIDATION', 'برای رد کردن، کامنت الزامی است')

  const { data, error } = await supabase
    .from('workshop_packages')
    .update({
      approval_status: 'rejected',
      last_pm_comment: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (error) throw new WorkshopError('VALIDATION', error.message)

  await writeApprovalEvent(supabase, {
    projectId: pkg.project_id,
    packageId,
    eventType: 'reject',
    comment: note,
    actorId: user.id,
  })
  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'workshop.package.reject',
    entityType: 'workshop_package',
    entityId: packageId,
    payload: { comment: note },
  })
  return data
}

export async function commentOnPackage(
  supabase: SupabaseClient,
  packageId: string,
  comment: string
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, ['PM', 'SITE_MANAGER', 'TECHNICAL_OFFICE', 'SUPERVISOR'])

  const note = comment?.trim()
  if (!note) throw new WorkshopError('VALIDATION', 'کامنت خالی است')

  // Keep approval-event trail for PM inbox actions; discussion lives in comments table when available.
  await writeApprovalEvent(supabase, {
    projectId: pkg.project_id,
    packageId,
    eventType: 'comment',
    comment: note,
    actorId: user.id,
  })

  const { data, error } = await supabase
    .from('workshop_package_comments')
    .insert({
      project_id: pkg.project_id,
      package_id: packageId,
      body: note,
      author_id: user.id,
    })
    .select('*')
    .single()

  if (error) {
    // Migration 48 not applied yet — fall back to last_pm_comment only for PM notes
    if (error.code === '42P01') {
      await supabase
        .from('workshop_packages')
        .update({ last_pm_comment: note, updated_at: new Date().toISOString() })
        .eq('id', packageId)
      return { ok: true, comment: null }
    }
    throw new WorkshopError('VALIDATION', error.message)
  }

  return { ok: true, comment: data }
}

async function enrichCommentAuthors(
  supabase: SupabaseClient,
  rows: Array<Record<string, unknown>>
) {
  const ids = [...new Set(rows.map((r) => String(r.author_id)).filter(Boolean))]
  if (ids.length === 0) return rows
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids)
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string]))
  return rows.map((r) => ({
    ...r,
    author_name: byId.get(String(r.author_id)) ?? null,
  }))
}

export async function listPackageComments(supabase: SupabaseClient, packageId: string) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)

  const { data, error } = await supabase
    .from('workshop_package_comments')
    .select('*')
    .eq('package_id', packageId)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01') return { comments: [], currentUserId: user.id }
    throw new WorkshopError('VALIDATION', error.message)
  }

  const comments = await enrichCommentAuthors(supabase, (data ?? []) as Record<string, unknown>[])
  return { comments, currentUserId: user.id }
}

export async function updatePackageComment(
  supabase: SupabaseClient,
  commentId: string,
  body: string
) {
  const user = await requireUser(supabase)
  const note = body?.trim()
  if (!note) throw new WorkshopError('VALIDATION', 'کامنت خالی است')

  const { data: existing, error: findErr } = await supabase
    .from('workshop_package_comments')
    .select('*')
    .eq('id', commentId)
    .maybeSingle()
  if (findErr) throw new WorkshopError('VALIDATION', findErr.message)
  if (!existing) throw new WorkshopError('NOT_FOUND', 'کامنت پیدا نشد')

  await assertProjectAccess(supabase, user.id, existing.project_id)
  if (existing.author_id !== user.id) {
    throw new WorkshopError('FORBIDDEN', 'فقط نویسنده می‌تواند این کامنت را ویرایش کند')
  }

  const { data, error } = await supabase
    .from('workshop_package_comments')
    .update({
      body: note,
      updated_at: new Date().toISOString(),
      edited_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('author_id', user.id)
    .select('*')
    .single()
  if (error) throw new WorkshopError('VALIDATION', error.message)
  return data
}

export async function requestPackageChange(
  supabase: SupabaseClient,
  packageId: string,
  body: { change: UpdatePackageInput; comment?: string | null }
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, WORKSHOP_WRITE_ROLES)

  const status = pkg.approval_status as ApprovalStatus
  if (status === 'approved') {
    assertCanRequestChange(status)
  } else if (!canReviseChangeRequest(status)) {
    throw new WorkshopError('VALIDATION', 'در این وضعیت درخواست تغییر مجاز نیست')
  }

  const proposed = normalizeChangePayload(body.change)
  if (Object.keys(proposed).length === 0) {
    throw new WorkshopError('VALIDATION', 'حداقل یک فیلد برای تغییر مشخص کنید')
  }

  const { data, error } = await supabase
    .from('workshop_packages')
    .update({
      approval_status: 'change_requested',
      pending_change: proposed,
      last_pm_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (error) throw new WorkshopError('VALIDATION', error.message)

  await writeApprovalEvent(supabase, {
    projectId: pkg.project_id,
    packageId,
    eventType: 'change_request',
    comment: body.comment,
    proposedChange: proposed,
    actorId: user.id,
  })
  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'workshop.package.change_request',
    entityType: 'workshop_package',
    entityId: packageId,
    payload: { ...proposed } as Record<string, unknown>,
  })
  return data
}

export async function decidePackageChange(
  supabase: SupabaseClient,
  packageId: string,
  body: { decision: 'approve' | 'reject'; comment?: string | null }
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, ['PM', 'SITE_MANAGER'])

  if ((pkg.approval_status as ApprovalStatus) !== 'change_requested') {
    throw new WorkshopError('VALIDATION', 'درخواست تغییری در صف نیست')
  }

  if (body.decision === 'approve') {
    const pending = (pkg.pending_change ?? {}) as PackageChangePayload
    const { data, error } = await supabase
      .from('workshop_packages')
      .update({
        ...pending,
        approval_status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        pending_change: null,
        last_pm_comment: body.comment?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', packageId)
      .select('*')
      .single()
    if (error) throw new WorkshopError('VALIDATION', error.message)

    await writeApprovalEvent(supabase, {
      projectId: pkg.project_id,
      packageId,
      eventType: 'change_approve',
      comment: body.comment,
      proposedChange: pending,
      actorId: user.id,
    })
    return data
  }

  const note = body.comment?.trim()
  if (!note) throw new WorkshopError('VALIDATION', 'برای رد درخواست تغییر، کامنت الزامی است')

  const { data, error } = await supabase
    .from('workshop_packages')
    .update({
      approval_status: 'approved',
      pending_change: null,
      last_pm_comment: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', packageId)
    .select('*')
    .single()
  if (error) throw new WorkshopError('VALIDATION', error.message)

  await writeApprovalEvent(supabase, {
    projectId: pkg.project_id,
    packageId,
    eventType: 'change_reject',
    comment: note,
    actorId: user.id,
  })
  return data
}

export async function listApprovalInbox(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const roles = await resolveRoles(supabase, user.id, projectId)
  assertHasRole(roles, ['PM', 'SITE_MANAGER', 'TECHNICAL_OFFICE', 'SUPERVISOR', 'PROJECT_CONTROLS'])

  const { data, error } = await supabase
    .from('workshop_packages')
    .select('*')
    .eq('project_id', projectId)
    .in('approval_status', ['pending_approval', 'change_requested'])
    .order('updated_at', { ascending: false })
  if (error) throw new WorkshopError('VALIDATION', error.message)

  const canDecide = roles.some((r) => r === 'PM' || r === 'SITE_MANAGER')
  return { items: data ?? [], canDecide, roles }
}

export async function listPreparedPackages(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const roles = await resolveRoles(supabase, user.id, projectId)
  assertHasRole(roles, [
    'SUPERVISOR',
    'PM',
    'SITE_MANAGER',
    'TECHNICAL_OFFICE',
    'PROJECT_CONTROLS',
    'VIEWER',
  ])

  // Supervisor sees everything TO prepared, including drafts/rejected + PM status.
  const { data, error } = await supabase
    .from('workshop_packages')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (error) throw new WorkshopError('VALIDATION', error.message)
  return { items: data ?? [], currentUserId: user.id }
}

export async function listPackageEvents(supabase: SupabaseClient, packageId: string) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)

  const { data, error } = await supabase
    .from('workshop_approval_events')
    .select('*')
    .eq('package_id', packageId)
    .order('created_at', { ascending: false })
  if (error) throw new WorkshopError('VALIDATION', error.message)
  return data ?? []
}

export async function sendToToday(
  supabase: SupabaseClient,
  packageId: string,
  body: { date: string; plannedQty: number }
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, WORKSHOP_WRITE_ROLES)
  assertCanSendToToday(pkg.approval_status as ApprovalStatus)

  if (!(body.plannedQty > 0)) throw new WorkshopError('VALIDATION', 'مقدار امروز باید بزرگ‌تر از صفر باشد')

  const { data, error: upErr } = await supabase
    .from('workshop_daily_assignments')
    .upsert(
      {
        project_id: pkg.project_id,
        package_id: packageId,
        plan_date: body.date,
        planned_qty: body.plannedQty,
        status: 'planned',
        created_by: user.id,
      },
      { onConflict: 'package_id,plan_date' }
    )
    .select('*')
    .single()
  if (upErr) throw new WorkshopError('VALIDATION', upErr.message)

  await supabase
    .from('workshop_packages')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', packageId)
    .in('status', ['draft', 'ready', 'needs_review'])

  await writeSiteOpsAudit(supabase, {
    projectId: pkg.project_id,
    actorId: user.id,
    action: 'workshop.send_to_today',
    entityType: 'workshop_assignment',
    entityId: data.id,
    payload: { planned_qty: body.plannedQty, date: body.date },
  })

  return data
}

export async function addActual(
  supabase: SupabaseClient,
  assignmentId: string,
  body: { actualQty: number; status: 'done' | 'partial' | 'blocked'; note?: string | null }
) {
  const user = await requireUser(supabase)
  const { data: asg, error } = await supabase
    .from('workshop_daily_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle()
  if (error) throw new WorkshopError('VALIDATION', error.message)
  if (!asg) throw new WorkshopError('NOT_FOUND', 'برنامه امروز پیدا نشد')
  await assertProjectAccess(supabase, user.id, asg.project_id)

  if (body.actualQty < 0) throw new WorkshopError('VALIDATION', 'مقدار واقعی نامعتبر است')

  const { data, error: insErr } = await supabase
    .from('workshop_actual_entries')
    .insert({
      assignment_id: assignmentId,
      actual_qty: body.actualQty,
      status: body.status,
      note: body.note?.trim() || null,
      recorded_by: user.id,
    })
    .select('*')
    .single()
  if (insErr) throw new WorkshopError('VALIDATION', insErr.message)

  await supabase
    .from('workshop_daily_assignments')
    .update({ status: body.status === 'done' ? 'done' : body.status === 'blocked' ? 'blocked' : 'partial' })
    .eq('id', assignmentId)

  await supabase
    .from('workshop_packages')
    .update({
      status: body.status === 'done' ? 'done' : body.status === 'blocked' ? 'blocked' : 'partial',
      updated_at: new Date().toISOString(),
    })
    .eq('id', asg.package_id)

  await writeSiteOpsAudit(supabase, {
    projectId: asg.project_id,
    actorId: user.id,
    action: 'workshop.actual',
    entityType: 'workshop_actual',
    entityId: data.id,
    payload: { actual_qty: body.actualQty, status: body.status },
  })

  return data
}

export async function getPackageCumulativeActuals(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, number>> {
  const { data: assignments, error: aErr } = await supabase
    .from('workshop_daily_assignments')
    .select('id, package_id')
    .eq('project_id', projectId)
  if (aErr) throw new WorkshopError('VALIDATION', aErr.message)
  if (!assignments?.length) return {}

  const assignmentToPackage = new Map(
    assignments.map((a) => [String(a.id), String(a.package_id)])
  )
  const assignmentIds = assignments.map((a) => a.id)

  const { data: entries, error: eErr } = await supabase
    .from('workshop_actual_entries')
    .select('assignment_id, actual_qty')
    .in('assignment_id', assignmentIds)
  if (eErr) throw new WorkshopError('VALIDATION', eErr.message)

  const totals: Record<string, number> = {}
  for (const entry of entries ?? []) {
    const packageId = assignmentToPackage.get(String(entry.assignment_id))
    if (!packageId) continue
    totals[packageId] = (totals[packageId] ?? 0) + Number(entry.actual_qty ?? 0)
  }
  return totals
}

const SUPERVISOR_PROGRESS_ROLES: SiteOpsRole[] = [
  'SUPERVISOR',
  'TECHNICAL_OFFICE',
  'SITE_MANAGER',
  'PM',
  'PLANNER',
  'PROJECT_CONTROLS',
]

export async function reportSupervisorPackageProgress(
  supabase: SupabaseClient,
  packageId: string,
  body: { date: string; progressPercent: number; note?: string | null }
) {
  const user = await requireUser(supabase)
  const pkg = await loadPackage(supabase, packageId)
  await assertProjectAccess(supabase, user.id, pkg.project_id)
  const roles = await resolveRoles(supabase, user.id, pkg.project_id)
  assertHasRole(roles, SUPERVISOR_PROGRESS_ROLES)

  const percent = Math.min(100, Math.max(0, Number(body.progressPercent)))
  const quantity = Number(pkg.quantity) > 0 ? Number(pkg.quantity) : 1
  const targetQty = (quantity * percent) / 100

  const cumulativeMap = await getPackageCumulativeActuals(supabase, pkg.project_id)
  const cumulative = cumulativeMap[packageId] ?? 0
  const delta = targetQty - cumulative
  const note = body.note?.trim() || null

  const { data: asg, error: upErr } = await supabase
    .from('workshop_daily_assignments')
    .upsert(
      {
        project_id: pkg.project_id,
        package_id: packageId,
        plan_date: body.date,
        planned_qty: quantity,
        status: 'planned',
        created_by: user.id,
      },
      { onConflict: 'package_id,plan_date' }
    )
    .select('*')
    .single()
  if (upErr) throw new WorkshopError('VALIDATION', upErr.message)

  const status: 'done' | 'partial' | 'blocked' =
    percent >= 100 ? 'done' : percent > 0 ? 'partial' : 'partial'

  if (delta > 0 || note) {
    await addActual(supabase, String(asg.id), {
      actualQty: Math.max(0, delta),
      status,
      note,
    })
  } else if (percent >= 100 && cumulative >= quantity) {
    await supabase
      .from('workshop_packages')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', packageId)
  }

  const updatedCumulative = cumulative + Math.max(0, delta)
  const progressPercent = Math.min(100, Math.round((updatedCumulative / quantity) * 100))

  return {
    packageId,
    progressPercent,
    assignmentId: String(asg.id),
    cumulativeQty: updatedCumulative,
  }
}

export async function listToday(supabase: SupabaseClient, projectId: string, date: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  const { data, error } = await supabase
    .from('workshop_daily_assignments')
    .select('*, workshop_packages(*), workshop_actual_entries(*)')
    .eq('project_id', projectId)
    .eq('plan_date', date)
    .order('created_at', { ascending: true })
  if (error) throw new WorkshopError('VALIDATION', error.message)
  return data ?? []
}

export async function listOpenFlags(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  const { data, error } = await supabase
    .from('workshop_review_flags')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw new WorkshopError('VALIDATION', error.message)
  return data ?? []
}

export function workshopErrorResponse(error: unknown) {
  if (error instanceof WorkshopError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  if (error instanceof SiteOpsError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  const message = error instanceof Error ? error.message : 'Workshop error'
  return NextResponse.json({ error: message, code: 'VALIDATION' }, { status: 500 })
}
