'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { fetchAdminStats, fetchAllMembers } from '@/utils/admin'
import { fetchControlCenterFeeds } from '@/lib/admin/control-center'
import type { AdminStats, ControlCenterFeeds, ProjectMember } from '@/types/admin'

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
  const [feeds, setFeeds] = useState<ControlCenterFeeds>(EMPTY_FEEDS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openDetail, setOpenDetail] = useState<DetailKey | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [statsData, memberData] = await Promise.all([
          fetchAdminStats(supabase),
          fetchAllMembers(supabase),
        ])
        const feedData = await fetchControlCenterFeeds(supabase, memberData)
        if (!cancelled) {
          setStats(statsData)
          setMembers(memberData)
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
      loading,
      error,
      openDetail,
      setOpenDetail,
      toggleDetail: (key) => setOpenDetail((current) => (current === key ? null : key)),
    }),
    [feeds, stats, members, loading, error, openDetail]
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
