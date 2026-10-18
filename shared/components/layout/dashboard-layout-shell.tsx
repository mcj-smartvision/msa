/**
 * @file shared/components/layout/dashboard-layout-shell.tsx
 * @purpose کامپوننت UI — زیرساخت مشترک سامانه (dashboard-layout-shell)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/components/layout/dashboard-header, shared/lib/dashboard/role-nav
 */

'use client'

import { usePathname } from 'next/navigation'
import { DashboardHeader } from '@/shared/components/layout/dashboard-header'
import type { RoleNavLink } from '@/shared/lib/dashboard/role-nav'

export function DashboardLayoutShell({
  email,
  isAdmin,
  roleNavLinks = [],
  projectOptions = [],
  children,
}: {
  email: string
  isAdmin: boolean
  roleNavLinks?: RoleNavLink[]
  projectOptions?: { id: string; name: string }[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith('/admin')
  const ownsChrome = pathname.startsWith('/dashboard/manager')
  const wideScheduleLayout = pathname.includes('/dashboard/technical-office')
  const siteSupervisorMobile = pathname.startsWith('/dashboard/site-supervisor')

  if (isAdminRoute || ownsChrome) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#5a7088]">
      <DashboardHeader
        email={email}
        isAdmin={isAdmin}
        roleNavLinks={roleNavLinks}
        projectOptions={projectOptions}
      />
      <main
        className={
          wideScheduleLayout
            ? 'w-full max-w-none px-2 sm:px-3 py-6'
            : siteSupervisorMobile
              ? 'container mx-auto px-2 py-3 sm:px-4 sm:py-6'
              : 'container mx-auto px-4 py-8'
        }
      >
        {children}
      </main>
    </div>
  )
}
