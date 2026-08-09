import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/admin/shared'
import { ScheduleImportPanel } from '@/components/admin/schedule-import-panel'
import { fetchProjectTasksSummary, fetchScheduleImports } from '@/lib/schedule/msp-import'
import { fetchProjectScheduleMeta } from '@/lib/schedule/apply-actual-start'
import { fetchTaskPredecessorLabels } from '@/lib/schedule/predecessor-labels'

export default async function ProjectSchedulePage({ params }: { params: { projectId: string } }) {
  const supabase = createClient()

  const [imports, taskSummary, scheduleMeta, predecessorLabels] = await Promise.all([
    fetchScheduleImports(supabase, params.projectId),
    fetchProjectTasksSummary(supabase, params.projectId),
    fetchProjectScheduleMeta(supabase, params.projectId),
    fetchTaskPredecessorLabels(supabase, params.projectId),
  ])

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="برنامه زمان‌بندی"
        description="فایل MSP XML را وارد کنید، شروع پروژه را تأیید کنید و فعالیت‌ها را در تقویم انتخابی ببینید."
      />

      <ScheduleImportPanel
        projectId={params.projectId}
        initialImports={imports}
        taskCount={taskSummary.count}
        previewTasks={taskSummary.tasks}
        scheduleBaselineStart={scheduleMeta.schedule_baseline_start}
        scheduleActualStart={scheduleMeta.schedule_actual_start}
        predecessorLabels={predecessorLabels}
      />
    </div>
  )
}
