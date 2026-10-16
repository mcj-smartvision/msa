/**
 * @file app/(dashboard)/admin/projects/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/hooks/use-supabase, features/admin/services/admin, features/admin/lib/control-center, features/admin/lib/projects-ops, features/admin/components/shared, features/admin/components/projects-control/control-chrome, features/admin/components/projects-control/project-row, features/admin/components/activity-feed, shared/components/ui/button, features/account/lib/open-account-page
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
Cpu,
Plus,
Radio,
ServerCrash,
ShieldAlert,
UserX,
Users,
} from 'lucide-react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { fetchAdminProjects, fetchAllMembers } from '@/features/admin/services/admin'
import { fetchControlCenterFeeds } from '@/features/admin/lib/control-center'
import {
countIdleUsers,
countLiveSessions,
fetchAdminOpsMetrics,
} from '@/features/admin/lib/projects-ops'
import { LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import { ControlKpiCard, ProjectsControlHeader } from '@/features/admin/components/projects-control/control-chrome'
import {
EmptyProjectsState,
ProjectRow,
} from '@/features/admin/components/projects-control/project-row'
import { ActivityFeed } from '@/features/admin/components/activity-feed'
import { Button } from '@/shared/components/ui/button'
import { openProjectDirectory } from '@/features/account/lib/open-account-page'
import { sortProjectsRecent } from '@/features/admin/components/project-directory-table'
import { ADMIN_COPY, ADMIN_CONTROL_CENTER_COPY as cc } from '@/features/admin/config'
import type {
AdminOpsMetrics,
AdminProject,
AuthActivityUser,
ControlCenterFeeds,
ProjectMember,
} from '@/shared/types/admin'

const IDLE_DAYS_KEY = 'liparta.admin.idleDays'
const EMPTY_FEEDS: ControlCenterFeeds = {
  activities: [],
  presenceUsers: [],
  insideCount: 0,
  outsideCount: 0,
  absentCount: 0,
  tickets: [],
  alerts: [],
  openMessageCount: 0,
  lastActivityByProjectId: {},
  sparkline: {
    people: [0, 0, 0, 0, 0, 0, 0],
    active: [0, 0, 0, 0, 0, 0, 0],
    onSite: [0, 0, 0, 0, 0, 0, 0],
    attention: [0, 0, 0, 0, 0, 0, 0],
  },
}

function readIdleDays(): number {
  if (typeof window === 'undefined') return 14
  const raw = Number(window.localStorage.getItem(IDLE_DAYS_KEY))
  return Number.isFinite(raw) && raw >= 1 && raw <= 365 ? raw : 14
}

function ownerLabel(project: AdminProject): string | null {
  const parts = [project.client_name, project.contractor_name].filter(Boolean) as string[]
  return parts.length ? parts.join(' · ') : null
}

export default function AdminProjectsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [feeds, setFeeds] = useState<ControlCenterFeeds>(EMPTY_FEEDS)
  const [ops, setOps] = useState<AdminOpsMetrics | null>(null)
  const [authUsers, setAuthUsers] = useState<AuthActivityUser[]>([])
  const [idleDays, setIdleDays] = useState(14)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setIdleDays(readIdleDays())
  }, [])

  const loadProjects = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode !== 'refresh') setLoading(true)
      setError(null)
      try {
        const [projectData, memberData] = await Promise.race([
          Promise.all([fetchAdminProjects(supabase), fetchAllMembers(supabase)]),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    ADMIN_COPY.loadTimeout
                  )
                ),
              ADMIN_COPY.loadTimeoutMs
            )
          ),
        ])

        const [feedData, opsData, authRes] = await Promise.all([
          fetchControlCenterFeeds(supabase, memberData),
          fetchAdminOpsMetrics(supabase),
          fetch('/api/admin/auth-activity')
            .then(async (res) => {
              if (!res.ok) return { users: [] as AuthActivityUser[] }
              return (await res.json()) as { users?: AuthActivityUser[] }
            })
            .catch(() => ({ users: [] as AuthActivityUser[] })),
        ])

        setProjects(projectData)
        setMembers(memberData)
        setFeeds(feedData)
        setOps(opsData)
        setAuthUsers(authRes.users ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : ADMIN_COPY.loadProjectsFailed)
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  useEffect(() => {
    void loadProjects('initial')
  }, [loadProjects])

  const memberCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const member of members) {
      map.set(member.project_id, (map.get(member.project_id) ?? 0) + 1)
    }
    return map
  }, [members])

  const kpis = useMemo(() => {
    const uniqueActive = new Set(
      members.filter((m) => m.is_active).map((m) => m.user_id)
    ).size
    const pending = new Set(
      members.filter((m) => !m.password_changed_by_member).map((m) => m.user_id)
    ).size
    const liveFromAuth = countLiveSessions(members, authUsers)
    const live = liveFromAuth > 0 ? liveFromAuth : feeds.insideCount
    return {
      activeUsers: uniqueActive,
      pendingApprovals: pending,
      liveSessions: live,
      onSiteNow: feeds.insideCount,
      idleUsers: countIdleUsers(members, authUsers, idleDays),
      failedJobs24h: ops?.failedJobs24h ?? 0,
      activeProjects: ops?.activeProjects ?? projects.filter((p) => p.is_active).length,
      aiActionsThisMonth: ops?.aiActionsThisMonth ?? 0,
      securityEvents24h: ops?.securityEvents24h ?? 0,
    }
  }, [members, authUsers, idleDays, feeds.insideCount, ops, projects])

  const recentProjects = useMemo(() => sortProjectsRecent(projects).slice(0, 3), [projects])

  function handleIdleDaysChange(value: string) {
    const next = Number(value)
    if (!Number.isFinite(next) || next < 1 || next > 365) return
    setIdleDays(next)
    window.localStorage.setItem(IDLE_DAYS_KEY, String(next))
  }

  if (loading) return <LoadingBlock label={ADMIN_COPY.loadingProjects} />
  if (error && projects.length === 0) {
    return <ErrorBlock message={error} onRetry={() => void loadProjects('initial')} />
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 rounded-lg p-1 sm:p-0">
      <ProjectsControlHeader
        eyebrow={cc.eyebrow}
        title={cc.title}
        description={cc.description}
        actions={
          <>
            <Button
              asChild
              className="h-8 border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Link href="/admin/projects/initialize">{cc.advancedInit}</Link>
            </Button>
            <Button
              asChild
              className="h-8 border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Link href="/admin/projects/new">
                <Plus className="h-4 w-4" />
                {cc.newProject}
              </Link>
            </Button>
          </>
        }
      />

      {error ? <ErrorBlock message={error} onRetry={() => void loadProjects('refresh')} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ControlKpiCard
          label={cc.kpis.users}
          value={`${kpis.activeUsers} / ${kpis.pendingApprovals}`}
          hint={cc.kpis.usersHint(kpis.pendingApprovals)}
          icon={Users}
          tone="success"
          help={cc.kpis.usersHelp}
        />
        <ControlKpiCard
          label={cc.kpis.live}
          value={kpis.liveSessions}
          hint={cc.kpis.liveHint(kpis.onSiteNow)}
          icon={Radio}
          tone="info"
          help={cc.kpis.liveHelp}
        />
        <ControlKpiCard
          label={cc.kpis.idle}
          value={kpis.idleUsers}
          hint={cc.kpis.idleHint(idleDays)}
          icon={UserX}
          tone={kpis.idleUsers > 0 ? 'warning' : 'neutral'}
          help={cc.kpis.idleHelp}
          extra={
            <label className="flex items-center gap-2 text-[11px] text-[#667085]">
              {cc.kpis.threshold}
              <input
                type="number"
                min={1}
                max={365}
                value={idleDays}
                onChange={(e) => handleIdleDaysChange(e.target.value)}
                className="h-7 w-16 rounded border border-[#E4E7EC] bg-white px-1.5 text-[12px] tabular-nums"
                aria-label={cc.kpis.idleAria}
              />
              {cc.kpis.days}
            </label>
          }
        />
        <ControlKpiCard
          label={cc.kpis.failedJobs}
          value={kpis.failedJobs24h}
          hint={cc.kpis.failedJobsHint}
          icon={ServerCrash}
          tone={kpis.failedJobs24h > 0 ? 'warning' : 'neutral'}
          help={cc.kpis.failedJobsHelp}
        />
        <ControlKpiCard
          label={cc.kpis.plan}
          value={`${kpis.activeProjects} / ${kpis.aiActionsThisMonth}`}
          hint={cc.kpis.planHint}
          icon={Cpu}
          tone="info"
          help={cc.kpis.planHelp}
        />
        <ControlKpiCard
          label={cc.kpis.security}
          value={kpis.securityEvents24h}
          hint={cc.kpis.securityHint}
          icon={ShieldAlert}
          tone={kpis.securityEvents24h > 0 ? 'warning' : 'neutral'}
          help={cc.kpis.securityHelp}
        />
      </div>

      <section className="rounded-lg border border-[#E4E7EC] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E4E7EC] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#17202A]">{cc.recentActivity}</h2>
          <p className="text-[11px] text-[#667085] mt-0.5">
            {cc.recentActivityHint}
          </p>
        </div>
        <div className="p-4 max-h-[360px] overflow-y-auto">
          <ActivityFeed activities={feeds.activities} />
        </div>
      </section>

      <section className="rounded-[12px] border border-[#5a7088] bg-white px-4 py-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openProjectDirectory()}
            className="h-10 rounded-[10px] bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {cc.projectDirectory}
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="mt-5">
            <EmptyProjectsState onCreate={() => router.push('/admin/projects/new')} />
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {recentProjects.map((project, index) => (
              <ProjectRow
                key={project.id}
                index={index + 1}
                project={project}
                memberCount={memberCountByProject.get(project.id) ?? 0}
                ownerLabel={ownerLabel(project)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
