/**
 * @file app/(auth)/login/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on nothing
 */

import { Suspense } from 'react'
import LoginPage from './login-page-client'
import { COMMON_UI } from '@/shared/lib/i18n/common-ui'

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">{COMMON_UI.loadingDots}</div>}>
      <LoginPage />
    </Suspense>
  )
}
