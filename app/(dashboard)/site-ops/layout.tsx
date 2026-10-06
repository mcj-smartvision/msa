import { Suspense } from 'react'
import { SiteOpsShell } from '@/features/site-ops/components/site-ops-shell'

export default function SiteOpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">در حال بارگذاری عملیات کارگاه…</div>}>
      <SiteOpsShell>{children}</SiteOpsShell>
    </Suspense>
  )
}
