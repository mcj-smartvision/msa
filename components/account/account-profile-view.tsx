'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatLoginDisplay } from '@/lib/auth/login-identifier'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ProfileRow = {
  email: string | null
  full_name: string | null
  phone: string | null
  contact_email: string | null
  personnel_code: string | null
}

type ProjectRow = {
  name: string
  positions: string[]
}

export function AccountProfileView() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setError(copy.mustLogin)
        return
      }

      const [profileRes, membersRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('email, full_name, phone, contact_email, personnel_code')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('v_project_members_with_positions')
          .select('project_id, positions')
          .eq('user_id', user.id)
          .eq('is_active', true),
      ])

      if (cancelled) return
      if (profileRes.error) {
        setError(profileRes.error.message)
        return
      }

      const row = (profileRes.data ?? {
        email: user.email ?? '',
        full_name: null,
        phone: null,
        contact_email: null,
        personnel_code: null,
      }) as ProfileRow
      setProfile(row)
      setUsername(formatLoginDisplay(row.email || user.email || ''))

      const members = (membersRes.data ?? []) as Array<{
        project_id: string
        positions?: Array<{ title?: string } | string> | null
      }>
      const projectIds = [...new Set(members.map((m) => m.project_id))]
      if (projectIds.length === 0) {
        setProjects([])
        return
      }
      const { data: projectRows } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds)
        .eq('is_active', true)
      if (cancelled) return
      const nameById = new Map((projectRows ?? []).map((p) => [String(p.id), String(p.name)]))
      setProjects(
        members
          .filter((m) => nameById.has(m.project_id))
          .map((m) => ({
            name: nameById.get(m.project_id) ?? '',
            positions: (m.positions ?? [])
              .map((p) => (typeof p === 'string' ? p : p.title ?? ''))
              .filter(Boolean),
          }))
      )
    }
    load().catch(() => {
      if (!cancelled) setError(copy.loadError)
    })
    return () => {
      cancelled = true
    }
  }, [copy.loadError, copy.mustLogin])

  function value(text: string | null | undefined) {
    return text?.trim() ? text : copy.empty
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <dl className="divide-y divide-slate-100 rounded-[12px] border border-slate-200">
        <Row label={copy.username} value={username || copy.empty} />
        <Row label={copy.fullName} value={value(profile?.full_name)} />
        <Row label={copy.phone} value={value(profile?.phone)} />
        <Row label={copy.contactEmail} value={value(profile?.contact_email)} />
        <Row label={copy.personnelCode} value={value(profile?.personnel_code)} />
      </dl>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-800">{copy.projects}</p>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">{copy.empty}</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((project) => (
              <li key={project.name} className="rounded-[10px] border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium text-slate-800">{project.name}</p>
                {project.positions.length > 0 ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {copy.positions}: {project.positions.join('، ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}
