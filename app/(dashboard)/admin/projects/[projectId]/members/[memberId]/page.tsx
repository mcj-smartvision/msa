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
    if (!memberData) throw new Error('عضو یافت نشد')
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری پروفایل عضو ناموفق بود')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, params.memberId, params.projectId])

  if (loading) return <LoadingBlock label="در حال بارگذاری پروفایل عضو..." />
  if (error || !member) return <ErrorBlock message={error ?? 'عضو یافت نشد'} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="پروفایل عضو"
        description="جزئیات عضو، سمت‌ها و اطلاعات ورود را به‌روز کنید."
        actions={
          <Button asChild variant="outline">
            <Link href={`/admin/projects/${params.projectId}/members`}>بازگشت به اعضا</Link>
          </Button>
        }
      />

      {saved ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          پروفایل عضو با موفقیت به‌روز شد.
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
          if (!response.ok) throw new Error(data.error || 'بازنشانی رمز ناموفق بود')
          await loadMember()
        }}
      />

      <MemberForm
        positions={positions}
        initial={{
          ...member,
          position_ids: member.positions?.map((position) => position.id) ?? [],
        }}
        submitLabel="ذخیره تغییرات"
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
          if (!response.ok) throw new Error(data.error || 'به‌روزرسانی عضو ناموفق بود')
          setSaved(true)
          await loadMember()
          router.refresh()
        }}
      />
    </div>
  )
}
