import { createClient } from '@/lib/supabase/server'
import { ScheduleImportPanel } from '@/components/admin/schedule-import-panel'
import { fetchProjectTasksSummary, fetchScheduleImports } from '@/lib/schedule/msp-import'
import { fetchProjectScheduleMeta } from '@/lib/schedule/apply-actual-start'
import { fetchTaskPredecessorLabels } from '@/lib/schedule/predecessor-labels'

export async function ScheduleSendSection({ projectId }: { projectId: string }) {
  const supabase = createClient()

  const [imports, taskSummary, scheduleMeta, predecessorLabels] = await Promise.all([
    fetchScheduleImports(supabase, projectId),
    fetchProjectTasksSummary(supabase, projectId),
    fetchProjectScheduleMeta(supabase, projectId),
    fetchTaskPredecessorLabels(supabase, projectId),
  ])

  return (
    <ScheduleImportPanel
      projectId={projectId}
      initialImports={imports}
      taskCount={taskSummary.count}
      previewTasks={taskSummary.tasks}
      scheduleBaselineStart={scheduleMeta.schedule_baseline_start}
      scheduleActualStart={scheduleMeta.schedule_actual_start}
      predecessorLabels={predecessorLabels}
    />
  )
}
