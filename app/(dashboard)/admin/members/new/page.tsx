import { Suspense } from 'react'
import { AddMemberPage } from '@/components/admin/add-member-page'
import { LoadingBlock } from '@/components/admin/shared'

export default function AdminAddMemberRoute() {
  return (
    <Suspense fallback={<LoadingBlock label="در حال بارگذاری..." />}>
      <AddMemberPage />
    </Suspense>
  )
}
