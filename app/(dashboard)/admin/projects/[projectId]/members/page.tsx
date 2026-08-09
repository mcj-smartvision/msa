'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/hooks/useSupabase'
import { fetchPositions, fetchProjectMembers } from '@/utils/admin'
import { PageHeader, LoadingBlock, ErrorBlock, StatusBadge, EmptyState } from '@/components/admin/shared'
import { MemberForm } from '@/components/admin/member-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getAdminMemberMessages } from '@/lib/i18n/admin-member'
import { useLocale } from '@/components/i18n/locale-provider'
import { formatLoginDisplay } from '@/lib/auth/login-identifier'
import type { Position, ProjectMember } from '@/types/admin'

export default function ProjectMembersPage({ params }: { params: { projectId: string } }) {
  const supabase = useSupabase()
  const { locale } = useLocale()
  const t = getAdminMemberMessages(locale)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPositions = useCallback(async () => {
    setPositionsLoading(true)
    try {
      const data = await fetchPositions(supabase, params.projectId)
      setPositions(data)
    } catch (err) {
      console.error(err)
      setPositions([])
    } finally {
      setPositionsLoading(false)
    }
  }, [supabase, params.projectId])

  async function loadData() {
    const [memberData, positionData] = await Promise.all([
      fetchProjectMembers(supabase, params.projectId),
      fetchPositions(supabase, params.projectId),
    ])
    setMembers(memberData)
    setPositions(positionData)
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
  }, [supabase, params.projectId])

  async function handleSeedPositions() {
    const response = await fetch('/api/admin/seed-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: params.projectId }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || t.seedFailed)
    setPositions(data.positions ?? [])
    await loadPositions()
  }

  async function handleCreateMember(values: {
    full_name: string
    email: string
    phone?: string
    is_active?: boolean
    position_ids: string[]
    send_invite?: boolean
  }) {
    const response = await fetch('/api/admin/invite-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: params.projectId,
        ...values,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'ایجاد عضو ناموفق بود')
    await loadData()
  }

  if (loading) return <LoadingBlock label={t.loadingPositions} />
  if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.memberManagement}
        description={t.memberManagementDesc}
      />

      <MemberForm
        positions={positions}
        positionsLoading={positionsLoading}
        onSeedPositions={handleSeedPositions}
        submitLabel={t.addMember}
        onSubmit={handleCreateMember}
      />

      {members.length === 0 ? (
        <EmptyState
          title={t.noMembers}
          description={t.memberManagementDesc}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t.teamDirectory}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.full_name}</p>
                      <StatusBadge active={member.is_active} />
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{formatLoginDisplay(member.email)}</p>
                    {member.contact_email ? (
                      <p className="text-sm text-muted-foreground">{member.contact_email}</p>
                    ) : null}
                    <p className="text-sm">
                      <span className="font-medium">{t.initialPassword}:</span>{' '}
                      {member.admin_visible_password || '—'}
                      {member.password_changed_by_member ? ` (${t.passwordChanged})` : ''}
                    </p>
                    {member.phone ? <p className="text-sm text-muted-foreground">{member.phone}</p> : null}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/projects/${params.projectId}/members/${member.id}`}>
                      {t.editProfile}
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(member.positions ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t.noPositionsAssigned}</span>
                  ) : (
                    member.positions?.map((position) => (
                      <span key={position.id} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                        {position.title}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
