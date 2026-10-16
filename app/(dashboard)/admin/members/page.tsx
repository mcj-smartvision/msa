/**
 * @file app/(dashboard)/admin/members/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/admin/components/admin-members-page, features/admin/components/shared
 */

import { Suspense } from 'react'
import { AdminMembersPage } from '@/features/admin/components/admin-members-page'
import { LoadingBlock } from '@/features/admin/components/shared'
import { ADMIN_COPY } from '@/features/admin/config'

export default function AdminMembersRoute() {
  return (
    <Suspense fallback={<LoadingBlock label={ADMIN_COPY.loadingDots} />}>
      <AdminMembersPage />
    </Suspense>
  )
}
