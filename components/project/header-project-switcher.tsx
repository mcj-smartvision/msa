'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FolderKanban, Layers, Loader2 } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL } from '@/lib/admin/defaults'
import {
  ALL_PROJECTS_SCOPE,
  readProjectCookie,
  writeProjectCookie,
} from '@/lib/project/project-cookie'
import { resolveActiveProjectId } from '@/lib/project/resolve-active-project'
import { useControlCenterDetailsOptional } from '@/components/admin/control-center-details-context'
import { useLocale } from '@/components/i18n/locale-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HEADER_CHIP } from '@/components/layout/header-chip'
import { cn } from '@/lib/utils'

interface ProjectOption {
  id: string
  name: string
}

async function isClientSystemAdmin(
  supabase: SupabaseClient,
  userId: string,
  email: string | undefined
): Promise<boolean> {
  const { data: roleRows } = await supabase
    .from('user_system_roles')
    .select('system_role:system_roles(key, is_active)')
    .eq('user_id', userId)

  if (roleRows?.some((row) => {
    const raw = row as { system_role: unknown }
    const role = Array.isArray(raw.system_role)
      ? raw.system_role[0]
      : raw.system_role
    const r = role as { key?: string; is_active?: boolean } | null
    return Boolean(r?.is_active && (r.key === 'system_admin' || r.key === 'it_admin'))
  })) {
    return true
  }

  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

/** Compact project switcher for the global site header (mirrors the language switcher). */
export function HeaderProjectSwitcher({
  className,
  allowAll = false,
  initialProjects = [],
}: {
  className?: string
  /** Control-center only: includes «همه پروژه‌ها» and uses admin scope context. */
  allowAll?: boolean
  /** Server-provided list — shown immediately and kept when client refresh fails. */
  initialProjects?: ProjectOption[]
}) {
  const supabase = useSupabase()
  const router = useRouter()
  const pathname = usePathname()
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const adminCtx = useControlCenterDetailsOptional()
  const [projects, setProjects] = useState<ProjectOption[]>(initialProjects)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(initialProjects.length === 0)

  const allLabel = fa ? 'همه پروژه‌ها' : 'All Projects'
  const inControlCenter = allowAll && adminCtx?.setScope && adminCtx?.projects

  const adminScope = adminCtx?.scope
  const adminProjects = adminCtx?.projects
  const adminSetScope = adminCtx?.setScope

  const syncFromCookie = useCallback(
    (options: ProjectOption[]) => {
      const fromCookie = readProjectCookie()
      const cookieId =
        fromCookie && fromCookie !== ALL_PROJECTS_SCOPE ? fromCookie : null
      const next = resolveActiveProjectId(options, cookieId)
      setSelected(next)
      // First visit only — never overwrite an existing user choice.
      if (!fromCookie && next) writeProjectCookie(next)
    },
    []
  )

  useEffect(() => {
    if (initialProjects.length === 0) return
    setProjects(initialProjects)
    syncFromCookie(initialProjects)
    setLoading(false)
  }, [initialProjects, syncFromCookie])

  useEffect(() => {
    if (inControlCenter) {
      setProjects(adminProjects!.map((p) => ({ id: p.id, name: p.name })))
      setSelected(adminScope ?? ALL_PROJECTS_SCOPE)
      setLoading(false)
      return
    }

    let cancelled = false
    if (initialProjects.length === 0) setLoading(true)

    ;(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) {
          if (!cancelled) setLoading(false)
          return
        }

        const { data: memberships } = await supabase
          .from('v_project_members_with_positions')
          .select('project_id, positions')
          .eq('user_id', user.id)
          .eq('is_active', true)

        const memberIds = [...new Set((memberships ?? []).map((m) => m.project_id as string))]
        const positionKeys = (memberships ?? []).flatMap((m) => {
          const positions = m.positions as Array<{ key?: string }> | null
          return (positions ?? []).map((p) => p.key).filter(Boolean) as string[]
        })

        let options: ProjectOption[] = []
        if (memberIds.length > 0) {
          const { data } = await supabase
            .from('projects')
            .select('id, name')
            .in('id', memberIds)
            .eq('is_active', true)
            .order('name')
          options = (data ?? []) as ProjectOption[]
        }

        const canSeeAllProjects =
          (await isClientSystemAdmin(supabase, user.id, user.email)) ||
          positionKeys.includes('finance_admin')

        if (canSeeAllProjects) {
          const { data } = await supabase
            .from('projects')
            .select('id, name')
            .eq('is_active', true)
            .order('name')
          if (data?.length) options = data as ProjectOption[]
        }

        if (cancelled) return
        if (options.length > 0) {
          setProjects(options)
          syncFromCookie(options)
        }
      } catch (err) {
        console.error('[HeaderProjectSwitcher] project list refresh failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, inControlCenter, adminScope, adminProjects, adminSetScope, syncFromCookie, initialProjects])

  // Keep header in sync when navigating — cookie is source of truth; never write cookie here.
  useEffect(() => {
    if (inControlCenter) return
    if (projects.length === 0) return
    const fromCookie = readProjectCookie()
    if (!fromCookie || fromCookie === ALL_PROJECTS_SCOPE) return
    if (projects.some((p) => p.id === fromCookie)) {
      setSelected(fromCookie)
    }
  }, [pathname, projects, inControlCenter])

  function handleChange(projectId: string) {
    setSelected(projectId)
    if (inControlCenter) {
      adminCtx!.setScope(projectId)
      return
    }
    if (projectId !== ALL_PROJECTS_SCOPE) {
      writeProjectCookie(projectId)
      router.refresh()
    }
  }

  if (loading) {
    return (
      <div
        className={cn(HEADER_CHIP, 'inline-flex w-[128px] items-center justify-center', className)}
        aria-busy="true"
        aria-label={fa ? 'بارگذاری پروژه‌ها' : 'Loading projects'}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
      </div>
    )
  }

  if (!inControlCenter && projects.length === 0) return null
  if (inControlCenter && !selected) return null

  const current = projects.find((p) => p.id === selected)
  const display =
    selected === ALL_PROJECTS_SCOPE ? allLabel : current?.name ?? (fa ? 'پروژه' : 'Project')

  return (
    <div className={className}>
      <Select value={selected ?? projects[0]?.id ?? ALL_PROJECTS_SCOPE} onValueChange={handleChange}>
        <SelectTrigger
          className={cn(HEADER_CHIP, 'w-[min(100%,160px)] sm:w-[180px]')}
          aria-label={fa ? 'انتخاب پروژه' : 'Select project'}
        >
          {selected === ALL_PROJECTS_SCOPE ? (
            <Layers className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          ) : (
            <FolderKanban className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          )}
          <SelectValue placeholder={allLabel}>
            <span className="truncate">{display}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {inControlCenter ? (
            <SelectItem value={ALL_PROJECTS_SCOPE}>{allLabel}</SelectItem>
          ) : null}
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
