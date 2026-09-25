import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { getWorkshopCapabilities, workshopErrorResponse } from '@/lib/workshop/service'
import { WorkshopError } from '@/lib/workshop/domain'

type Activity = {
  entityType: 'task' | 'package'
  entityId: string
  wbs: string | null
  title: string
  estimatedQty: number
  qtyKind: 'حدودی' | 'قطعی'
  uom: string
  unitPrice: number
  progressPercent: number
}

async function loadActivities(
  supabase: SupabaseClient,
  projectId: string,
  contractorId: string
): Promise<Activity[]> {
  const [{ data: tasks, error: taskError }, { data: packages, error: packageError }] =
    await Promise.all([
      supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId),
      supabase
        .from('workshop_packages')
        .select('*')
        .eq('project_id', projectId),
    ])
  if (taskError) throw new WorkshopError('VALIDATION', taskError.message)
  if (packageError) throw new WorkshopError('VALIDATION', packageError.message)

  const taskRows = (tasks ?? []) as Array<Record<string, unknown>>
  const packageRows = (packages ?? []) as Array<Record<string, unknown>>
  const taskById = new Map(taskRows.map((row) => [String(row.id), row]))
  const packageById = new Map(packageRows.map((row) => [String(row.id), row]))
  const taskMemo = new Map<string, string | null>()
  const packageMemo = new Map<string, string | null>()

  const resolveTask = (id: string, visiting = new Set<string>()): string | null => {
    if (taskMemo.has(id)) return taskMemo.get(id) ?? null
    const row = taskById.get(id)
    if (!row || visiting.has(id)) return null
    if (row.subcontractor_id) return String(row.subcontractor_id)
    visiting.add(id)
    const value = row.parent_id ? resolveTask(String(row.parent_id), visiting) : null
    visiting.delete(id)
    taskMemo.set(id, value)
    return value
  }
  const resolvePackage = (id: string, visiting = new Set<string>()): string | null => {
    if (packageMemo.has(id)) return packageMemo.get(id) ?? null
    const row = packageById.get(id)
    if (!row || visiting.has(id)) return null
    if (row.subcontractor_id) return String(row.subcontractor_id)
    visiting.add(id)
    const value = row.parent_package_id
      ? resolvePackage(String(row.parent_package_id), visiting)
      : row.project_task_id
        ? resolveTask(String(row.project_task_id))
        : null
    visiting.delete(id)
    packageMemo.set(id, value)
    return value
  }

  const taskParentIds = new Set(
    taskRows.map((row) => row.parent_id && String(row.parent_id)).filter(Boolean)
  )
  const packageParentIds = new Set(
    packageRows.map((row) => row.parent_package_id && String(row.parent_package_id)).filter(Boolean)
  )
  const taskIdsWithPackages = new Set(
    packageRows.map((row) => row.project_task_id && String(row.project_task_id)).filter(Boolean)
  )

  const activities: Activity[] = []
  for (const row of taskRows) {
    const id = String(row.id)
    if (
      resolveTask(id) !== contractorId ||
      taskParentIds.has(id) ||
      taskIdsWithPackages.has(id)
    ) {
      continue
    }
    activities.push({
      entityType: 'task',
      entityId: id,
      wbs: row.wbs_code ? String(row.wbs_code) : null,
      title: String(row.name ?? ''),
      estimatedQty: 0,
      qtyKind: row.quantity_certainty === 'قطعی' ? 'قطعی' : 'حدودی',
      uom: 'm',
      unitPrice: Number(row.unit_price) || 0,
      progressPercent: 0,
    })
  }
  for (const row of packageRows) {
    const id = String(row.id)
    if (resolvePackage(id) !== contractorId || packageParentIds.has(id)) continue
    activities.push({
      entityType: 'package',
      entityId: id,
      wbs: row.wbs_code ? String(row.wbs_code) : null,
      title: String(row.name ?? ''),
      estimatedQty: Number(row.quantity) || 0,
      qtyKind: row.quantity_certainty === 'قطعی' ? 'قطعی' : 'حدودی',
      uom: String(row.uom ?? 'm'),
      unitPrice: Number(row.unit_price) || 0,
      progressPercent: 0,
    })
  }

  const { data: statements, error: statementError } = await supabase
    .from('contractor_activity_statements')
    .select('entity_type,entity_id,estimated_qty,qty_kind,uom,unit_price,progress_percent')
    .eq('project_id', projectId)
    .eq('subcontractor_id', contractorId)
  if (statementError) {
    if (
      statementError.code === '42P01' ||
      statementError.message.includes('contractor_activity_statements')
    ) {
      return activities.sort((a, b) =>
        (a.wbs ?? '').localeCompare(b.wbs ?? '', 'fa', { numeric: true })
      )
    }
    throw new WorkshopError('VALIDATION', statementError.message)
  }
  const statementByEntity = new Map(
    (statements ?? []).map((row) => [`${row.entity_type}:${row.entity_id}`, row])
  )
  return activities
    .map((activity) => {
      const saved = statementByEntity.get(`${activity.entityType}:${activity.entityId}`)
      return saved
        ? {
            ...activity,
            estimatedQty: Number(saved.estimated_qty) || 0,
            qtyKind: saved.qty_kind === 'قطعی' ? ('قطعی' as const) : ('حدودی' as const),
            uom: String(saved.uom ?? activity.uom),
            unitPrice: activity.unitPrice,
            progressPercent: Number(saved.progress_percent) || 0,
          }
        : activity
    })
    .sort((a, b) => (a.wbs ?? '').localeCompare(b.wbs ?? '', 'fa', { numeric: true }))
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    const contractorId = request.nextUrl.searchParams.get('contractorId') ?? ''
    if (!projectId || !contractorId) {
      throw new WorkshopError('VALIDATION', 'projectId و contractorId لازم است')
    }
    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const activities = await loadActivities(supabase, projectId, contractorId)
    return NextResponse.json({ activities })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const contractorId = String(body.contractorId ?? '')
    const entityType = body.entityType === 'package' ? 'package' : 'task'
    const entityId = String(body.entityId ?? '')
    const estimatedQty = Number(body.estimatedQty)
    const unitPrice = Number(body.unitPrice)
    const progressPercent = Number(body.progressPercent)
    const qtyKind = body.qtyKind === 'قطعی' ? 'قطعی' : 'حدودی'
    const uom = String(body.uom ?? '').trim()
    if (!projectId || !contractorId || !entityId || !uom) {
      throw new WorkshopError('VALIDATION', 'اطلاعات فعالیت کامل نیست')
    }
    if (
      !Number.isFinite(estimatedQty) ||
      estimatedQty < 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isFinite(progressPercent) ||
      progressPercent < 0 ||
      progressPercent > 100
    ) {
      throw new WorkshopError('VALIDATION', 'مقادیر عددی فرم نامعتبر است')
    }
    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const capabilities = await getWorkshopCapabilities(supabase, projectId)
    if (!capabilities.canWrite) {
      throw new WorkshopError('FORBIDDEN', 'اجازه ویرایش صورت‌وضعیت فعالیت را ندارید')
    }
    const assigned = await loadActivities(supabase, projectId, contractorId)
    if (!assigned.some((row) => row.entityType === entityType && row.entityId === entityId)) {
      throw new WorkshopError('VALIDATION', 'این فعالیت به پیمانکار انتخاب‌شده تخصیص ندارد')
    }
    const entityTable = entityType === 'package' ? 'workshop_packages' : 'project_tasks'
    const { error: entityPriceError } = await supabase
      .from(entityTable)
      .update({ unit_price: unitPrice })
      .eq('id', entityId)
      .eq('project_id', projectId)
    if (entityPriceError) throw new WorkshopError('VALIDATION', entityPriceError.message)
    const { error } = await supabase.from('contractor_activity_statements').upsert(
      {
        project_id: projectId,
        subcontractor_id: contractorId,
        entity_type: entityType,
        entity_id: entityId,
        estimated_qty: estimatedQty,
        qty_kind: qtyKind,
        uom,
        unit_price: unitPrice,
        progress_percent: progressPercent,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,subcontractor_id,entity_type,entity_id' }
    )
    if (error) {
      throw new WorkshopError(
        'VALIDATION',
        error.code === '42P01' || error.message.includes('contractor_activity_statements')
          ? 'برای ذخیره فرم، migration شماره 86 را در Supabase اجرا کنید'
          : error.message
      )
    }
    const activities = await loadActivities(supabase, projectId, contractorId)
    return NextResponse.json({ activities })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
