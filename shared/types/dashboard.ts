import type { AdminProject, MemberPositionSummary } from '@/shared/types/admin'
import type { SiteRoleKey } from '@/shared/lib/dashboard/roles'

export interface DashboardUserContext {
  userId: string
  email: string
  fullName: string
  isFirstLogin: boolean
  isSystemAdmin: boolean
  primaryRole: SiteRoleKey | null
  positionKeys: string[]
  projects: DashboardProjectContext[]
  activeProjectId: string | null
}

export interface DashboardProjectContext {
  project: AdminProject
  memberId: string
  positions: MemberPositionSummary[]
}

export interface WidgetRenderContext {
  user: DashboardUserContext
  projectId: string | null
}

export interface DailyReportDraft {
  projectId: string
  description: string
  imageFile: File | null
  imagePreviewUrl: string | null
  activityType: string
  workforceCount: number
  supervisorSummary: string
  imageUrl: string | null
  storagePath: string | null
}

export type DailyReportStep = 'compose' | 'review' | 'done'
