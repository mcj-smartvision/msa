import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { WorkshopError } from '@/lib/workshop/domain'
import { getWorkshopCapabilities, workshopErrorResponse } from '@/lib/workshop/service'

type TaskContractorRow = {
  id: string
  parent_id: string | null
  subcontractor_id: string | null
}

function resolveAssignments(rows: TaskContractorRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const memo = new Map<string, string | null>()

  function resolve(id: string, visiting = new Set<string>()): string | null {
    if (memo.has(id)) return memo.get(id) ?? null
    const row = byId.get(id)
    if (!row || visiting.has(id)) return row?.subcontractor_id ?? null
    if (row.subcontractor_id) {
      memo.set(id, row.subcontractor_id)
      return row.subcontractor_id
    }
    visiting.add(id)
    const inherited = row.parent_id ? resolve(row.parent_id, visiting) : null
    visiting.delete(id)
    memo.set(id, inherited)
    return inherited
  }

  return rows.map((row) => ({
    id: row.id,
    subcontractor_id: row.subcontractor_id,
    resolved_subcontractor_id: resolve(row.id),
  }))
}

function migrationMessage(message: string): string {
  return /resolved_subcontractor_id|subcontractor_id|project_subcontractors/i.test(message)
    ? 'ابتدا migration شماره 83 تخصیص پیمانکار را در Supabase اجرا کنید.'
    : message
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const [{ data: contractors, error: contractorsError }, { data: tasks, error: tasksError }] =
      await Promise.all([
        supabase
          .from('project_subcontractors')
          .select('id, name, is_active')
          .eq('project_id', projectId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('project_tasks')
          .select('id, parent_id, subcontractor_id')
          .eq('project_id', projectId),
      ])

    if (contractorsError) {
      throw new WorkshopError('VALIDATION', migrationMessage(contractorsError.message))
    }
    if (tasksError) {
      throw new WorkshopError('VALIDATION', migrationMessage(tasksError.message))
    }

    return NextResponse.json(
      {
        contractors: contractors ?? [],
        assignments: resolveAssignments((tasks ?? []) as TaskContractorRow[]),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const taskIds = Array.isArray(body.taskIds)
      ? [...new Set(body.taskIds.map((id: unknown) => String(id)).filter(Boolean))]
      : []
    const contractorId =
      body.contractorId === null || body.contractorId === '' ? null : String(body.contractorId ?? '')

    if (!projectId || taskIds.length === 0) {
      return NextResponse.json({ error: 'projectId و taskIds لازم است' }, { status: 400 })
    }
    if (taskIds.length > 500) {
      return NextResponse.json({ error: 'حداکثر ۵۰۰ فعالیت را هم‌زمان انتخاب کنید' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const capabilities = await getWorkshopCapabilities(supabase, projectId)
    if (!capabilities.canWrite) {
      throw new WorkshopError('FORBIDDEN', 'اجازه ویرایش برنامه را ندارید')
    }

    if (contractorId) {
      const { data: contractor, error } = await supabase
        .from('project_subcontractors')
        .select('id')
        .eq('id', contractorId)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .maybeSingle()
      if (error) throw new WorkshopError('VALIDATION', migrationMessage(error.message))
      if (!contractor) throw new WorkshopError('VALIDATION', 'پیمانکار متعلق به این پروژه نیست')
    }

    const { data: existing, error: existingError } = await supabase
      .from('project_tasks')
      .select('id')
      .eq('project_id', projectId)
      .in('id', taskIds)
    if (existingError) throw new WorkshopError('VALIDATION', existingError.message)
    if ((existing ?? []).length !== taskIds.length) {
      throw new WorkshopError('VALIDATION', 'یک یا چند فعالیت متعلق به این پروژه نیست')
    }

    const { error: updateError } = await supabase
      .from('project_tasks')
      .update({ subcontractor_id: contractorId })
      .eq('project_id', projectId)
      .in('id', taskIds)
    if (updateError) {
      throw new WorkshopError('VALIDATION', migrationMessage(updateError.message))
    }

    const { data: tasks, error: reloadError } = await supabase
      .from('project_tasks')
      .select('id, parent_id, subcontractor_id')
      .eq('project_id', projectId)
    if (reloadError) throw new WorkshopError('VALIDATION', migrationMessage(reloadError.message))

    return NextResponse.json({
      assignments: resolveAssignments((tasks ?? []) as TaskContractorRow[]),
    })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
