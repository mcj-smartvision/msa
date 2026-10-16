/**
 * @file features/site-ops/components/site-ops-shell.tsx
 * @purpose کامپوننت UI — عملیات کارگاه، دستورکار و برنامه روزانه (site-ops-shell)
 * @safe-to-edit CAREFUL
 * @affects عملیات کارگاه، دستورکار و برنامه روزانه
 * @depends-on shared/lib/supabase/client, shared/lib/project/project-cookie, shared/lib/project/resolve-active-project, features/admin/components/shared, features/site-ops/config
 */

'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/shared/lib/supabase/client'
import { readProjectCookie, writeProjectCookie } from '@/shared/lib/project/project-cookie'
import { resolveActiveProjectId } from '@/shared/lib/project/resolve-active-project'
import { PageHeader } from '@/features/admin/components/shared'
import {
  SITE_OPS_COPY,
  SITE_OPS_NAV_ADVANCED,
  SITE_OPS_NAV_PRIMARY,
} from '@/features/site-ops/config'

export function SiteOpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const asSupervisor = searchParams.get('as') === 'supervisor'
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [readOnly, setReadOnly] = useState(asSupervisor)

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from('projects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  useEffect(() => {
    if (!projectId) return
    void fetch(`/api/workshop/capabilities?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.readOnly === 'boolean') {
          setReadOnly(asSupervisor || data.readOnly)
        }
      })
      .catch(() => setReadOnly(asSupervisor))
  }, [projectId, asSupervisor])

  useEffect(() => {
    if (projects.length === 0) return

    const fromCookie = readProjectCookie()
    const cookieProject = resolveActiveProjectId(projects, fromCookie)

    if (!projectId && cookieProject) {
      if (!fromCookie) writeProjectCookie(cookieProject)
      const params = new URLSearchParams(searchParams.toString())
      params.set('projectId', cookieProject)
      const target =
        pathname === '/site-ops' || pathname === '/site-ops/'
          ? `/site-ops/${asSupervisor ? 'prepared' : 'schedule'}?${params.toString()}`
          : `${pathname}?${params.toString()}`
      router.replace(target)
      return
    }

    if (projectId && cookieProject && projectId !== cookieProject) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('projectId', cookieProject)
      if (asSupervisor) params.set('as', 'supervisor')
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [projectId, projects, pathname, router, searchParams, asSupervisor])

  // Default landing → schedule (or prepared for supervisor view)
  useEffect(() => {
    if (pathname === '/site-ops' || pathname === '/site-ops/') {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)
      if (asSupervisor) params.set('as', 'supervisor')
      const dest = asSupervisor || readOnly ? 'prepared' : 'schedule'
      const q = params.toString() ? `?${params.toString()}` : ''
      router.replace(`/site-ops/${dest}${q}`)
    }
  }, [pathname, projectId, router, asSupervisor, readOnly])

  const q = useMemo(() => {
    const params = new URLSearchParams()
    if (projectId) params.set('projectId', projectId)
    if (asSupervisor) params.set('as', 'supervisor')
    const s = params.toString()
    return s ? `?${s}` : ''
  }, [projectId, asSupervisor])

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title={SITE_OPS_COPY.title}
        description={
          readOnly
            ? SITE_OPS_COPY.supervisorDescription
            : SITE_OPS_COPY.editorDescription
        }
      />
      <header className="space-y-3 border-b border-slate-200 pb-4">
        <nav className="flex flex-wrap gap-2">
          {SITE_OPS_NAV_PRIMARY.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={`${link.href}${q}`}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-slate-500 underline underline-offset-2"
        >
          {showAdvanced ? SITE_OPS_COPY.hideAdvanced : SITE_OPS_COPY.showAdvanced}
        </button>
        {showAdvanced && (
          <nav className="flex flex-wrap gap-2 pt-1">
            {SITE_OPS_NAV_ADVANCED.map((link) => (
              <Link
                key={link.href}
                href={link.href.startsWith('/dashboard') ? link.href : `${link.href}${q}`}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {children}
    </div>
  )
}
