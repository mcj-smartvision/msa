/**
 * @file features/project-store/use-project-store-sync.ts
 * @purpose ماژول — ذخیره پیشرفت و overlay اعداد داشبورد (use-project-store-sync)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on features/schedule/lib/schedule-view-sync
 */

'use client'

import { useEffect } from 'react'
import { useScheduleViewSync } from '@/features/schedule/lib/schedule-view-sync'
import { recomputeProjectStore, useProjectStore } from './use-project-store'

let hydrated = false

/**
 * Keeps the project store on `projectId`: restores unsaved drafts once, loads the snapshot, follows the
 * clock (Thursday 16:00 unlock, day change) and reloads when another view saves schedule or progress.
 */
export function useProjectStoreSync(projectId: string | null) {
  useEffect(() => {
    if (hydrated) return
    hydrated = true
    void Promise.resolve(useProjectStore.persist.rehydrate()).then(recomputeProjectStore)
  }, [])

  useEffect(() => {
    void useProjectStore.getState().loadProject(projectId)
  }, [projectId])

  useEffect(() => {
    const timer = window.setInterval(() => useProjectStore.getState().tick(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!projectId) return
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail
      if (!detail?.projectId || detail.projectId === projectId) useProjectStore.getState().reloadLocalEntries()
    }
    window.addEventListener('sitepilot-daily-progress-updated', onLocal)
    return () => window.removeEventListener('sitepilot-daily-progress-updated', onLocal)
  }, [projectId])

  useScheduleViewSync(projectId ?? '', () => {
    if (!useProjectStore.getState().syncing) void useProjectStore.getState().refresh({ ifOlderThanMs: 3000 })
  })
}
