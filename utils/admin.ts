import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminProject,
  AdminStats,
  CreateMemberInput,
  CreatePositionInput,
  CreateProjectInput,
  DashboardWidget,
  EventType,
  NotificationRoute,
  NotificationRouteInput,
  Position,
  PositionDashboardWidget,
  ProjectMember,
  UpdateMemberInput,
  WidgetVisibilityInput,
} from '@/types/admin'
import { slugifyKey } from '@/lib/admin/access'

export async function fetchAdminStats(supabase: SupabaseClient): Promise<AdminStats> {
  const [projects, members, positions, routes, activeMembers, pendingLogin] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('project_members').select('id', { count: 'exact', head: true }),
    supabase.from('positions').select('id', { count: 'exact', head: true }),
    supabase.from('notification_routes').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('project_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('project_members').select('id', { count: 'exact', head: true }).eq('password_changed_by_member', false),
  ])

  if (projects.error) throw new Error(projects.error.message)
  if (members.error) throw new Error(members.error.message)
  if (positions.error) throw new Error(positions.error.message)
  if (routes.error) throw new Error(routes.error.message)

  const allMembers = await fetchAllMembers(supabase)
  const roleMap = new Map<string, number>()
  for (const member of allMembers) {
    for (const pos of member.positions ?? []) {
      roleMap.set(pos.title, (roleMap.get(pos.title) ?? 0) + 1)
    }
  }

  return {
    projectCount: projects.count ?? 0,
    memberCount: members.count ?? 0,
    positionCount: positions.count ?? 0,
    activeRouteCount: routes.count ?? 0,
    activeMemberCount: activeMembers.count ?? 0,
    pendingFirstLoginCount: pendingLogin.count ?? 0,
    roleBreakdown: Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  }
}

export async function fetchAllMembers(supabase: SupabaseClient): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('v_project_members_with_positions')
    .select('*')
    .order('full_name')

  if (error) throw new Error(error.message)
  return (data ?? []) as ProjectMember[]
}

export async function fetchAdminProjects(supabase: SupabaseClient): Promise<AdminProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AdminProject[]
}

function buildUniqueProjectCode(name: string, explicit?: string) {
  const trimmed = explicit?.trim()
  if (trimmed) return trimmed
  const base = slugifyKey(name) || 'project'
  return `${base}_${Date.now().toString(36).slice(-6)}`
}

export async function createProject(
  supabase: SupabaseClient,
  input: CreateProjectInput
): Promise<AdminProject> {
  const address = input.address?.trim() || ''
  const location = input.location?.trim() || address.slice(0, 255) || null
  const projectCode = buildUniqueProjectCode(input.name, input.code)
  const notes = [
    input.description?.trim(),
    input.project_manager_name?.trim() ? `مدیر پروژه: ${input.project_manager_name.trim()}` : '',
    address ? `آدرس: ${address}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const basePayload = {
    name: input.name.trim(),
    code: projectCode,
    description: notes || null,
    location,
    client_name: input.client_name?.trim() || null,
    contractor_name: input.contractor_name?.trim() || null,
    status: input.status || 'planning',
    is_active: input.is_active ?? true,
    start_date: input.start_date || new Date().toISOString().slice(0, 10),
    end_date: input.end_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  }

  const extendedPayload = {
    ...basePayload,
    description: input.description?.trim() || null,
    address: address || null,
    project_manager_name: input.project_manager_name?.trim() || null,
  }

  let data: AdminProject | null = null
  let error: { message: string } | null = null

  ;({ data, error } = await supabase.from('projects').insert(extendedPayload).select().single())
  if (error && isMissingProjectColumnError(error.message)) {
    ;({ data, error } = await supabase.from('projects').insert(basePayload).select().single())
  }

  if (error) throw new Error(formatProjectCreateError(error.message))
  if (!data) throw new Error('ذخیره پروژه ناموفق بود')

  try {
    await seedDefaultPositions(supabase, data.id)
  } catch (seedError) {
    console.error('seedDefaultPositions failed', seedError)
  }

  return data as AdminProject
}

function isMissingProjectColumnError(message: string) {
  return /column.*does not exist|Could not find the '.*' column/i.test(message)
}

function formatProjectCreateError(message: string) {
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت یا وضعیت Supabase را بررسی کنید.'
  }
  return message
}

async function seedDefaultPositions(supabase: SupabaseClient, projectId: string): Promise<number> {
  return seedProjectPositions(supabase, projectId)
}

/** Idempotent seed of default construction site positions for a project. */
export async function seedProjectPositions(
  supabase: SupabaseClient,
  projectId: string
): Promise<number> {
  const { getSeedPositionRows } = await import('@/lib/i18n/position-labels')
  const rows = getSeedPositionRows(projectId)

  for (const row of rows) {
    const { error } = await supabase.from('positions').upsert(row, {
      onConflict: 'project_id,key',
      ignoreDuplicates: true,
    })
    if (error) {
      const { name_en, name_fa, name_fr, name_de, ...fallback } = row
      const { error: fallbackError } = await supabase.from('positions').upsert(fallback, {
        onConflict: 'project_id,key',
        ignoreDuplicates: true,
      })
      if (fallbackError) throw new Error(fallbackError.message)
    }
  }

  // Refresh HSE labels so older projects show «مسئول ایمنی» in member role dropdowns.
  const hseRow = rows.find((row) => row.key === 'hse_officer')
  if (hseRow) {
    await supabase
      .from('positions')
      .update({
        title: hseRow.title,
        name_en: hseRow.name_en,
        name_fa: hseRow.name_fa,
        name_fr: hseRow.name_fr,
        name_de: hseRow.name_de,
        description: hseRow.description,
        is_active: true,
      })
      .eq('project_id', projectId)
      .eq('key', 'hse_officer')
  }

  const positions = await fetchPositions(supabase, projectId)
  return positions.length
}

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  input: Partial<CreateProjectInput>
): Promise<AdminProject> {
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as AdminProject
}

export async function fetchProjectMembers(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('v_project_members_with_positions')
    .select('*')
    .eq('project_id', projectId)
    .order('full_name')

  if (error) throw new Error(error.message)
  return (data ?? []) as ProjectMember[]
}

export async function fetchProjectMember(
  supabase: SupabaseClient,
  memberId: string
): Promise<ProjectMember | null> {
  const { data, error } = await supabase
    .from('v_project_members_with_positions')
    .select('*')
    .eq('id', memberId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as ProjectMember) ?? null
}

export async function fetchPositions(
  supabase: SupabaseClient,
  projectId: string
): Promise<Position[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('project_id', projectId)
    .order('title')

  if (error) throw new Error(error.message)
  return (data ?? []) as Position[]
}

export async function createPosition(
  supabase: SupabaseClient,
  projectId: string,
  input: CreatePositionInput
): Promise<Position> {
  const { data, error } = await supabase
    .from('positions')
    .insert({
      project_id: projectId,
      title: input.title,
      key: input.key,
      description: input.description || null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Position
}

export async function updatePosition(
  supabase: SupabaseClient,
  positionId: string,
  input: Partial<CreatePositionInput>
): Promise<Position> {
  const { data, error } = await supabase
    .from('positions')
    .update(input)
    .eq('id', positionId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Position
}

async function syncMemberPositions(
  supabase: SupabaseClient,
  memberId: string,
  positionIds: string[],
  assignedBy?: string
) {
  const { error: deleteError } = await supabase
    .from('member_positions')
    .delete()
    .eq('project_member_id', memberId)

  if (deleteError) throw new Error(deleteError.message)

  if (positionIds.length === 0) return

  const { error } = await supabase.from('member_positions').insert(
    positionIds.map((positionId) => ({
      project_member_id: memberId,
      position_id: positionId,
      assigned_by: assignedBy ?? null,
    }))
  )

  if (error) throw new Error(error.message)
}

export async function createProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  input: CreateMemberInput,
  assignedBy?: string
): Promise<ProjectMember> {
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: userId,
      email: input.email.trim().toLowerCase(),
      full_name: input.full_name.trim(),
      phone: input.phone || null,
      is_active: input.is_active ?? true,
      admin_visible_password: input.password,
      password_changed_by_member: false,
      invited_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await syncMemberPositions(supabase, data.id, input.position_ids, assignedBy)

  const member = await fetchProjectMember(supabase, data.id)
  if (!member) throw new Error('Failed to load created member')
  return member
}

export async function updateProjectMember(
  supabase: SupabaseClient,
  memberId: string,
  input: UpdateMemberInput,
  assignedBy?: string
): Promise<ProjectMember> {
  const payload: Record<string, unknown> = {}
  if (input.full_name !== undefined) payload.full_name = input.full_name.trim()
  if (input.email !== undefined) payload.email = input.email.trim().toLowerCase()
  if (input.phone !== undefined) payload.phone = input.phone || null
  if (input.is_active !== undefined) payload.is_active = input.is_active
  if (input.password) {
    payload.admin_visible_password = input.password
    payload.password_changed_by_member = false
  }

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase.from('project_members').update(payload).eq('id', memberId)
    if (error) throw new Error(error.message)
  }

  if (input.position_ids) {
    await syncMemberPositions(supabase, memberId, input.position_ids, assignedBy)
  }

  const member = await fetchProjectMember(supabase, memberId)
  if (!member) throw new Error('Member not found')

  if (input.email || input.full_name || input.phone !== undefined) {
    const profileUpdate: Record<string, unknown> = {}
    if (input.email) profileUpdate.email = input.email.trim().toLowerCase()
    if (input.full_name) profileUpdate.full_name = input.full_name.trim()
    if (input.phone !== undefined) profileUpdate.phone = input.phone || null

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', member.user_id)

    if (profileError) throw new Error(profileError.message)
  }

  return member
}

export async function fetchEventTypes(supabase: SupabaseClient): Promise<EventType[]> {
  const { data, error } = await supabase
    .from('event_types')
    .select('*')
    .eq('is_active', true)
    .order('title')

  if (error) throw new Error(error.message)
  return (data ?? []) as EventType[]
}

export async function fetchNotificationRoutes(
  supabase: SupabaseClient,
  projectId: string
): Promise<NotificationRoute[]> {
  const { data, error } = await supabase
    .from('notification_routes')
    .select('*, event_type:event_types(*), position:positions(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as NotificationRoute[]
}

export async function upsertNotificationRoute(
  supabase: SupabaseClient,
  projectId: string,
  input: NotificationRouteInput
): Promise<void> {
  const { error } = await supabase.from('notification_routes').upsert(
    {
      project_id: projectId,
      event_type_id: input.event_type_id,
      position_id: input.position_id,
      email_enabled: input.email_enabled,
      is_active: input.is_active ?? true,
    },
    { onConflict: 'project_id,event_type_id,position_id' }
  )

  if (error) throw new Error(error.message)
}

export async function deleteNotificationRoute(
  supabase: SupabaseClient,
  routeId: string
): Promise<void> {
  const { error } = await supabase.from('notification_routes').delete().eq('id', routeId)
  if (error) throw new Error(error.message)
}

export async function fetchDashboardWidgets(
  supabase: SupabaseClient
): Promise<DashboardWidget[]> {
  const { data, error } = await supabase
    .from('dashboard_widgets')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw new Error(error.message)
  return (data ?? []) as DashboardWidget[]
}

export async function fetchPositionWidgets(
  supabase: SupabaseClient,
  projectId: string
): Promise<PositionDashboardWidget[]> {
  const { data: positions, error: positionsError } = await supabase
    .from('positions')
    .select('id')
    .eq('project_id', projectId)

  if (positionsError) throw new Error(positionsError.message)

  const positionIds = (positions ?? []).map((position) => position.id)
  if (positionIds.length === 0) return []

  const { data, error } = await supabase
    .from('position_dashboard_widgets')
    .select('*, widget:dashboard_widgets(*)')
    .in('position_id', positionIds)

  if (error) throw new Error(error.message)
  return (data ?? []) as PositionDashboardWidget[]
}

export async function upsertWidgetVisibility(
  supabase: SupabaseClient,
  input: WidgetVisibilityInput
): Promise<void> {
  const { error } = await supabase.from('position_dashboard_widgets').upsert(
    {
      position_id: input.position_id,
      widget_id: input.widget_id,
      is_visible: input.is_visible,
      sort_order: input.sort_order ?? 0,
    },
    { onConflict: 'position_id,widget_id' }
  )

  if (error) throw new Error(error.message)
}

export async function findProfileByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; email: string; full_name: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}
