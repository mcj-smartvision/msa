/**
 * @file features/technical-office/components/schedule-send-section.tsx
 * @purpose کامپوننت UI — دفتر فنی (schedule-send-section)
 * @safe-to-edit CAREFUL
 * @affects دفتر فنی
 * @depends-on shared/lib/supabase/server, features/admin/components/schedule-import-panel, features/schedule/lib/msp-import, features/schedule/lib/preview-with-packages, features/schedule/lib/apply-actual-start, features/schedule/lib/predecessor-labels
 */

import { createClient } from '@/shared/lib/supabase/server'
import { ScheduleImportPanel } from '@/features/admin/components/schedule-import-panel'
import { fetchScheduleImports } from '@/features/schedule/lib/msp-import'
import { fetchSchedulePreviewWithPackages } from '@/features/schedule/lib/preview-with-packages'
import { fetchProjectScheduleMeta } from '@/features/schedule/lib/apply-actual-start'
import { fetchTaskPredecessorLabels } from '@/features/schedule/lib/predecessor-labels'

export async function ScheduleSendSection({ projectId }: { projectId: string }) {
  const supabase = createClient()

  const [imports, taskSummary, scheduleMeta, predecessorLabels] = await Promise.all([
    fetchScheduleImports(supabase, projectId),
    fetchSchedulePreviewWithPackages(supabase, projectId),
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
      predecessorLabels={{
        ...predecessorLabels,
        ...(taskSummary.packagePredecessorLabels ?? {}),
      }}
    />
  )
}
