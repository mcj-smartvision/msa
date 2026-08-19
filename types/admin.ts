export interface Profile {
  id: string
  email: string
  full_name: string
  phone?: string | null
  contact_email?: string | null
  avatar_url?: string | null
  personnel_code?: string | null
  is_active: boolean
  is_first_login?: boolean
  created_at: string
  updated_at: string
}

export interface SystemRole {
  id: string
  key: string
  title: string
  description?: string | null
  is_active: boolean
}

export interface AdminProject {
  id: string
  name: string
  description?: string | null
  location?: string | null
  code?: string | null
  status: string
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  schedule_baseline_start?: string | null
  schedule_actual_start?: string | null
  schedule_start_aligned?: boolean | null
  created_at?: string
  updated_at?: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  email: string
  full_name: string
  phone?: string | null
  contact_email?: string | null
  personnel_code?: string | null
  is_active: boolean
  invited_at?: string | null
  joined_at?: string | null
  admin_visible_password?: string | null
  password_changed_by_member?: boolean
  created_at: string
  updated_at: string
  positions?: MemberPositionSummary[]
}

export interface MemberPositionSummary {
  id: string
  title: string
  key: string
  is_active: boolean
}

export interface Position {
  id: string
  project_id: string
  title: string
  key: string
  description?: string | null
  name_en?: string | null
  name_fa?: string | null
  name_fr?: string | null
  name_de?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Feature {
  id: string
  key: string
  title: string
  description?: string | null
  module_group?: string | null
  is_active: boolean
}

export interface PositionFeature {
  id: string
  position_id: string
  feature_id: string
  can_view: boolean
  can_edit: boolean
  feature?: Feature
}

export interface EventType {
  id: string
  key: string
  title: string
  description?: string | null
  category?: string | null
  is_active: boolean
}

export interface NotificationRoute {
  id: string
  project_id: string
  event_type_id: string
  position_id: string
  email_enabled: boolean
  is_active: boolean
  event_type?: EventType
  position?: Position
}

export interface DashboardWidget {
  id: string
  key: string
  title: string
  description?: string | null
  default_visible: boolean
  sort_order: number
  is_active: boolean
}

export interface PositionDashboardWidget {
  id: string
  position_id: string
  widget_id: string
  is_visible: boolean
  sort_order: number
  widget?: DashboardWidget
}

export interface CreateProjectInput {
  name: string
  code?: string
  description?: string
  location?: string
  status?: string
  is_active?: boolean
}

export interface CreatePositionInput {
  title: string
  key: string
  description?: string
  is_active?: boolean
}

export interface CreateMemberInput {
  full_name: string
  email: string
  /** Real mailbox for notifications (and preferred login when provided) */
  contact_email?: string
  personnel_code?: string
  phone?: string
  password: string
  is_active?: boolean
  position_ids: string[]
}

export interface UpdateMemberInput {
  full_name?: string
  email?: string
  contact_email?: string | null
  personnel_code?: string | null
  phone?: string
  is_active?: boolean
  position_ids?: string[]
  password?: string
  /** When true and contact_email is real, migrate auth login off @site.local */
  migrateLoginToContactEmail?: boolean
}

export interface NotificationRouteInput {
  event_type_id: string
  position_id: string
  email_enabled: boolean
  is_active?: boolean
}

export interface WidgetVisibilityInput {
  position_id: string
  widget_id: string
  is_visible: boolean
  sort_order?: number
}

export interface DashboardUiBlock {
  id: string
  code: string
  key: string
  kind: string
  dashboard: string
  layer: string
  title_fa: string
  title_en: string
  description_fa: string
  legacy_widget_key?: string | null
  sort_order: number
  default_visible: boolean
  is_active: boolean
}

export interface PositionUiBlockVisibility {
  id: string
  position_id: string
  block_id: string
  is_visible: boolean
  sort_order: number
  block?: DashboardUiBlock
}

export interface UiBlockVisibilityInput {
  position_id: string
  block_id: string
  is_visible: boolean
  sort_order?: number
}

export interface AdminStats {
  projectCount: number
  memberCount: number
  positionCount: number
  activeRouteCount: number
  activeMemberCount?: number
  pendingFirstLoginCount?: number
  roleBreakdown?: { role: string; count: number }[]
}

export interface AdminActivityItem {
  id: string
  user: string
  role: string
  action: string
  section: string
  time: string
  type: 'action' | 'alert' | 'security'
}

export interface OnlineUser {
  id: string
  name: string
  role: string
  email: string
  currentPage: string
  lastSeen: string
  status: 'online' | 'idle' | 'offline'
}

export interface AdminSupportTicket {
  id: string
  subject: string
  user: string
  role: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created: string
  messages: number
  topic?: string
}

export interface AdminCriticalAlert {
  id: string
  title: string
  severity: 'medium' | 'high' | 'critical'
  source: string
  time: string
  projectId?: string | null
}

export interface ControlCenterFeeds {
  activities: AdminActivityItem[]
  presenceUsers: OnlineUser[]
  insideCount: number
  outsideCount: number
  absentCount: number
  tickets: AdminSupportTicket[]
  alerts: AdminCriticalAlert[]
  openMessageCount: number
}
