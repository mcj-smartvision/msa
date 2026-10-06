import { Suspense } from 'react'
import { AdminMembersPage } from '@/features/admin/components/admin-members-page'
import { LoadingBlock } from '@/features/admin/components/shared'

export default function AdminMembersRoute() {
  return (
    <Suspense fallback={<LoadingBlock label="در حال بارگذاری..." />}>
      <AdminMembersPage />
    </Suspense>
  )
}
