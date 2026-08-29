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
import { useSupabase } from '@/hooks/useSupabase'
import { fetchAdminProjects, fetchAllMembers } from '@/utils/admin'
import { fetchControlCenterFeeds } from '@/lib/admin/control-center'
import {
  countIdleUsers,
  countLiveSessions,
  fetchAdminOpsMetrics,
} from '@/lib/admin/projects-ops'
import { LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import { ControlKpiCard, ProjectsControlHeader } from '@/components/admin/projects-control/control-chrome'
import {
  EmptyProjectsState,
  ProjectRow,
} from '@/components/admin/projects-control/project-row'
import { ActivityFeed } from '@/components/admin/activity-feed'
import { Button } from '@/components/ui/button'
import { openProjectDirectory } from '@/lib/account/open-account-page'
import { sortProjectsRecent } from '@/components/admin/project-directory-table'
import type {
  AdminOpsMetrics,
  AdminProject,
  AuthActivityUser,
  ControlCenterFeeds,
  ProjectMember,
} from '@/types/admin'

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
  const [successNote, setSuccessNote] = useState<string | null>(null)

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
                    'زمان بارگذاری تمام شد — اتصال Supabase را بررسی و صفحه را تازه کنید.'
                  )
                ),
              20000
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
        setError(err instanceof Error ? err.message : 'بارگذاری پروژه‌ها ناموفق بود')
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

  if (loading) return <LoadingBlock label="در حال بارگذاری مرکز کنترل پروژه‌ها..." />
  if (error && projects.length === 0) {
    return <ErrorBlock message={error} onRetry={() => void loadProjects('initial')} />
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 rounded-lg p-1 sm:p-0">
      <ProjectsControlHeader
        eyebrow="مرکز کنترل سامانه"
        title="پروژه‌ها"
        description="پایش کاربران، امنیت، منابع پلن و فهرست پروژه‌ها در سطح ادمین سیستم."
        actions={
          <>
            <Button
              asChild
              className="h-8 border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Link href="/admin/projects/initialize">راه‌اندازی پیشرفته</Link>
            </Button>
            <Button
              asChild
              className="h-8 border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Link href="/admin/projects/new">
                <Plus className="h-4 w-4" />
                پروژه جدید
              </Link>
            </Button>
          </>
        }
      />

      {successNote ? (
        <div className="rounded-lg border border-[#2E8B68]/30 bg-[#EAF6F0] px-3 py-2 text-sm text-[#2E8B68]">
          {successNote}
        </div>
      ) : null}

      {error ? <ErrorBlock message={error} onRetry={() => void loadProjects('refresh')} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ControlKpiCard
          label="کاربران فعال / در انتظار تأیید"
          value={`${kpis.activeUsers} / ${kpis.pendingApprovals}`}
          hint={`${kpis.pendingApprovals} عضو هنوز ورود اول یا تغییر رمز نکرده‌اند`}
          icon={Users}
          tone="success"
          help="کاربران فعال یعنی اعضای مجاز پروژه‌ها. در انتظار تأیید همان اعضایی است که هنوز رمز دعوت را عوض نکرده‌اند."
        />
        <ControlKpiCard
          label="نشست‌های زنده"
          value={kpis.liveSessions}
          hint={`${kpis.onSiteNow} حاضر در سایت همین حالا`}
          icon={Radio}
          tone="info"
          help="ورود موفق به سامانه در ۳۰ دقیقه اخیر. اگر ورود اخیر نباشد، تعداد حاضر در گیت نمایش داده می‌شود. نشست وب‌سوکت جداگانه‌ای در سیستم نیست."
        />
        <ControlKpiCard
          label="کاربران غیرفعال"
          value={kpis.idleUsers}
          hint={`بیش از ${idleDays} روز بدون ورود`}
          icon={UserX}
          tone={kpis.idleUsers > 0 ? 'warning' : 'neutral'}
          help="بر اساس آخرین ورود واقعی حساب (Supabase). اگر ورود ثبت نشده باشد، تاریخ عضویت ملاک است. آستانه را می‌توانید عوض کنید."
          extra={
            <label className="flex items-center gap-2 text-[11px] text-[#667085]">
              آستانه
              <input
                type="number"
                min={1}
                max={365}
                value={idleDays}
                onChange={(e) => handleIdleDaysChange(e.target.value)}
                className="h-7 w-16 rounded border border-[#E4E7EC] bg-white px-1.5 text-[12px] tabular-nums"
                aria-label="تعداد روز بی‌تحرکی"
              />
              روز
            </label>
          }
        />
        <ControlKpiCard
          label="خطاها و Job ناموفق"
          value={kpis.failedJobs24h}
          hint="۲۴ ساعت اخیر"
          icon={ServerCrash}
          tone={kpis.failedJobs24h > 0 ? 'warning' : 'neutral'}
          help="جمع واردات زمان‌بندی ناموفق، ایمیل گیت ناموفق، و تحلیل تصویر ناموفق در ۲۴ ساعت گذشته. عدد ساختگی نیست."
        />
        <ControlKpiCard
          label="مصرف منابع پلن"
          value={`${kpis.activeProjects} / ${kpis.aiActionsThisMonth}`}
          hint="پروژه فعال · اقدام AI این ماه"
          icon={Cpu}
          tone="info"
          help="سقف اشتراک جداگانه‌ای در سامانه تعریف نشده. این کارت تعداد پروژه‌های فعال و تعداد اقدام‌های هوش مصنوعی ثبت‌شده در همین ماه را نشان می‌دهد."
        />
        <ControlKpiCard
          label="رویدادهای امنیتی"
          value={kpis.securityEvents24h}
          hint="شناسایی ناموفق گیت و لاگ ممیزی، ۲۴ ساعت"
          icon={ShieldAlert}
          tone={kpis.securityEvents24h > 0 ? 'warning' : 'neutral'}
          help="ورود ناموفق حساب کاربری در این نسخه جداگانه ذخیره نمی‌شود. رویدادها از شناسایی ناموفق گیت و جدول ممیزی (اگر داده داشته باشد) می‌آیند."
        />
      </div>

      <section className="rounded-lg border border-[#E4E7EC] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E4E7EC] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#17202A]">آخرین فعالیت‌ها</h2>
          <p className="text-[11px] text-[#667085] mt-0.5">
            اقدامات واقعی کاربران در همه پروژه‌ها، با زمان دقیق رویداد
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
            فهرست پروژه‌ها
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
