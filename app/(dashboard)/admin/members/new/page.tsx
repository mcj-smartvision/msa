import { Suspense } from 'react'
import { AddMemberPage } from '@/features/admin/components/add-member-page'
import { LoadingBlock } from '@/features/admin/components/shared'

export default function AdminAddMemberRoute() {
  return (
    <Suspense fallback={<LoadingBlock label="در حال بارگذاری..." />}>
      <AddMemberPage />
    </Suspense>
  )
}
