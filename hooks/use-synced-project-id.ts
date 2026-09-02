'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ALL_PROJECTS_SCOPE,
  readProjectCookie,
} from '@/lib/project/project-cookie'

/**
 * Project id for dashboard pages — synced from server `initialProjectId` (cookie on SSR)
 * and from cookie on navigation (header project switcher).
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

  return projectId
}
