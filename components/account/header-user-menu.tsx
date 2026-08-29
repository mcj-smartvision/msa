'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, KeyRound, LogOut, Pencil, UserRound } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { formatLoginDisplay } from '@/lib/auth/login-identifier'
import { accountCopy } from '@/lib/account/copy'
import { openAccountPage } from '@/lib/account/open-account-page'
import { cn } from '@/lib/utils'

export function HeaderUserMenu({
  email,
  className,
}: {
  email?: string
  className?: string
}) {
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const copy = accountCopy(fa)
  const username = email ? formatLoginDisplay(email) : fa ? 'کاربر' : 'User'
  const initial = username.trim().charAt(0).toUpperCase() || 'U'
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = [
    { key: 'profile' as const, label: copy.profile, icon: UserRound },
    { key: 'edit' as const, label: copy.edit, icon: Pencil },
    { key: 'password' as const, label: copy.password, icon: KeyRound },
    { key: 'logout' as const, label: copy.logout, icon: LogOut, danger: true },
  ]

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[#5a7088] bg-white py-0 ps-1 pe-1.5 text-start hover:bg-slate-50"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={copy.menuAria}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-slate-900 text-[10px] font-semibold text-white">
          {initial}
        </span>
        <span className="max-w-[120px] truncate text-xs font-medium text-slate-800" title={username}>
          {username}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-[12px] border border-slate-200 bg-white py-1 shadow-lg start-0"
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-slate-50',
                  item.danger ? 'text-red-600' : 'text-slate-700'
                )}
                onClick={() => {
                  setOpen(false)
                  openAccountPage(item.key)
                }}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
