import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPresence } from '@/lib/attendance/domain'
import type { AttendanceTransit, TransitDirection } from '@/lib/attendance/types'
import type {
  AdminActivityItem,
  AdminCriticalAlert,
  AdminSupportTicket,
  ControlCenterFeeds,
  OnlineUser,
  ProjectMember,
} from '@/types/admin'

function startOfLocalDayIso(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return 'just now'
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatExactFa(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })
}

function inProject(name?: string | null): string {
  return name ? ` در پروژه ${name}` : ''
}

function formatDurationAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return 'now'
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === '42703'
}

function isSkippableQuery(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (isMissingTable(error)) return true
  return error.code === '42501' || error.code === 'PGRST301'
}

function primaryRole(member: ProjectMember | undefined): string {
  return member?.positions?.[0]?.title ?? '—'
}

function alertSourceLabel(alertType: string): string {
  const map: Record<string, string> = {
    start_activity: 'Planning',
    delay_risk: 'Planning',
    material_purchase: 'Inventory',
    milestone_risk: 'Planning',
    critical_path: 'Planning',
    general: 'Ops',
  }
  return map[alertType] ?? 'Ops'
}

function mapAlertSeverity(severity: string): AdminCriticalAlert['severity'] {
  if (severity === 'critical') return 'critical'
  if (severity === 'warning') return 'high'
  return 'medium'
}

function mapMessagePriority(priority: string): AdminSupportTicket['priority'] {
  if (priority === 'urgent') return 'high'
  if (priority === 'info') return 'low'
  return 'medium'
}

function presenceToOnlineStatus(status: 'inside' | 'outside' | 'absent'): OnlineUser['status'] {
  if (status === 'inside') return 'online'
  if (status === 'outside') return 'idle'
  return 'offline'
}

function presencePageLabel(status: 'inside' | 'outside' | 'absent'): string {
  if (status === 'inside') return 'On site'
  if (status === 'outside') return 'Left site today'
  return 'Absent today'
}

async function fetchSitePresence(supabase: SupabaseClient, members: ProjectMember[]): Promise<{
  users: OnlineUser[]
  insideCount: number
  outsideCount: number
  absentCount: number
}> {
  const active = members.filter((m) => m.is_active)
  const byUser = new Map<string, ProjectMember>()
  for (const m of active) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, m)
  }

  const memberSeeds = Array.from(byUser.values()).map((m) => ({
    userId: m.user_id,
    fullName: m.full_name || m.email || 'بدون نام',
    email: m.email ?? null,
    personnelCode: m.personnel_code ?? null,
  }))

  if (memberSeeds.length === 0) {
    return { users: [], insideCount: 0, outsideCount: 0, absentCount: 0 }
  }

  const since = startOfLocalDayIso()
  const { data, error } = await supabase
    .from('attendance_transits')
    .select(
      'id, project_id, user_id, gate_id, direction, source, identification_status, person_name, occurred_at, recorded_by, notes, email_status, email_sent_at, email_error'
    )
    .gte('occurred_at', since)
    .eq('identification_status', 'success')
    .order('occurred_at', { ascending: true })
    .limit(2000)

  if (error && !isMissingTable(error)) throw new Error(error.message)

  const transits: AttendanceTransit[] = (data ?? []).map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    userId: (row.user_id as string) ?? null,
    gateId: (row.gate_id as string) ?? null,
    direction: row.direction as TransitDirection,
    source: row.source as AttendanceTransit['source'],
    identificationStatus: row.identification_status as AttendanceTransit['identificationStatus'],
    personName: (row.person_name as string) ?? null,
    personEmail: null,
    personnelCode: null,
    occurredAt: String(row.occurred_at),
    recordedBy: (row.recorded_by as string) ?? null,
    notes: (row.notes as string) ?? null,
    emailStatus: row.email_status as AttendanceTransit['emailStatus'],
    emailSentAt: (row.email_sent_at as string) ?? null,
    emailError: (row.email_error as string) ?? null,
    gateName: null,
  }))

  const presence = buildPresence(memberSeeds, transits)
  const insideCount = presence.filter((p) => p.status === 'inside').length
  const outsideCount = presence.filter((p) => p.status === 'outside').length
  const absentCount = presence.filter((p) => p.status === 'absent').length

  const rank = { inside: 0, outside: 1, absent: 2 } as const
  const users: OnlineUser[] = presence
    .slice()
    .sort((a, b) => {
      const byStatus = rank[a.status] - rank[b.status]
      if (byStatus !== 0) return byStatus
      return a.fullName.localeCompare(b.fullName, 'fa')
    })
    .map((p) => {
      const member = byUser.get(p.userId)
      return {
        id: p.userId,
        name: p.fullName,
        role: primaryRole(member),
        email: p.email ?? member?.email ?? '',
        currentPage: presencePageLabel(p.status),
        lastSeen: p.lastTransitAt ? formatTimeAgo(p.lastTransitAt) : 'No transit today',
        status: presenceToOnlineStatus(p.status),
      }
    })

  return { users, insideCount, outsideCount, absentCount }
}

async function fetchCriticalAlerts(supabase: SupabaseClient): Promise<AdminCriticalAlert[]> {
  const items: AdminCriticalAlert[] = []

  const alertsRes = await supabase
    .from('alerts')
    .select('id, message, severity, alert_type, created_at, project_id')
    .eq('is_resolved', false)
    .in('severity', ['warning', 'critical'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (alertsRes.error && !isMissingTable(alertsRes.error)) throw new Error(alertsRes.error.message)

  for (const row of alertsRes.data ?? []) {
    items.push({
      id: `alert-${row.id}`,
      title: String(row.message).slice(0, 120),
      severity: mapAlertSeverity(String(row.severity)),
      source: alertSourceLabel(String(row.alert_type)),
      time: formatDurationAgo(String(row.created_at)),
      projectId: row.project_id ? String(row.project_id) : null,
    })
  }

  const inventoryRes = await supabase
    .from('inventory_items')
    .select('id, name, current_stock, min_stock, last_updated_at, project_id')
    .limit(200)

  if (inventoryRes.error && !isMissingTable(inventoryRes.error)) {
    throw new Error(inventoryRes.error.message)
  }

  for (const row of inventoryRes.data ?? []) {
    const current = Number(row.current_stock)
    const min = Number(row.min_stock)
    if (!(min > 0) || !(current <= min)) continue
    items.push({
      id: `stock-${row.id}`,
      title: `${row.name} below reorder (${current}/${min})`,
      severity: current <= 0 ? 'critical' : 'medium',
      source: 'Inventory',
      time: formatDurationAgo((row.last_updated_at as string) ?? null),
      projectId: row.project_id ? String(row.project_id) : null,
    })
  }

  const since = startOfLocalDayIso()
  const failedRes = await supabase
    .from('attendance_transits')
    .select('id, person_name, identification_status, occurred_at, project_id')
    .gte('occurred_at', since)
    .neq('identification_status', 'success')
    .order('occurred_at', { ascending: false })
    .limit(10)

  if (failedRes.error && !isMissingTable(failedRes.error)) {
    throw new Error(failedRes.error.message)
  }

  for (const row of failedRes.data ?? []) {
    const who = row.person_name ? String(row.person_name) : 'Unknown person'
    items.push({
      id: `gate-${row.id}`,
      title: `Gate ID failed — ${who} (${row.identification_status})`,
      severity: 'high',
      source: 'Security',
      time: formatDurationAgo(String(row.occurred_at)),
      projectId: row.project_id ? String(row.project_id) : null,
    })
  }

  const severityRank = { critical: 0, high: 1, medium: 2 } as const
  return items
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 12)
}

async function fetchSupportMessages(
  supabase: SupabaseClient,
  members: ProjectMember[]
): Promise<AdminSupportTicket[]> {
  const byUser = new Map(members.map((m) => [m.user_id, m]))

  const { data, error } = await supabase
    .from('project_messages')
    .select('id, body, priority, topic, created_at, sender_id, project_id')
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    if (isMissingTable(error)) return []
    throw new Error(error.message)
  }

  const senderIds = Array.from(new Set((data ?? []).map((r) => String(r.sender_id))))
  const nameById = new Map<string, string>()
  for (const id of senderIds) {
    const member = byUser.get(id)
    if (member) nameById.set(id, member.full_name)
  }

  const missing = senderIds.filter((id) => !nameById.has(id))
  if (missing.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', missing)
    for (const p of profiles ?? []) {
      nameById.set(String(p.id), String(p.full_name || p.email || 'User'))
    }
  }

  return (data ?? []).map((row) => {
    const senderId = String(row.sender_id)
    const member = byUser.get(senderId)
    const priority = mapMessagePriority(String(row.priority ?? 'normal'))
    const topic = String(row.topic ?? 'general')
    return {
      id: `MSG-${String(row.id).slice(0, 8).toUpperCase()}`,
      subject: String(row.body || '(empty message)').slice(0, 100),
      user: nameById.get(senderId) ?? 'User',
      role: primaryRole(member),
      priority,
      status: priority === 'high' ? 'open' : 'in_progress',
      created: formatTimeAgo(String(row.created_at)),
      messages: 1,
      topic,
      projectId: row.project_id ? String(row.project_id) : null,
    } satisfies AdminSupportTicket
  })
}

async function fetchActivityFeed(
  supabase: SupabaseClient,
  members: ProjectMember[]
): Promise<AdminActivityItem[]> {
  const byUser = new Map(members.map((m) => [m.user_id, m]))
  const items: Array<AdminActivityItem & { sortAt: string }> = []

  const [projectsRes, alertsRes, reportsRes, transitsRes, actionsRes, messagesRes, invoicesRes] =
    await Promise.all([
      supabase.from('projects').select('id, name'),
      supabase
        .from('alerts')
        .select('id, message, severity, alert_type, created_at, project_id')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('daily_reports')
        .select(
          'id, report_date, created_at, site_supervisor_id, approved_by_manager, approved_by, project_id'
        )
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('attendance_transits')
        .select('id, user_id, person_name, direction, identification_status, occurred_at, project_id')
        .order('occurred_at', { ascending: false })
        .limit(15),
      supabase
        .from('ai_actions')
        .select('id, type, status, created_at, created_by, project_id')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('project_messages')
        .select('id, body, topic, created_at, sender_id, priority, project_id')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('financial_invoices')
        .select('id, invoice_no, status, project_id, updated_at, created_at, created_by')
        .in('status', ['approved', 'paid'])
        .order('updated_at', { ascending: false })
        .limit(10),
    ])

  for (const res of [projectsRes, alertsRes, reportsRes, transitsRes, actionsRes, messagesRes, invoicesRes]) {
    if (res.error && !isSkippableQuery(res.error)) throw new Error(res.error.message)
  }

  const projectName = new Map(
    (projectsRes.data ?? []).map((p) => [String(p.id), String(p.name)])
  )
  const pname = (projectId: unknown) => projectName.get(String(projectId ?? '')) ?? null

  for (const row of alertsRes.data ?? []) {
    const at = String(row.created_at)
    const project = pname(row.project_id)
    items.push({
      id: `act-alert-${row.id}`,
      user: 'سامانه',
      role: alertSourceLabel(String(row.alert_type)),
      action: `${String(row.message).slice(0, 100)}${inProject(project)}`,
      section: 'هشدار',
      time: formatExactFa(at),
      occurredAt: at,
      projectName: project ?? undefined,
      type: row.severity === 'critical' ? 'alert' : 'action',
      sortAt: at,
    })
  }

  for (const row of reportsRes.data ?? []) {
    const at = String(row.created_at)
    const member = row.site_supervisor_id
      ? byUser.get(String(row.site_supervisor_id))
      : undefined
    const project = pname(row.project_id)
    const approved = Boolean(row.approved_by_manager)
    items.push({
      id: `act-report-${row.id}`,
      user: member?.full_name ?? 'کاربر کارگاه',
      role: primaryRole(member),
      action: approved
        ? `گزارش روزانه را تأیید کرد${inProject(project)}`
        : `گزارش روزانه ثبت کرد${inProject(project)}`,
      section: 'گزارش روزانه',
      time: formatExactFa(at),
      occurredAt: at,
      projectName: project ?? undefined,
      type: 'action',
      sortAt: at,
    })
  }

  for (const row of transitsRes.data ?? []) {
    const at = String(row.occurred_at)
    const member = row.user_id ? byUser.get(String(row.user_id)) : undefined
    const failed = row.identification_status !== 'success'
    const who = member?.full_name || row.person_name || 'ناشناس'
    const project = pname(row.project_id)
    items.push({
      id: `act-transit-${row.id}`,
      user: String(who),
      role: primaryRole(member),
      action: failed
        ? `شناسایی گیت ناموفق بود${inProject(project)}`
        : `تردد گیت (${row.direction === 'IN' ? 'ورود' : 'خروج'}) ثبت شد${inProject(project)}`,
      section: 'امنیت',
      time: formatExactFa(at),
      occurredAt: at,
      projectName: project ?? undefined,
      type: failed ? 'security' : 'action',
      sortAt: at,
    })
  }

  for (const row of actionsRes.data ?? []) {
    const at = String(row.created_at)
    const member = row.created_by ? byUser.get(String(row.created_by)) : undefined
    const project = pname(row.project_id)
    items.push({
      id: `act-ai-${row.id}`,
      user: member?.full_name ?? 'سرپرست',
      role: primaryRole(member),
      action: `اقدام ${String(row.type).split('_').join(' ')} — ${row.status}${inProject(project)}`,
      section: 'تأییدها',
      time: formatExactFa(at),
      occurredAt: at,
      projectName: project ?? undefined,
      type: 'action',
      sortAt: at,
    })
  }

  for (const row of messagesRes.data ?? []) {
    const at = String(row.created_at)
    const member = byUser.get(String(row.sender_id))
    const project = pname(row.project_id)
    items.push({
      id: `act-msg-${row.id}`,
      user: member?.full_name ?? 'کاربر',
      role: primaryRole(member),
      action: `${String(row.body || 'پیام ارسال شد').slice(0, 80)}${inProject(project)}`,
      section: `پیام · ${row.topic ?? 'general'}`,
      time: formatExactFa(at),
      occurredAt: at,
      projectName: project ?? undefined,
      type: row.priority === 'urgent' ? 'alert' : 'action',
      sortAt: at,
    })
  }

  for (const row of invoicesRes.data ?? []) {
    const at = String(row.updated_at || row.created_at)
    const member = row.created_by ? byUser.get(String(row.created_by)) : undefined
    const project = pname(row.project_id)
    const ref = row.invoice_no ? ` ${row.invoice_no}` : ''
    items.push({
      id: `act-inv-${row.id}`,
      user: member?.full_name ?? 'کاربر مالی',
      role: primaryRole(member),
      action: `صورت‌وضعیت${ref} را تأیید کرد${inProject(project)}`,
      section: 'صورت‌وضعیت',
      time: formatExactFa(at),
      occurredAt: at,
      projectName: project ?? undefined,
      type: 'action',
      sortAt: at,
    })
  }

  return items
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
    .slice(0, 20)
    .map(({ sortAt: _sortAt, ...rest }) => rest)
}

function localDateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localDateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return localDateKeyFromDate(d)
}

function last7DateKeys(): string[] {
  const keys: string[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    keys.push(localDateKeyFromDate(d))
  }
  return keys
}

function bumpMax(map: Record<string, string>, projectId: unknown, iso: unknown) {
  const id = String(projectId ?? '')
  const at = String(iso ?? '')
  if (!id || !at) return
  const prev = map[id]
  if (!prev || at > prev) map[id] = at
}

async function fetchOverviewInsights(supabase: SupabaseClient): Promise<{
  lastActivityByProjectId: Record<string, string>
  sparkline: ControlCenterFeeds['sparkline']
}> {
  const keys = last7DateKeys()
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - 6)
  const sinceIso = since.toISOString()
  const lastActivityByProjectId: Record<string, string> = {}

  const people = keys.map(() => 0)
  const active = keys.map(() => 0)
  const onSite = keys.map(() => 0)
  const attention = keys.map(() => 0)
  const indexOf = (iso: string) => keys.indexOf(localDateKey(iso))

  const [reportsRes, transitsRes, messagesRes, alertsRes, actionsRes, membersRes, recentTransits] =
    await Promise.all([
      supabase.from('daily_reports').select('project_id, created_at').order('created_at', { ascending: false }).limit(400),
      supabase
        .from('attendance_transits')
        .select('project_id, occurred_at, identification_status, direction')
        .gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false })
        .limit(2000),
      supabase.from('project_messages').select('project_id, created_at').order('created_at', { ascending: false }).limit(400),
      supabase.from('alerts').select('project_id, created_at').order('created_at', { ascending: false }).limit(400),
      supabase.from('ai_actions').select('project_id, created_at').order('created_at', { ascending: false }).limit(400),
      supabase
        .from('project_members')
        .select('created_at, is_active, password_changed_by_member, user_id')
        .gte('created_at', sinceIso)
        .limit(2000),
      supabase
        .from('attendance_transits')
        .select('project_id, occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(400),
    ])

  for (const res of [reportsRes, transitsRes, messagesRes, alertsRes, actionsRes, membersRes, recentTransits]) {
    if (res.error && !isSkippableQuery(res.error)) throw new Error(res.error.message)
  }

  for (const row of reportsRes.data ?? []) bumpMax(lastActivityByProjectId, row.project_id, row.created_at)
  for (const row of messagesRes.data ?? []) bumpMax(lastActivityByProjectId, row.project_id, row.created_at)
  for (const row of alertsRes.data ?? []) bumpMax(lastActivityByProjectId, row.project_id, row.created_at)
  for (const row of actionsRes.data ?? []) bumpMax(lastActivityByProjectId, row.project_id, row.created_at)
  for (const row of recentTransits.data ?? []) bumpMax(lastActivityByProjectId, row.project_id, row.occurred_at)
  for (const row of transitsRes.data ?? []) bumpMax(lastActivityByProjectId, row.project_id, row.occurred_at)

  const seenPeople = new Set<string>()
  for (const row of membersRes.data ?? []) {
    const idx = indexOf(String(row.created_at))
    if (idx < 0) continue
    const uid = String(row.user_id)
    const key = `${keys[idx]}:${uid}`
    if (!seenPeople.has(key)) {
      seenPeople.add(key)
      people[idx] += 1
    }
    if (row.is_active) active[idx] += 1
    if (!row.password_changed_by_member) attention[idx] += 1
  }

  for (const row of transitsRes.data ?? []) {
    if (row.identification_status !== 'success') continue
    if (String(row.direction).toUpperCase() !== 'IN') continue
    const idx = indexOf(String(row.occurred_at))
    if (idx >= 0) onSite[idx] += 1
  }

  return {
    lastActivityByProjectId,
    sparkline: { people, active, onSite, attention },
  }
}

/** Live Control Center feeds — no demo/placeholder data. */
export async function fetchControlCenterFeeds(
  supabase: SupabaseClient,
  members: ProjectMember[]
): Promise<ControlCenterFeeds> {
  const [presence, alerts, tickets, activities, insights] = await Promise.all([
    fetchSitePresence(supabase, members),
    fetchCriticalAlerts(supabase),
    fetchSupportMessages(supabase, members),
    fetchActivityFeed(supabase, members),
    fetchOverviewInsights(supabase),
  ])

  const openMessages = tickets.filter((t) => t.status === 'open' || t.priority === 'high').length

  return {
    activities,
    presenceUsers: presence.users,
    insideCount: presence.insideCount,
    outsideCount: presence.outsideCount,
    absentCount: presence.absentCount,
    tickets,
    alerts,
    openMessageCount: openMessages,
    lastActivityByProjectId: insights.lastActivityByProjectId,
    sparkline: insights.sparkline,
  }
}
