'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { fetchAdminProjects, fetchPositions } from '@/features/admin/services/admin'
import { MemberForm } from '@/features/admin/components/member-form'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { useControlCenterDetailsOptional } from '@/features/admin/components/control-center-details-context'
import { resolveAdminProjectId } from '@/features/admin/lib/resolve-admin-project'
import { isAllProjectsScope } from '@/shared/lib/project/project-cookie'
import { getAdminMemberMessages } from '@/shared/lib/i18n/admin-member'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import type { AdminProject, Position } from '@/shared/types/admin'

export function AddMemberPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabase()
  const adminCtx = useControlCenterDetailsOptional()
  const { locale } = useLocale()
  const t = getAdminMemberMessages(locale)

  const queryProjectId = searchParams.get('projectId')
  const preferredRoleKey = searchParams.get('role') ?? undefined

  const [projects, setProjects] = useState<AdminProject[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [projectId, setProjectId] = useState('')
  const [projectLocked, setProjectLocked] = useState(false)
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const seedPositionsForProject = useCallback(
    async (targetProjectId: string): Promise<Position[]> => {
      const response = await fetch('/api/admin/seed-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: targetProjectId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t.seedFailed)
      return (data.positions ?? []) as Position[]
    },
    [t.seedFailed]
  )

  const loadPositions = useCallback(
    async (targetProjectId: string) => {
      if (!targetProjectId) {
        setPositions([])
        return
      }
      setPositionsLoading(true)
      try {
        let data = await fetchPositions(supabase, targetProjectId)
        const hse = data.find((p) => p.key === 'hse_officer')
        const needsHseSeed =
          !hse || (hse.name_fa !== 'مسئول ایمنی' && hse.title !== 'مسئول ایمنی')
        if (needsHseSeed) {
          data = await seedPositionsForProject(targetProjectId)
        }
        setPositions(data)
      } catch (err) {
        console.error(err)
        setPositions([])
      } finally {
        setPositionsLoading(false)
      }
    },
    [supabase, seedPositionsForProject]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const projectData = adminCtx?.projects.length
          ? adminCtx.projects
          : await fetchAdminProjects(supabase)
        if (cancelled) return

        const resolved = resolveAdminProjectId(projectData, {
          queryProjectId,
          scope: adminCtx?.scope,
        })
        const locked = Boolean(
          resolved &&
            ((queryProjectId && queryProjectId === resolved) ||
              (!isAllProjectsScope(adminCtx?.scope) && adminCtx?.scope === resolved) ||
              projectData.length === 1)
        )

        setProjects(projectData)
        setProjectId(resolved)
        setProjectLocked(locked)
        if (resolved) {
          await loadPositions(resolved)
        }
        setError(null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'بارگذاری اطلاعات عضو ناموفق بود')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, adminCtx?.projects, adminCtx?.scope, queryProjectId, loadPositions])

  useEffect(() => {
    if (!projectId || loading || projectLocked) return
    loadPositions(projectId)
  }, [projectId, loading, projectLocked, loadPositions])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId]
  )

  async function handleSeedPositions() {
    if (!projectId) return
    const next = await seedPositionsForProject(projectId)
    setPositions(next)
  }

  async function handleCreateMember(values: {
    full_name: string
    email: string
    phone?: string
    password: string
    is_active?: boolean
    position_ids: string[]
  }) {
    if (!projectId) throw new Error(t.selectProject)

    const response = await fetch('/api/admin/invite-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        ...values,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'ایجاد عضو ناموفق بود')

    adminCtx?.setScope(projectId)
    router.push(`/admin/members?projectId=${encodeURIComponent(projectId)}`)
  }

  if (loading) return <LoadingBlock label={t.loadingPositions} />
  if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />

  if (projects.length === 0) {
    return (
      <div className="space-y-6 max-w-[900px]">
        <PageHeader title={t.addMember} description={t.createProjectFirst} />
        <Button asChild>
          <Link href="/admin/projects/new">{t.createProject}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <PageHeader
        title={preferredRoleKey === 'hse_officer' ? 'افزودن مسئول ایمنی' : t.addMember}
        description={t.memberManagementDesc}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={projectId ? `/admin/members?projectId=${encodeURIComponent(projectId)}` : '/admin/members'}>
              <ArrowRight className="h-4 w-4" />
              {t.cancel}
            </Link>
          </Button>
        }
      />

      {projectLocked && selectedProject ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">{t.project}:</span>
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedProject.name}
          </Badge>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t.project}:</span>
          <Select value={projectId || undefined} onValueChange={setProjectId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={t.selectProject} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {projectId ? (
        <MemberForm
          key={`${projectId}-${preferredRoleKey ?? 'default'}`}
          positions={positions}
          positionsLoading={positionsLoading}
          onSeedPositions={handleSeedPositions}
          preferredPositionKey={preferredRoleKey}
          submitLabel={preferredRoleKey === 'hse_officer' ? 'افزودن مسئول ایمنی' : t.addMember}
          onSubmit={handleCreateMember}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t.selectProject}</p>
      )}
    </div>
  )
}
