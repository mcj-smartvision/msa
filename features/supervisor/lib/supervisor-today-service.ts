import type { SupabaseClient } from '@supabase/supabase-js'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { buildSupervisorTodayActivities } from '@/features/supervisor/lib/build-today-activities'
import { fetchAllProjectTasks } from '@/features/schedule/services/schedule'
import { fetchInventoryItems } from '@/features/storekeeper/services/inventory'
import {
getPackageCumulativeActuals,
getScheduleTree,
listToday,
} from '@/features/workshop/lib/service'

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
