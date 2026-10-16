/**
 * @file app/(dashboard)/admin/members/new/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/admin/components/add-member-page, features/admin/components/shared
 */

import { Suspense } from 'react'
import { AddMemberPage } from '@/features/admin/components/add-member-page'
import { LoadingBlock } from '@/features/admin/components/shared'
import { ADMIN_COPY } from '@/features/admin/config'

export default function AdminAddMemberRoute() {
  return (
    <Suspense fallback={<LoadingBlock label={ADMIN_COPY.loadingDots} />}>
      <AddMemberPage />
    </Suspense>
  )
}
