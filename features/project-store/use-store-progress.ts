/**
 * @file features/project-store/use-store-progress.ts
 * @purpose ماژول — ذخیره پیشرفت و overlay اعداد داشبورد (use-store-progress)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on features/project-store/use-project-store, features/project-store/use-project-store-sync, features/supervisor/lib/daily-report-activities
 */

'use client'

import { useMemo } from 'react'
import { useProjectStore } from '@/features/project-store/use-project-store'
import { useProjectStoreSync } from '@/features/project-store/use-project-store-sync'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { dailyReportActivityLookupIds } from '@/features/supervisor/lib/daily-report-activities'

/** Live progress of `projectId` from the shared store (saved reports + unsaved drafts). */
export function useStoreProgress(projectId: string | null) {
  useProjectStoreSync(projectId)
  const ready = useProjectStore((s) => Boolean(projectId) && s.snapshot?.projectId === projectId)
  const entries = useProjectStore((s) => s.entries)
  const tasks = useProjectStore((s) => s.tasks)

  const percents = useMemo(() => {
    const map = new Map<string, number>()
    if (!ready) return map
    for (const t of Object.values(tasks)) {
      map.set(t.id, t.actual_progress)
      const colon = t.id.indexOf(':')
      if (colon >= 0) map.set(t.id.slice(colon + 1), t.actual_progress)
    }
    return map
  }, [ready, tasks])

  return {
    ready,
    entries: ready ? entries : null,
    percents,
  }
}

/** Reloads the store after progress was written outside store actions (quick report, catch-up, …). */
export function refreshProjectStore() {
  const { projectId, refresh } = useProjectStore.getState()
  if (projectId) void refresh()
}

export function storePercentOf(
  percents: Map<string, number>,
  activityId: string | null | undefined,
  fallback?: number | null
): number | null {
  if (activityId) {
    for (const key of dailyReportActivityLookupIds(activityId)) {
      const value = percents.get(key)
      if (value != null) return value
    }
  }
  if (fallback == null || !Number.isFinite(Number(fallback))) return null
  return Number(fallback)
}

export function withStoreEntries(
  storeEntries: DailyProgressEntry[] | null,
  fallback: DailyProgressEntry[]
): DailyProgressEntry[] {
  return storeEntries ?? fallback
}
