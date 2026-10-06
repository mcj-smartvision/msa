'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
ALL_PROJECTS_SCOPE,
PROJECT_CHANGE_EVENT,
readProjectCookie,
} from '@/shared/lib/project/project-cookie'

/**
 * Project id for dashboard pages — synced from server `initialProjectId` (cookie on SSR),
 * cookie on navigation, and header project switcher.
 */
export function useSyncedProjectId(initialProjectId: string | null) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const pathname = usePathname()

  useEffect(() => {
    setProjectId(initialProjectId)
  }, [initialProjectId])

  useEffect(() => {
    const raw = readProjectCookie()
    const cookieId = raw && raw !== ALL_PROJECTS_SCOPE ? raw : null
    if (cookieId) {
      setProjectId(cookieId)
      return
    }
    if (initialProjectId) setProjectId(initialProjectId)
  }, [pathname, initialProjectId])

  useEffect(() => {
    function onProjectChange(event: Event) {
      const id = (event as CustomEvent<string>).detail
      if (id && id !== ALL_PROJECTS_SCOPE) setProjectId(id)
    }
    window.addEventListener(PROJECT_CHANGE_EVENT, onProjectChange)
    return () => window.removeEventListener(PROJECT_CHANGE_EVENT, onProjectChange)
  }, [])

  return projectId
}
