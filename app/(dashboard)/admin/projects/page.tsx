'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  HardHat,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { createProject, fetchAdminProjects } from '@/utils/admin'
import { LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import { ControlKpiCard, ProjectsControlHeader } from '@/components/admin/projects-control/control-chrome'
import { ProjectToolbar } from '@/components/admin/projects-control/project-toolbar'
import {
  EmptyProjectsState,
  ProjectRow,
} from '@/components/admin/projects-control/project-row'
import { ProjectCreationDrawer } from '@/components/admin/projects-control/project-creation-drawer'
import { Button } from '@/components/ui/button'
import {
  estimateProgress,
  resolveProjectStatusKey,
} from '@/lib/admin/project-status'
import type { AdminProject, CreateProjectInput } from '@/types/admin'

export default function AdminProjectsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [successNote, setSuccessNote] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [sort, setSort] = useState('updated_desc')

  const loadProjects = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const data = await Promise.race([
          fetchAdminProjects(supabase),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'زمان بارگذاری تمام شد — اتصال Supabase را بررسی و صفحه را تازه کنید.'
                  )
                ),
              15000
            )
          ),
        ])
        setProjects(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'بارگذاری پروژه‌ها ناموفق بود')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [supabase]
  )

  useEffect(() => {
    void loadProjects('initial')
  }, [loadProjects])

  const locations = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) {
      if (p.location?.trim()) set.add(p.location.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'))
  }, [projects])

  const kpis = useMemo(() => {
    const active = projects.filter(
      (p) => resolveProjectStatusKey(p.status, p.is_active) === 'active'
    ).length
    const atRisk = projects.filter((p) => {
      const key = resolveProjectStatusKey(p.status, p.is_active)
      return key === 'at_risk' || key === 'suspended' || key === 'paused'
    }).length
    const progressValues = projects.map((p) => estimateProgress(p.status, p.is_active))
    const overall =
      progressValues.length === 0
        ? 0
        : Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const recent = projects.filter((p) => {
      const t = new Date(p.updated_at || p.created_at || 0).getTime()
      return Number.isFinite(t) && t >= dayAgo
    }).length
    return { active, atRisk, overall, recent }
  }, [projects])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = projects.filter((p) => {
      const key = resolveProjectStatusKey(p.status, p.is_active)
      if (statusFilter !== 'all' && key !== statusFilter) return false
      if (locationFilter !== 'all' && (p.location || '') !== locationFilter) return false
      if (!q) return true
      const hay = `${p.name} ${p.code ?? ''} ${p.location ?? ''} ${p.status}`.toLowerCase()
      return hay.includes(q)
    })

    rows = [...rows].sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'fa')
      if (sort === 'name_desc') return b.name.localeCompare(a.name, 'fa')
      if (sort === 'progress_desc') {
        return estimateProgress(b.status, b.is_active) - estimateProgress(a.status, a.is_active)
      }
      const ta = new Date(a.updated_at || a.created_at || 0).getTime()
      const tb = new Date(b.updated_at || b.created_at || 0).getTime()
      return tb - ta
    })
    return rows
  }, [projects, query, statusFilter, locationFilter, sort])

  async function handleCreate(input: CreateProjectInput) {
    const project = await createProject(supabase, input)
    setDrawerOpen(false)
    setSuccessNote(`پروژه «${project.name}» ایجاد شد.`)
    await loadProjects('refresh')
    router.push(`/admin/projects/${project.id}/members`)
  }

  if (loading) return <LoadingBlock label="در حال بارگذاری مرکز کنترل پروژه‌ها..." />
  if (error && projects.length === 0) {
    return <ErrorBlock message={error} onRetry={() => void loadProjects('initial')} />
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 rounded-lg bg-[#F7F8FA] p-1 sm:p-0">
      <ProjectsControlHeader
        eyebrow="مرکز کنترل پروژه"
        title="پروژه‌ها"
        description="سایت‌های فعال، وضعیت تیم و پیشرفت عمرانی را پایش کنید."
        actions={
          <>
            <Button asChild variant="outline" className="border-[#E4E7EC]">
              <Link href="/admin/projects/initialize">راه‌اندازی پیشرفته</Link>
            </Button>
            <Button
              type="button"
              className="bg-[#C96A1B] hover:bg-[#A95312]"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus className="h-4 w-4" />
              پروژه جدید
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ControlKpiCard
          label="پروژه‌های فعال"
          value={kpis.active}
          hint="در حال اجرا"
          icon={HardHat}
          tone="success"
        />
        <ControlKpiCard
          label="در خطر / نیازمند توجه"
          value={kpis.atRisk}
          hint="نیاز به رسیدگی"
          icon={AlertTriangle}
          tone="warning"
        />
        <ControlKpiCard
          label="پیشرفت کلی"
          value={`${kpis.overall}٪`}
          hint="میانگین پروژه‌های موجود"
          icon={TrendingUp}
          tone="info"
        />
        <ControlKpiCard
          label="به‌روزرسانی اخیر"
          value={kpis.recent}
          hint="در ۲۴ ساعت گذشته"
          icon={Activity}
        />
      </div>

      <ProjectToolbar
        query={query}
        onQueryChange={setQuery}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        location={locationFilter}
        onLocationChange={setLocationFilter}
        locations={locations}
        sort={sort}
        onSortChange={setSort}
        onRefresh={() => void loadProjects('refresh')}
        refreshing={refreshing}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[#17202A]">همه پروژه‌ها</h2>
          <p className="text-xs text-[#667085]">{visible.length} پروژه قابل نمایش</p>
        </div>

        {projects.length === 0 ? (
          <EmptyProjectsState onCreate={() => setDrawerOpen(true)} />
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-white px-4 py-10 text-center text-sm text-[#667085]">
            هیچ پروژه‌ای با این فیلترها پیدا نشد.
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <ProjectCreationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}
