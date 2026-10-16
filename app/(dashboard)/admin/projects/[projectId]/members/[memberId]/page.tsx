/**
 * @file app/(dashboard)/admin/projects/[projectId]/members/[memberId]/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/hooks/use-supabase, features/admin/services/admin, features/admin/components/shared, features/admin/components/member-form, features/admin/components/admin-password-panel, shared/components/ui/button, shared/types/admin
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { fetchPositions, fetchProjectMember } from '@/features/admin/services/admin'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import { MemberForm } from '@/features/admin/components/member-form'
import { AdminPasswordPanel } from '@/features/admin/components/admin-password-panel'
import { Button } from '@/shared/components/ui/button'
import type { Position, ProjectMember } from '@/shared/types/admin'
import { ADMIN_COPY } from '@/features/admin/config'

export default function MemberProfilePage({
  params,
}: {
  params: { projectId: string; memberId: string }
}) {
  const supabase = useSupabase()
  const router = useRouter()
  const [member, setMember] = useState<ProjectMember | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function loadMember() {
    const [memberData, positionData] = await Promise.all([
      fetchProjectMember(supabase, params.memberId),
      fetchPositions(supabase, params.projectId),
    ])
    if (!memberData) throw new Error(ADMIN_COPY.memberNotFound)
    setMember(memberData)
    setPositions(positionData)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await loadMember()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : ADMIN_COPY.loadMemberFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, params.memberId, params.projectId])

  if (loading) return <LoadingBlock label={ADMIN_COPY.loadingMember} />
  if (error || !member) return <ErrorBlock message={error ?? ADMIN_COPY.memberNotFound} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={ADMIN_COPY.memberTitle}
        description={ADMIN_COPY.memberHint}
        actions={
          <Button asChild variant="outline">
            <Link href={`/admin/projects/${params.projectId}/members`}>{ADMIN_COPY.backToMembers}</Link>
          </Button>
        }
      />

      {saved ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          {ADMIN_COPY.memberSaved}
        </p>
      ) : null}

      <AdminPasswordPanel
        member={member}
        onReset={async (password) => {
          const response = await fetch('/api/admin/reset-member-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: member.id, password }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || ADMIN_COPY.resetPasswordFailed)
          await loadMember()
        }}
      />

      <MemberForm
        positions={positions}
        initial={{
          ...member,
          position_ids: member.positions?.map((position) => position.id) ?? [],
        }}
        submitLabel={ADMIN_COPY.saveChanges}
        showPasswordField={false}
        onSubmit={async (values) => {
          const response = await fetch('/api/admin/update-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              member_id: member.id,
              full_name: values.full_name,
              phone: values.phone,
              is_active: values.is_active,
              position_ids: values.position_ids,
              contact_email: values.contact_email ?? null,
              personnel_code: values.personnel_code ?? null,
              migrate_login: true,
            }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || ADMIN_COPY.updateMemberFailed)
          setSaved(true)
          await loadMember()
          router.refresh()
        }}
      />
    </div>
  )
}
