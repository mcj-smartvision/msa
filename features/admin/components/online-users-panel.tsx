/**
 * @file features/admin/components/online-users-panel.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (online-users-panel)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on shared/types/admin, shared/lib/utils, features/admin/config
 */

'use client'

import type { OnlineUser } from '@/shared/types/admin'
import { cn } from '@/shared/lib/utils'
import { ADMIN_ONLINE_USERS_COPY } from '@/features/admin/config'

const statusStyles = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  offline: 'bg-slate-300',
}

export function OnlineUsersPanel({ users }: { users: OnlineUser[] }) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {ADMIN_ONLINE_USERS_COPY.empty}
      </p>
    )
  }

  return (
    <div className="space-y-1 max-h-[420px] overflow-y-auto">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-slate-50"
        >
          <span
            className={cn('h-2.5 w-2.5 shrink-0 rounded-full', statusStyles[user.status])}
            title={ADMIN_ONLINE_USERS_COPY[user.status]}
            aria-label={ADMIN_ONLINE_USERS_COPY[user.status]}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.role}
              {user.currentPage ? ` · ${user.currentPage}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-end">
            <p className="text-xs text-muted-foreground">{ADMIN_ONLINE_USERS_COPY[user.status]}</p>
            {user.lastSeen ? (
              <p className="text-[11px] text-slate-400 tabular-nums">{user.lastSeen}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
