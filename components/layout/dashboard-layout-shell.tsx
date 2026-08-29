'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { GlobalMessengerFab } from '@/components/layout/global-messenger-fab'
import type { RoleNavLink } from '@/lib/dashboard/role-nav'

export function DashboardLayoutShell({
  email,
  isAdmin,
  roleNavLinks = [],
  children,
}: {
  email: string
  isAdmin: boolean
  roleNavLinks?: RoleNavLink[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith('/admin')

  if (isAdminRoute) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#5a7088]">
      <DashboardHeader email={email} isAdmin={isAdmin} roleNavLinks={roleNavLinks} />
      <main className="container mx-auto px-4 py-8">{children}</main>
      <GlobalMessengerFab />
    </div>
  )
}
