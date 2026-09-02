import type { SupabaseClient } from '@supabase/supabase-js'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { buildSupervisorTodayActivities } from '@/lib/supervisor/build-today-activities'
import { fetchAllProjectTasks } from '@/utils/schedule'
import { fetchInventoryItems } from '@/utils/storekeeper/inventory'
import {
  getPackageCumulativeActuals,
  getScheduleTree,
  listToday,
} from '@/lib/workshop/service'

export async function getSupervisorTodayActivities(
  supabase: SupabaseClient,
  projectId: string,
  date: string
) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  const [tasks, tree, assignments, cumulative, inventory] = await Promise.all([
    fetchAllProjectTasks(supabase, projectId),
    getScheduleTree(supabase, projectId),
    listToday(supabase, projectId, date),
    getPackageCumulativeActuals(supabase, projectId),
    fetchInventoryItems(supabase, projectId).catch(() => []),
  ])

  const activities = buildSupervisorTodayActivities(
    tasks,
    tree.nodes,
    assignments as Array<{
      id: string
      planned_qty: number
      workshop_packages?: { id?: string; project_task_id?: string | null } | null
    }>,
    cumulative,
    date,
    inventory
  )

  return {
    activities,
    date,
    packageCount: tree.packageCount,
  }
}
