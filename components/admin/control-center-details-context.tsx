'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { fetchAdminProjects, fetchAdminStats, fetchAllMembers } from '@/utils/admin'
import { fetchControlCenterFeeds } from '@/lib/admin/control-center'
import { ALL_PROJECTS_SCOPE, writeProjectCookie } from '@/lib/project/project-cookie'
import type { AdminProject, AdminStats, ControlCenterFeeds, ProjectMember } from '@/types/admin'

export type DetailKey =
  | 'messages'
  | 'alerts'
  | 'roles'
  | 'dashboards'
  | 'activity'
  | 'presence'

const EMPTY_FEEDS: ControlCenterFeeds = {
  activities: [],
  presenceUsers: [],
  insideCount: 0,
  outsideCount: 0,
  absentCount: 0,
  tickets: [],
  alerts: [],
  openMessageCount: 0,
}

type ControlCenterDetailsValue = {
  feeds: ControlCenterFeeds
  stats: AdminStats | null
  members: ProjectMember[]
  projects: AdminProject[]
  scope: string
  setScope: (scope: string) => void
  loading: boolean
  error: string | null
  openDetail: DetailKey | null
  toggleDetail: (key: DetailKey) => void
  setOpenDetail: (key: DetailKey | null) => void
}

const ControlCenterDetailsContext = createContext<ControlCenterDetailsValue | null>(null)

export function ControlCenterDataProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [feeds, setFeeds] = useState<ControlCenterFeeds>(EMPTY_FEEDS)
  const [scope, setScopeState] = useState(ALL_PROJECTS_SCOPE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openDetail, setOpenDetail] = useState<DetailKey | null>(null)

  const setScope = useCallback((next: string) => {
    setScopeState(next)
    if (next !== ALL_PROJECTS_SCOPE) writeProjectCookie(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [statsData, memberData, projectData] = await Promise.all([
          fetchAdminStats(supabase),
          fetchAllMembers(supabase),
          fetchAdminProjects(supabase),
        ])
        const feedData = await fetchControlCenterFeeds(supabase, memberData)
        if (!cancelled) {
          setStats(statsData)
          setMembers(memberData)
          setProjects(projectData)
          setFeeds(feedData)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری داشبورد ناموفق بود')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const value = useMemo<ControlCenterDetailsValue>(
    () => ({
      feeds,
      stats,
      members,
      projects,
      scope,
      setScope,
      loading,
      error,
      openDetail,
      setOpenDetail,
      toggleDetail: (key) => setOpenDetail((current) => (current === key ? null : key)),
    }),
    [feeds, stats, members, projects, scope, setScope, loading, error, openDetail]
  )

  return (
    <ControlCenterDetailsContext.Provider value={value}>
      {children}
    </ControlCenterDetailsContext.Provider>
  )
}

export function useControlCenterDetails() {
  const ctx = useContext(ControlCenterDetailsContext)
  if (!ctx) throw new Error('useControlCenterDetails requires ControlCenterDataProvider')
  return ctx
}

export function useControlCenterDetailsOptional() {
  return useContext(ControlCenterDetailsContext)
}
