'use client'

import { useEffect, useState } from 'react'
import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Button } from '@/shared/components/ui/button'
import Link from 'next/link'
import type { AttendanceTransit } from '@/features/attendance/lib/types'

export function EntryExitWidget({ context }: { context: WidgetRenderContext }) {
  const [logs, setLogs] = useState<AttendanceTransit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!context.projectId) {
      setLogs([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/attendance/transit?projectId=${encodeURIComponent(context.projectId)}&limit=8`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'بارگذاری ناموفق بود')
        if (!cancelled) setLogs(json.transits as AttendanceTransit[])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [context.projectId])

  return (
    <WidgetShell
      title="ثبت ورود / خروج"
      description="تردد گیت امروز"
      action={
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/security">باز کردن گیت</Link>
        </Button>
      }
    >
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">پروژه‌ای انتخاب نشده است.</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">هنوز ترددی ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{log.personName || '—'}</p>
                <p className="text-xs text-muted-foreground">{log.gateName || log.source}</p>
              </div>
              <div className="text-right">
                <p
                  className={
                    log.direction === 'IN'
                      ? 'text-emerald-600 font-medium'
                      : 'text-amber-600 font-medium'
                  }
                >
                  {log.direction === 'IN' ? 'ورود' : log.direction === 'OUT' ? 'خروج' : log.direction}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(log.occurredAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  )
}
