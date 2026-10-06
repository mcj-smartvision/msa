'use client'

import type { OnlineUser } from '@/shared/types/admin'
import { cn } from '@/shared/lib/utils'

const statusStyles = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  offline: 'bg-slate-300',
}

const statusHint = {
  online: 'حاضر',
  idle: 'خارج‌شده امروز',
  offline: 'غایب',
}

export function OnlineUsersPanel({ users }: { users: OnlineUser[] }) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        عضوی برای نمایش حضور وجود ندارد.
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
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <span
              className={cn(
                'absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
                statusStyles[user.status]
              )}
              title={statusHint[user.status]}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {user.role}
              <span className="mx-1.5 text-slate-300">·</span>
              {user.currentPage}
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {user.lastSeen}
          </span>
        </div>
      ))}
    </div>
  )
}
