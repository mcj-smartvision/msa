import type { SupabaseClient } from '@supabase/supabase-js'
import type {
ChecklistItem,
InspectionStatus,
LabTestRecord,
NcrRecord,
NcrStatus,
QcKpis,
QualityInspection,
} from '@/features/qc/lib/types'
import { computeQcKpis, DEFAULT_CHECKLIST, taskToPendingInspection } from '@/features/qc/lib/types'
import type { ProjectTask } from '@/shared/types/schedule'
import { fetchProjectTasksForWeek } from '@/features/schedule/services/schedule'

function nextNcrNumber(existing: NcrRecord[]): string {
  const max = existing.reduce((n, r) => {
    const num = parseInt(r.ncrNumber.replace(/\D/g, ''), 10)
    return Number.isFinite(num) ? Math.max(n, num) : n
  }, 0)
  return `NCR-${String(max + 1).padStart(4, '0')}`
}

async function fetchInspectionRows(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('qc_inspections')
    .select('*, project_tasks(name, wbs_code)')
    .eq('project_id', projectId)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }
  return data ?? []
}

async function fetchNcrRows(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('qc_ncrs')
    .select('*, project_tasks(name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }
  return data ?? []
}

async function fetchLabTestRows(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('qc_lab_tests')
    .select('*')
    .eq('project_id', projectId)
    .order('test_date', { ascending: false })
    .limit(50)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }
  return data ?? []
}

function rowToInspection(row: Record<string, unknown>, task?: ProjectTask): QualityInspection {
  const taskJoin = row.project_tasks as { name?: string; wbs_code?: string } | null
  return {
    id: String(row.id),
    activityId: String(row.schedule_activity_id),
    activityName: task?.name ?? taskJoin?.name ?? 'Activity',
    wbsCode: task?.wbs_code ?? taskJoin?.wbs_code ?? '—',
    location: task?.wbs_code ?? taskJoin?.wbs_code ?? 'Site',
    status: row.status as InspectionStatus,
    priority: row.priority as QualityInspection['priority'],
    checklistResults: (row.checklist_results as ChecklistItem[]) ?? [],
    comments: row.comments ? String(row.comments) : undefined,
    inspectedAt: row.inspected_at ? String(row.inspected_at) : undefined,
    plannedDate: task ? (task.finish_current ?? task.finish_planned)?.slice(0, 10) : undefined,
  }
}

function rowToNcr(row: Record<string, unknown>): NcrRecord {
  const taskJoin = row.project_tasks as { name?: string } | null
  return {
    id: String(row.id),
    ncrNumber: String(row.ncr_number),
    title: String(row.title),
    relatedActivity: taskJoin?.name,
    severity: row.severity as NcrRecord['severity'],
    status: row.status as NcrStatus,
    aiGeneratedOfficialText: String(row.ai_generated_text ?? ''),
    formalText: row.formal_text ? String(row.formal_text) : undefined,
    correctiveActionRequired: row.corrective_action ? String(row.corrective_action) : undefined,
    createdAt: String(row.created_at),
  }
}

function rowToLabTest(row: Record<string, unknown>): LabTestRecord {
  return {
    id: String(row.id),
    testType: row.test_type as LabTestRecord['testType'],
    sampleId: String(row.sample_id),
    testDate: String(row.test_date).slice(0, 10),
    location: String(row.location ?? ''),
    requiredValue: Number(row.required_value),
    actualValue: Number(row.actual_value),
    unit: String(row.unit ?? 'MPa'),
    pass: Boolean(row.pass),
    remarks: row.remarks ? String(row.remarks) : undefined,
  }
}

export async function loadQcDashboard(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  inspections: QualityInspection[]
  ncrs: NcrRecord[]
  labTests: LabTestRecord[]
  kpis: QcKpis
}> {
  const [weekTasks, inspectionRows, ncrRows, labRows] = await Promise.all([
    fetchProjectTasksForWeek(supabase, projectId),
    fetchInspectionRows(supabase, projectId),
    fetchNcrRows(supabase, projectId),
    fetchLabTestRows(supabase, projectId),
  ])

  const taskMap = new Map(weekTasks.map((t) => [t.id, t]))
  const savedByActivity = new Map(
    inspectionRows.map((r) => [String(r.schedule_activity_id), r as Record<string, unknown>])
  )

  const inspections: QualityInspection[] = weekTasks.map((task) => {
    const saved = savedByActivity.get(task.id)
    if (saved) return rowToInspection(saved, task)
    return taskToPendingInspection(task)
  })

  for (const row of inspectionRows) {
    const activityId = String(row.schedule_activity_id)
    if (!taskMap.has(activityId)) {
      inspections.push(rowToInspection(row as Record<string, unknown>))
    }
  }

  const ncrs = ncrRows.map((r) => rowToNcr(r as Record<string, unknown>))
  const labTests = labRows.map((r) => rowToLabTest(r as Record<string, unknown>))
  const kpis = computeQcKpis(inspections, ncrs, labTests)

  return { inspections, ncrs, labTests, kpis }
}

export async function saveInspectionResult(
  supabase: SupabaseClient,
  params: {
    projectId: string
    activityId: string
    inspectorId: string
    status: InspectionStatus
    priority: QualityInspection['priority']
    checklistResults: ChecklistItem[]
    comments?: string
  }
): Promise<void> {
  const { error } = await supabase.from('qc_inspections').upsert(
    {
      project_id: params.projectId,
      schedule_activity_id: params.activityId,
      status: params.status,
      priority: params.priority,
      checklist_results: params.checklistResults,
      comments: params.comments ?? null,
      inspector_id: params.inspectorId,
      inspected_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,schedule_activity_id' }
  )

  if (error) throw new Error(error.message)
}

export async function generateNcrDraft(
  supabase: SupabaseClient,
  params: {
    projectId: string
    userId: string
    title: string
    description: string
    relatedTaskId?: string
    severity?: NcrRecord['severity']
    locale?: 'fa' | 'en'
  }
): Promise<NcrRecord> {
  const existing = await fetchNcrRows(supabase, params.projectId)
  const ncrNumber = nextNcrNumber(existing.map((r) => rowToNcr(r as Record<string, unknown>)))
  const fa = (params.locale ?? 'fa') === 'fa'

  const aiText = fa
    ? `گزارش عدم انطباق (NCR)\n\nعنوان: ${params.title}\n\nشرح:\n${params.description}\n\nاقدام اصلاحی پیشنهادی:\n- توقف کار در محدوده مربوطه تا رفع نقص\n- بازبینی مطابق نقشه و مشخصات فنی\n- اطلاع‌رسانی به پیمانکار مسئول\n\n— مهندس QC`
    : `Non-Conformance Report (NCR)\n\nTitle: ${params.title}\n\nDescription:\n${params.description}\n\nRecommended corrective actions:\n- Hold work in affected area until deficiency is resolved\n- Re-inspect per drawings and specifications\n- Notify responsible subcontractor\n\n— QC Engineer`

  const { data, error } = await supabase
    .from('qc_ncrs')
    .insert({
      project_id: params.projectId,
      ncr_number: ncrNumber,
      title: params.title,
      related_task_id: params.relatedTaskId ?? null,
      severity: params.severity ?? 'medium',
      status: 'draft_by_ai',
      ai_generated_text: aiText,
      created_by: params.userId,
    })
    .select('*, project_tasks(name)')
    .single()

  if (error) throw new Error(error.message)
  return rowToNcr(data as Record<string, unknown>)
}

export async function approveNcrDraft(
  supabase: SupabaseClient,
  ncrId: string,
  userId: string,
  editedText: string,
  correctiveAction?: string
): Promise<void> {
  const { error } = await supabase
    .from('qc_ncrs')
    .update({
      status: 'open',
      formal_text: editedText,
      ai_generated_text: editedText,
      corrective_action: correctiveAction ?? null,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
      pm_status: 'pending',
    })
    .eq('id', ncrId)
    .eq('status', 'draft_by_ai')

  if (error) throw new Error(error.message)
}

export async function rejectNcrDraft(supabase: SupabaseClient, ncrId: string): Promise<void> {
  const { error } = await supabase
    .from('qc_ncrs')
    .update({ status: 'rejected' })
    .eq('id', ncrId)
    .eq('status', 'draft_by_ai')

  if (error) throw new Error(error.message)
}

export async function closeNcr(supabase: SupabaseClient, ncrId: string): Promise<void> {
  const { error } = await supabase.from('qc_ncrs').update({ status: 'closed' }).eq('id', ncrId)

  if (error) throw new Error(error.message)
}

export async function createNcrFromFailedInspection(
  supabase: SupabaseClient,
  params: {
    projectId: string
    userId: string
    activityId: string
    activityName: string
    comments?: string
    locale?: 'fa' | 'en'
  }
): Promise<NcrRecord> {
  return generateNcrDraft(supabase, {
    projectId: params.projectId,
    userId: params.userId,
    title: `Failed inspection — ${params.activityName}`,
    description: params.comments ?? 'Inspection failed — corrective action required.',
    relatedTaskId: params.activityId,
    severity: 'high',
    locale: params.locale,
  })
}

export { DEFAULT_CHECKLIST }
