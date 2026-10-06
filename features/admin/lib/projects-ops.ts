import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminOpsMetrics, AuthActivityUser, ProjectMember } from '@/shared/types/admin';

const LIVE_SESSION_MS = 30 * 60 * 1000

function isUnavailable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === '42501' ||
    error.code === 'PGRST301' ||
    /permission denied|not found/i.test(error.message ?? '')
  )
}

function sinceHours(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function countRows(
  query: PromiseLike<{ count: number | null; error: { code?: string; message?: string } | null }>
): Promise<number> {
  const { count, error } = await query
  if (error && !isUnavailable(error)) throw new Error(error.message)
  return error ? 0 : count ?? 0
}

export function countIdleUsers(
  members: ProjectMember[],
  authUsers: AuthActivityUser[],
  idleDays: number
): number {
  const days = Number.isFinite(idleDays) && idleDays > 0 ? idleDays : 14
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const byId = new Map(authUsers.map((u) => [u.id, u]))
  const seen = new Set<string>()
  let idle = 0
  for (const member of members) {
    if (seen.has(member.user_id)) continue
    seen.add(member.user_id)
    const auth = byId.get(member.user_id)
    const last = auth?.lastSignInAt || member.joined_at || member.invited_at || auth?.createdAt
    const t = last ? new Date(last).getTime() : 0
    if (!t || t < cutoff) idle += 1
  }
  return idle
}

export function countLiveSessions(members: ProjectMember[], authUsers: AuthActivityUser[]): number {
  const cutoff = Date.now() - LIVE_SESSION_MS
  const byId = new Map(authUsers.map((u) => [u.id, u]))
  const seen = new Set<string>()
  let live = 0
  for (const member of members) {
    if (seen.has(member.user_id)) continue
    seen.add(member.user_id)
    const at = byId.get(member.user_id)?.lastSignInAt
    if (at && new Date(at).getTime() >= cutoff) live += 1
  }
  return live
}

export async function fetchAdminOpsMetrics(supabase: SupabaseClient): Promise<AdminOpsMetrics> {
  const since24h = sinceHours(24)
  const monthStart = startOfMonthIso()

  const [
    activeProjects,
    aiActionsThisMonth,
    failedImports,
    failedEmails,
    failedVision,
    failedGateId,
    auditLogs,
  ] = await Promise.all([
    countRows(
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ),
    countRows(
      supabase
        .from('ai_actions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart)
    ),
    countRows(
      supabase
        .from('schedule_imports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since24h)
    ),
    countRows(
      supabase
        .from('attendance_email_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since24h)
    ),
    countRows(
      supabase
        .from('vision_analysis')
        .select('id', { count: 'exact', head: true })
        .eq('analysis_status', 'failed')
        .gte('created_at', since24h)
    ),
    countRows(
      supabase
        .from('attendance_transits')
        .select('id', { count: 'exact', head: true })
        .neq('identification_status', 'success')
        .gte('occurred_at', since24h)
    ),
    countRows(
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since24h)
    ),
  ])

  return {
    activeUsers: 0,
    pendingApprovals: 0,
    liveSessions: 0,
    onSiteNow: 0,
    failedJobs24h: failedImports + failedEmails + failedVision,
    activeProjects,
    aiActionsThisMonth,
    securityEvents24h: failedGateId + auditLogs,
  }
}
