'use client'

import { useCallback, useEffect, useRef } from 'react'

const SYNC_KEY = 'msa-schedule-view-sync'
const SYNC_EVENT = 'msa-schedule-sync'
const DRAFT_KEY = 'msa-schedule-field-drafts'
const DRAFT_EVENT = 'msa-schedule-drafts'

export type ScheduleViewSyncPayload = {
  projectId: string
  at: number
}

export type ScheduleTaskFieldDraft = {
  startDate?: string
  finishDate?: string
  totalFloat?: number | null
  scheduleWeight?: number | null
}

export type ScheduleFieldDraftsPayload = {
  projectId: string
  at: number
  byTaskId: Record<string, ScheduleTaskFieldDraft>
}

/** Call after date/float/weight are persisted so برنامه ↔ گانت / ارسال refresh without full page reload. */
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

/** Live draft overlay from ویرایش برنامه → ارسال برنامه (before ثبت نهایی). */
export function publishScheduleFieldDrafts(
  projectId: string,
  byTaskId: Record<string, ScheduleTaskFieldDraft>
) {
  if (typeof window === 'undefined' || !projectId) return
  const payload: ScheduleFieldDraftsPayload = {
    projectId,
    at: Date.now(),
    byTaskId,
  }
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new CustomEvent(DRAFT_EVENT, { detail: payload }))
}

export function clearScheduleFieldDrafts(projectId: string) {
  if (typeof window === 'undefined' || !projectId) return
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ScheduleFieldDraftsPayload
      if (parsed.projectId === projectId) sessionStorage.removeItem(DRAFT_KEY)
    }
  } catch {
    sessionStorage.removeItem(DRAFT_KEY)
  }
  window.dispatchEvent(
    new CustomEvent(DRAFT_EVENT, {
      detail: { projectId, at: Date.now(), byTaskId: {} } satisfies ScheduleFieldDraftsPayload,
    })
  )
}

export function readScheduleFieldDrafts(projectId: string): Record<string, ScheduleTaskFieldDraft> {
  if (typeof window === 'undefined' || !projectId) return {}
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ScheduleFieldDraftsPayload
    if (parsed.projectId !== projectId) return {}
    return parsed.byTaskId ?? {}
  } catch {
    return {}
  }
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

/** Subscribe to live field drafts from ویرایش برنامه. */
export function useScheduleFieldDrafts(
  projectId: string,
  onDrafts: (byTaskId: Record<string, ScheduleTaskFieldDraft>) => void
) {
  const onDraftsRef = useRef(onDrafts)
  onDraftsRef.current = onDrafts

  useEffect(() => {
    if (!projectId) return

    const apply = (payload: ScheduleFieldDraftsPayload | null) => {
      if (!payload || payload.projectId !== projectId) return
      onDraftsRef.current(payload.byTaskId ?? {})
    }

    apply({
      projectId,
      at: Date.now(),
      byTaskId: readScheduleFieldDrafts(projectId),
    })

    const onCustom = (e: Event) => {
      apply((e as CustomEvent<ScheduleFieldDraftsPayload>).detail ?? null)
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== DRAFT_KEY) return
      if (!e.newValue) {
        apply({ projectId, at: Date.now(), byTaskId: {} })
        return
      }
      try {
        apply(JSON.parse(e.newValue) as ScheduleFieldDraftsPayload)
      } catch {
        /* ignore */
      }
    }

    window.addEventListener(DRAFT_EVENT, onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(DRAFT_EVENT, onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [projectId])
}
