'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/hooks/useSupabase'
import { fetchAdminProjects, fetchAllMembers, fetchPositions } from '@/utils/admin'
import { PageHeader, LoadingBlock, ErrorBlock, StatusBadge } from '@/components/admin/shared'
import { MemberForm } from '@/components/admin/member-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AdminProject, Position, ProjectMember } from '@/types/admin'
import { formatLoginDisplay } from '@/lib/auth/login-identifier'
import { getAdminMemberMessages } from '@/lib/i18n/admin-member'
import { useLocale } from '@/components/i18n/locale-provider'
import { KeyRound, Pencil, UserCheck, Users } from 'lucide-react'

export default function AdminMembersPage() {
  const supabase = useSupabase()
  const { locale } = useLocale()
  const t = getAdminMemberMessages(locale)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPositions = useCallback(
    async (projectId: string) => {
      if (!projectId) {
        setPositions([])
        return
      }
      setPositionsLoading(true)
      try {
        const data = await fetchPositions(supabase, projectId)
        setPositions(data)
      } catch (err) {
        console.error(err)
        setPositions([])
      } finally {
        setPositionsLoading(false)
      }
    },
    [supabase]
  )

  async function loadData(projectId?: string) {
    const [memberData, projectData] = await Promise.all([
      fetchAllMembers(supabase),
      fetchAdminProjects(supabase),
    ])
    setMembers(memberData)
    setProjects(projectData)

    const pid = projectId ?? selectedProjectId ?? projectData[0]?.id ?? ''
    if (pid) {
      setSelectedProjectId(pid)
      await loadPositions(pid)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await loadData()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری اعضا ناموفق بود')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (!selectedProjectId) return
    loadPositions(selectedProjectId)
  }, [selectedProjectId, loadPositions])

  async function handleSeedPositions() {
    if (!selectedProjectId) return
    const response = await fetch('/api/admin/seed-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: selectedProjectId }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || t.seedFailed)
    setPositions(data.positions ?? [])
  }

  async function handleCreateMember(values: {
    full_name: string
    email: string
    phone?: string
    password: string
    is_active?: boolean
    position_ids: string[]
  }) {
    if (!selectedProjectId) throw new Error(t.selectProject)

    const response = await fetch('/api/admin/invite-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: selectedProjectId,
        ...values,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'ایجاد عضو ناموفق بود')
    await loadData(selectedProjectId)
    setShowForm(false)
  }

  if (loading) return <LoadingBlock label={t.loadingPositions} />
  if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />

  const projectMembers = selectedProjectId
    ? members.filter((m) => m.project_id === selectedProjectId)
    : members
  const activeCount = projectMembers.filter((m) => m.is_active).length
  const pendingPassword = projectMembers.filter((m) => !m.password_changed_by_member).length

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title={t.memberManagement}
        description={t.memberManagementDesc}
        actions={
          <Button onClick={() => setShowForm(!showForm)} disabled={!selectedProjectId && projects.length === 0}>
            {showForm ? t.cancel : t.addMember}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{projectMembers.length}</p>
              <p className="text-xs text-muted-foreground">{t.totalMembers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">{t.activeMembers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingPassword}</p>
              <p className="text-xs text-muted-foreground">{t.passwordPending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {projects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t.project}:</span>
          <Select
            value={selectedProjectId || undefined}
            onValueChange={(id) => {
              setSelectedProjectId(id)
              setShowForm(false)
            }}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder={t.selectProject} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">{t.createProjectFirst}</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/admin/projects">{t.createProject}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && selectedProjectId ? (
        <MemberForm
          positions={positions}
          positionsLoading={positionsLoading}
          onSeedPositions={handleSeedPositions}
          submitLabel={t.addMember}
          onSubmit={handleCreateMember}
        />
      ) : null}

      <Card className="shadow-card overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-base font-semibold">{t.teamDirectory}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projectMembers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t.noMembers}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">{t.fullName}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">{t.siteRole}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">{t.username}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">{t.email}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">{t.initialPassword}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">وضعیت</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {projectMembers.map((member) => (
                    <tr key={member.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-medium">{member.full_name}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(member.positions ?? []).map((pos) => (
                            <Badge key={pos.id} variant="outline" className="text-xs font-normal">
                              {pos.title}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">{formatLoginDisplay(member.email)}</td>
                      <td className="px-4 py-3.5 text-xs">
                        {member.contact_email ||
                          (!member.email.toLowerCase().endsWith('@site.local') ? member.email : (
                            <span className="text-muted-foreground">—</span>
                          ))}
                      </td>
                      <td className="px-4 py-3.5">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {member.admin_visible_password || '—'}
                        </code>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge active={member.is_active} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/projects/${member.project_id}/members/${member.id}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            ویرایش
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
