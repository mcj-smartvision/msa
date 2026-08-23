'use client'

import type { AdminCriticalAlert, AdminSupportTicket } from '@/types/admin'
import { cn } from '@/lib/utils'
import { MessageSquare, ShieldCheck } from 'lucide-react'

const priorityStyles = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-800 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
}

const statusStyles = {
  open: 'bg-orange-50 text-orange-700',
  in_progress: 'bg-blue-50 text-blue-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
}

const statusLabels = {
  open: 'فوری',
  in_progress: 'اخیر',
  resolved: 'حل‌شده',
  closed: 'بسته‌شده',
}

const priorityLabels = {
  low: 'کم',
  medium: 'متوسط',
  high: 'بالا',
  critical: 'بحرانی',
}

export function SupportTicketsPanel({ tickets }: { tickets: AdminSupportTicket[] }) {
  if (tickets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        هنوز پیامی ثبت نشده است.
      </p>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="py-3.5 first:pt-0 last:pb-0 transition-colors"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', priorityStyles[ticket.priority])}>
                  {priorityLabels[ticket.priority]}
                </span>
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', statusStyles[ticket.status])}>
                  {statusLabels[ticket.status]}
                </span>
                {ticket.topic ? (
                  <span className="text-xs text-muted-foreground capitalize">{ticket.topic}</span>
                ) : null}
              </div>
              <p className="font-medium text-sm">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {ticket.user} · {ticket.role}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {ticket.messages}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{ticket.created}</p>
        </div>
      ))}
    </div>
  )
}

export function CriticalAlertsPanel({
  alerts,
}: {
  alerts: AdminCriticalAlert[]
}) {
  const severityStyles = {
    medium: 'border-l-amber-500 bg-amber-50/50',
    high: 'border-l-orange-600 bg-orange-50/50',
    critical: 'border-l-red-600 bg-red-50/50',
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-emerald-800">در حال حاضر هشدار حل‌نشده‌ای وجود ندارد.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn('rounded-lg border border-l-4 px-4 py-3', severityStyles[alert.severity])}
        >
          <p className="text-sm font-medium">{alert.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex rounded-md border px-2 py-0.5 text-xs capitalize">
              {alert.source}
            </span>
            <span className="text-xs text-muted-foreground">
              {alert.time === 'now'
                ? 'الان'
                : alert.time === '—'
                  ? alert.time
                  : `${alert.time} پیش`}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
