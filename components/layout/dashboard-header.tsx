'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/i18n/locale-provider'
import type { RoleNavLink } from '@/lib/dashboard/role-nav'
import { BrandLogo } from '@/components/brand/brand-logo'
import { HeaderUserControls } from '@/components/layout/header-user-controls'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  email: string
  isAdmin: boolean
  roleNavLinks?: RoleNavLink[]
}

export function DashboardHeader({ email, isAdmin, roleNavLinks = [] }: DashboardHeaderProps) {
  const { app } = useLocale()
  const pathname = usePathname()

  const baseNav = isAdmin
    ? [
        { href: '/admin', label: 'کنترل سنتر' },
        { href: '/admin/members', label: 'اعضا' },
        { href: '/admin/projects', label: 'پروژه‌ها' },
      ]
    : []

  const roleNav = roleNavLinks.map((link) => ({ href: link.href, label: link.label }))
  const homeHref = isAdmin ? '/admin' : roleNav[0]?.href ?? '/dashboard'
  const tailNav = [{ href: '/settings', label: app.settings }]

  const navItems = isAdmin
    ? [...baseNav, ...tailNav]
    : [
        ...(roleNav.length > 0 ? roleNav : [{ href: '/dashboard', label: 'داشبورد' }]),
        ...tailNav,
      ]

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <nav className="flex min-w-0 items-center gap-1 sm:gap-2 overflow-x-auto">
          <Link href={homeHref} className="flex items-center gap-2 font-bold shrink-0 mr-2">
            <BrandLogo size="sm" withName />
          </Link>
          {navItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <HeaderUserControls email={email} allowAllProject={isAdmin} />
      </div>
    </header>
  )
}
