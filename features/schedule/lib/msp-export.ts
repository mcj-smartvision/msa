import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectTask, TaskDependency, TaskRelationType } from '@/shared/types/schedule'
import {
MSP_SCHEDULE_WEIGHT_FIELD_ID,
MSP_SCHEDULE_WEIGHT_FIELD_NAME,
} from '@/features/schedule/lib/msp-weight'

const REL_TO_MSP: Record<TaskRelationType, number> = {
  FF: 0,
  FS: 1,
  SF: 2,
  SS: 3,
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mspDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const day = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  return `${day}T08:00:00`
}

function formatScheduleWeightXml(weight: number | null | undefined): string {
  if (weight == null || !Number.isFinite(weight)) return ''
  const value = Number.isInteger(weight) ? String(weight) : weight.toFixed(4).replace(/\.?0+$/, '')
  return `<ExtendedAttribute><FieldID>${MSP_SCHEDULE_WEIGHT_FIELD_ID}</FieldID><FieldName>${MSP_SCHEDULE_WEIGHT_FIELD_NAME}</FieldName><Value>${value}</Value></ExtendedAttribute>`
}

const PROJECT_WEIGHT_FIELD_DEF = `<ExtendedAttribute><FieldID>${MSP_SCHEDULE_WEIGHT_FIELD_ID}</FieldID><FieldName>${MSP_SCHEDULE_WEIGHT_FIELD_NAME}</FieldName><Alias>${MSP_SCHEDULE_WEIGHT_FIELD_NAME}</Alias></ExtendedAttribute>`

export function buildMspXmlFromSchedule(
  projectName: string,
  tasks: ProjectTask[],
  dependencies: TaskDependency[]
): string {
  const depsBySuccessor = new Map<string, TaskDependency[]>()
  for (const dep of dependencies) {
    const list = depsBySuccessor.get(dep.successor_task_id) ?? []
    list.push(dep)
    depsBySuccessor.set(dep.successor_task_id, list)
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]))

  const taskXml = tasks
    .filter((t) => t.msp_uid != null)
    .sort((a, b) => (a.msp_uid ?? 0) - (b.msp_uid ?? 0))
    .map((task) => {
      const uid = task.msp_uid!
      const links = (depsBySuccessor.get(task.id) ?? [])
        .map((dep) => {
          const pred = taskById.get(dep.predecessor_task_id)
          const predUid = pred?.msp_uid ?? 0
          if (predUid <= 0) return ''
          return `<PredecessorLink><PredecessorUID>${predUid}</PredecessorUID><Type>${REL_TO_MSP[dep.relation_type]}</Type><LinkLag>${dep.lag_duration * 10}</LinkLag></PredecessorLink>`
        })
        .join('')

      const start = mspDateTime(task.baseline_start ?? task.start_planned)
      const finish = mspDateTime(task.baseline_finish ?? task.finish_planned)
      const wbs = task.wbs_code
        ? `<OutlineNumber>${escapeXml(task.wbs_code)}</OutlineNumber><WBS>${escapeXml(task.wbs_code)}</WBS>`
        : ''

      const weightXml = formatScheduleWeightXml(task.schedule_weight)

      const summaryXml = task.is_summary ? '<Summary>1</Summary>' : ''
      return `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${escapeXml(task.name)}</Name>${summaryXml}${wbs}<Start>${start}</Start><Finish>${finish}</Finish><PercentComplete>${Math.round(task.percent_complete)}</PercentComplete><Critical>${task.is_critical ? 1 : 0}</Critical>${weightXml}${links}</Task>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?><Project><Name>${escapeXml(projectName)}</Name><MinutesPerDay>480</MinutesPerDay><ExtendedAttributes>${PROJECT_WEIGHT_FIELD_DEF}</ExtendedAttributes><Tasks>${taskXml}</Tasks></Project>`
}

export async function exportMspXmlFromProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ xml: string; fileName: string }> {
  const [{ data: project }, { data: tasks, error: tasksError }, { data: deps, error: depsError }] =
    await Promise.all([
      supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
      supabase.from('project_tasks').select('*').eq('project_id', projectId),
      supabase.from('task_dependencies').select('*').eq('project_id', projectId),
    ])

  if (tasksError) throw new Error(tasksError.message)
  if (depsError) throw new Error(depsError.message)

  const rows = (tasks ?? []) as ProjectTask[]
  if (rows.length === 0) {
    throw new Error('برنامه زمان‌بندی برای این پروژه وجود ندارد.')
  }

  const { data: latestImport } = await supabase
    .from('schedule_imports')
    .select('file_name')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const projectName = String(project?.name ?? 'Project')
  const fileName = latestImport?.file_name ?? `${projectName}-schedule.xml`
  const xml = buildMspXmlFromSchedule(
    projectName,
    rows,
    (deps ?? []) as TaskDependency[]
  )

  return { xml, fileName }
}
