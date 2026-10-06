import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import {
buildDependencyNetwork,
type DependencyNetworkLink,
type DependencyNetworkTask,
} from '@/features/schedule/lib/dependency-network'
import { DEFAULT_MSP_MINUTES_PER_DAY } from '@/features/schedule/lib/predecessor-format'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import type { TaskRelationType } from '@/shared/types/schedule'

function taskDates(row: Record<string, unknown>): { start: string | null; finish: string | null } {
  return {
    start: toIsoDateOnly(
      (row.start_current as string) ?? (row.start_planned as string) ?? null
    ),
    finish: toIsoDateOnly(
      (row.finish_current as string) ?? (row.finish_planned as string) ?? null
    ),
  }
}

/** GET /api/schedule/dependency-network?projectId=... */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const [{ data: tasks, error: tasksError }, { data: deps, error: depsError }] = await Promise.all([
      supabase
        .from('project_tasks')
        .select(
          'id, name, wbs_code, is_summary, start_planned, finish_planned, start_current, finish_current'
        )
        .eq('project_id', projectId)
        .order('wbs_code', { ascending: true }),
      supabase
        .from('task_dependencies')
        .select('predecessor_task_id, successor_task_id, relation_type, lag_duration')
        .eq('project_id', projectId),
    ])

    if (tasksError) throw new WorkshopError('VALIDATION', tasksError.message)
    if (depsError && depsError.code !== '42P01') {
      throw new WorkshopError('VALIDATION', depsError.message)
    }

    const networkTasks: DependencyNetworkTask[] = (tasks ?? []).map((row) => {
      const dates = taskDates(row as Record<string, unknown>)
      return {
        id: String(row.id),
        wbs: (row.wbs_code as string | null)?.trim() || null,
        name: String(row.name ?? ''),
        start: dates.start,
        finish: dates.finish,
        isSummary: Boolean(row.is_summary),
      }
    })

    const dayLen = DEFAULT_MSP_MINUTES_PER_DAY
    const links: DependencyNetworkLink[] = (deps ?? []).map((dep) => {
      const lagMin = Number(dep.lag_duration) || 0
      return {
        fromId: String(dep.predecessor_task_id),
        toId: String(dep.successor_task_id),
        relation: ((dep.relation_type as TaskRelationType) || 'FS') as TaskRelationType,
        lagDays: lagMin && dayLen > 0 ? Math.round(lagMin / dayLen) : 0,
      }
    })

    const network = buildDependencyNetwork(networkTasks, links)
    return NextResponse.json(network, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
