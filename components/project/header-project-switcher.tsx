'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, Layers } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { ALL_PROJECTS_SCOPE, readProjectCookie, writeProjectCookie } from '@/lib/project/project-cookie'
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

/** Compact project switcher for the global site header (mirrors the language switcher). */
export function HeaderProjectSwitcher({
  className,
  allowAll = false,
}: {
  className?: string
  allowAll?: boolean
}) {
  const supabase = useSupabase()
  const router = useRouter()
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const adminCtx = useControlCenterDetailsOptional()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selected, setSelected] = useState<string | null>(allowAll ? ALL_PROJECTS_SCOPE : null)

  const allLabel = fa ? 'همه پروژه‌ها' : 'All Projects'

  const adminScope = adminCtx?.scope
  const adminProjects = adminCtx?.projects
  const adminSetScope = adminCtx?.setScope

  useEffect(() => {
    if (allowAll && adminSetScope && adminProjects) {
      setProjects(adminProjects.map((p) => ({ id: p.id, name: p.name })))
      setSelected(adminScope ?? ALL_PROJECTS_SCOPE)
      return
    }

    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (cancelled) return
      const options = (data ?? []) as ProjectOption[]
      setProjects(options)

      const fromCookie = readProjectCookie()
      const valid = options.find((p) => p.id === fromCookie)
      const next = valid?.id ?? options[0]?.id ?? null
      setSelected(next)
      if (next && next !== fromCookie) writeProjectCookie(next)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, allowAll, adminScope, adminProjects, adminSetScope])

  if (!allowAll && (projects.length === 0 || !selected)) return null
  if (allowAll && !selected) return null

  function handleChange(projectId: string) {
    setSelected(projectId)
    if (allowAll && adminCtx) {
      adminCtx.setScope(projectId)
      return
    }
    if (projectId !== ALL_PROJECTS_SCOPE) {
      writeProjectCookie(projectId)
      router.refresh()
    }
  }

  const current = projects.find((p) => p.id === selected)
  const display =
    selected === ALL_PROJECTS_SCOPE ? allLabel : current?.name ?? (fa ? 'پروژه' : 'Project')

  return (
    <div className={className}>
      <Select value={selected ?? ALL_PROJECTS_SCOPE} onValueChange={handleChange}>
        <SelectTrigger
          className={cn(HEADER_CHIP, 'w-[128px]')}
          aria-label={fa ? 'پروژه' : 'Project'}
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
          {allowAll ? (
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
