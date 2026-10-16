/**
 * @file features/dashboard/components/widgets/entry-exit-widget.tsx
 * @purpose کامپوننت UI — داشبورد نقش‌ها و ویجت‌ها (entry-exit-widget)
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on shared/types/dashboard, features/dashboard/components/widgets/widget-shell, shared/components/ui/button, features/attendance/lib/types
 */

'use client'

import { useEffect, useState } from 'react'
import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Button } from '@/shared/components/ui/button'
import Link from 'next/link'
import type { AttendanceTransit } from '@/features/attendance/lib/types'
import { ENTRY_EXIT_COPY } from '@/features/dashboard/config'
import { COMMON_UI } from '@/shared/lib/i18n/common-ui'

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
        if (!res.ok) throw new Error(json.error || COMMON_UI.loadingFailed)
        if (!cancelled) setLogs(json.transits as AttendanceTransit[])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : COMMON_UI.error)
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
      title={ENTRY_EXIT_COPY.title}
      description={ENTRY_EXIT_COPY.description}
      action={
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/security">{ENTRY_EXIT_COPY.openGate}</Link>
        </Button>
      }
    >
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">{ENTRY_EXIT_COPY.noProject}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{ENTRY_EXIT_COPY.loading}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ENTRY_EXIT_COPY.empty}</p>
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
                  {log.direction === 'IN' ? ENTRY_EXIT_COPY.in : log.direction === 'OUT' ? ENTRY_EXIT_COPY.out : log.direction}
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
