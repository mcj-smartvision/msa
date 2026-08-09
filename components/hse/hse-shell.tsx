'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { HSE_ARCHITECTURE_PILLARS, HSE_NAV, isHseNavActive } from '@/lib/hse/nav'
import { HSE_PROJECT } from '@/lib/hse/mock-data'
import { cn } from '@/lib/utils'

export function HseShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-slate-100 text-slate-900" dir="rtl" lang="fa">
      <aside className="hidden w-56 shrink-0 border-l border-slate-300 bg-slate-900 text-slate-100 lg:flex lg:flex-col">
        <div className="border-b border-slate-700 px-3 py-3">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400">
            مرکز کنترل ایمنی
          </p>
          <p className="mt-1 text-sm font-semibold leading-tight text-white">{HSE_PROJECT.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {HSE_PROJECT.code} · {HSE_PROJECT.location}
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {HSE_NAV.map((item) => {
            const active = isHseNavActive(pathname, item)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-700 px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold text-slate-500">خط لوله سامانه</p>
          <ul className="space-y-1.5">
            {HSE_ARCHITECTURE_PILLARS.map((p) => (
              <li key={p.key} className="text-[11px] leading-snug">
                <span className="font-medium text-slate-200">{p.label}</span>
                <span className="block text-slate-500">{p.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-300 bg-white px-2 py-2 lg:hidden">
          {HSE_NAV.map((item) => {
            const active = isHseNavActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium',
                  active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-5">{children}</main>
      </div>
    </div>
  )
}
