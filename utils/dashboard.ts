import type { SupabaseClient } from '@supabase/supabase-js'
import { getWidgetsForRole } from '@/lib/dashboard/roles'
import type { SiteRoleKey } from '@/lib/dashboard/roles'
import type { DashboardWidget } from '@/types/admin'

interface WidgetAssignmentRow {
  is_visible: boolean
  widget: { key: string; is_active: boolean; sort_order: number } | { key: string; is_active: boolean; sort_order: number }[] | null
}

function normalizeWidget(
  widget: WidgetAssignmentRow['widget']
): { key: string; is_active: boolean; sort_order: number } | null {
  if (!widget) return null
  if (Array.isArray(widget)) return widget[0] ?? null
  return widget
}

export async function resolveVisibleWidgetKeys(
  supabase: SupabaseClient,
  _projectId: string,
  positionIds: string[],
  primaryRole: SiteRoleKey | null
): Promise<string[]> {
  const fallback = getWidgetsForRole(primaryRole)

  if (positionIds.length === 0) return fallback

  const { data: assignments, error } = await supabase
    .from('position_dashboard_widgets')
    .select('is_visible, widget:dashboard_widgets(key, is_active, sort_order)')
    .in('position_id', positionIds)

  if (error || !assignments?.length) {
    return fallback
  }

  const visibleFromDb = (assignments as unknown as WidgetAssignmentRow[])
    .filter((row) => {
      const widget = normalizeWidget(row.widget)
      return row.is_visible && widget?.is_active
    })
    .map((row) => normalizeWidget(row.widget)!.key)

  if (visibleFromDb.length === 0) {
    return fallback
  }

  const { data: allWidgets } = await supabase
    .from('dashboard_widgets')
    .select('key, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  const orderMap = new Map((allWidgets ?? []).map((w: DashboardWidget) => [w.key, w.sort_order]))
  const roleAllowed = new Set(fallback)

  const widgetKeys = [...new Set(visibleFromDb)]
    .filter((key) => roleAllowed.has(key) || primaryRole === 'project_manager')
    .sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999))

  return widgetKeys
}

export async function fetchDashboardStats(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ reportCount: number; memberCount: number; recentReports: number }> {
  const [reports, members] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('project_members').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('is_active', true),
  ])

  return {
    reportCount: reports.count ?? 0,
    memberCount: members.count ?? 0,
    recentReports: reports.count ?? 0,
  }
}
