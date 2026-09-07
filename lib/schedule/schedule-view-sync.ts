'use client'

import { useCallback, useEffect, useRef } from 'react'

const SYNC_KEY = 'msa-schedule-view-sync'
const SYNC_EVENT = 'msa-schedule-sync'

export type ScheduleViewSyncPayload = {
  projectId: string
  at: number
}

/** Call after date/float are persisted so برنامه ↔ گانت refresh without full page reload. */
export function publishScheduleViewSync(projectId: string) {
  if (typeof window === 'undefined' || !projectId) return
  const payload: ScheduleViewSyncPayload = { projectId, at: Date.now() }
  try {
    sessionStorage.setItem(SYNC_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: payload }))
}

/**
 * Reloads when another view publishes sync for the same project,
 * when the workshop tab becomes active, and on window focus.
 */
export function useScheduleViewSync(
  projectId: string,
  onSync: () => void,
  options?: { active?: boolean }
) {
  const lastHandledAt = useRef(0)
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync
  const active = options?.active !== false

  const handlePayload = useCallback(
    (payload: ScheduleViewSyncPayload | null, force = false) => {
      if (!payload || payload.projectId !== projectId) return
      if (!force && payload.at <= lastHandledAt.current) return
      lastHandledAt.current = payload.at
      onSyncRef.current()
    },
    [projectId]
  )

  useEffect(() => {
    if (!projectId) return

    const onCustom = (e: Event) => {
      handlePayload((e as CustomEvent<ScheduleViewSyncPayload>).detail ?? null)
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== SYNC_KEY || !e.newValue) return
      try {
        handlePayload(JSON.parse(e.newValue) as ScheduleViewSyncPayload)
      } catch {
        /* ignore */
      }
    }

    const consumeStored = (force = false) => {
      try {
        const raw = sessionStorage.getItem(SYNC_KEY)
        if (!raw) return
        handlePayload(JSON.parse(raw) as ScheduleViewSyncPayload, force)
      } catch {
        /* ignore */
      }
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      consumeStored()
    }

    consumeStored()

    window.addEventListener(SYNC_EVENT, onCustom)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.removeEventListener(SYNC_EVENT, onCustom)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [projectId, handlePayload])

  // When this tab becomes visible again, always reload from server
  useEffect(() => {
    if (!projectId || !active) return
    onSyncRef.current()
  }, [projectId, active])
}
