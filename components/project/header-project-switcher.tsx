'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { readProjectCookie, writeProjectCookie } from '@/lib/project/project-cookie'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProjectOption {
  id: string
  name: string
}

/** Compact project switcher for the global site header (mirrors the language switcher). */
export function HeaderProjectSwitcher({ className }: { className?: string }) {
  const supabase = useSupabase()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // RLS limits rows: members see their projects, system admin sees all.
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
  }, [supabase])

  if (projects.length === 0 || !selected) return null

  function handleChange(projectId: string) {
    setSelected(projectId)
    writeProjectCookie(projectId)
    router.refresh()
  }

  const current = projects.find((p) => p.id === selected)

  return (
    <div className={className}>
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger
          className="h-9 w-[160px] gap-2 border-muted-foreground/20 bg-background/80"
          aria-label="پروژه"
        >
          <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="پروژه">
            <span className="truncate">{current?.name ?? 'پروژه'}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
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
