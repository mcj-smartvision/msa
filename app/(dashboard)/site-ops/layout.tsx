/**
 * @file app/(dashboard)/site-ops/layout.tsx
 * @purpose کامپوننت UI — مسیرها و layout (layout)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/site-ops-shell
 */

import { Suspense } from 'react'
import { SiteOpsShell } from '@/features/site-ops/components/site-ops-shell'
import { getSiteOpsMessages } from '@/shared/lib/i18n/site-ops'

export default function SiteOpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">{getSiteOpsMessages('fa').loadingOps}</div>}>
      <SiteOpsShell>{children}</SiteOpsShell>
    </Suspense>
  )
}
