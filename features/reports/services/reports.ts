import type { SupabaseClient } from '@supabase/supabase-js'
import type { AIAnalysisResponse, ReportWithAnalysis } from '@/shared/types'

export function validateImageFile(file: File): string | null {
  const allowed: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return 'فرمت فایل باید JPEG، PNG یا WebP باشد.'
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'حجم فایل نباید بیشتر از 10 مگابایت باشد.'
  }
  return null
}

export async function uploadReportImage(
  supabase: SupabaseClient,
  file: File,
  projectId: string
): Promise<{ path: string; publicUrl: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${crypto.randomUUID()}.${ext}`
  const path = `${projectId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('project-images')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from('project-images').getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

export async function analyzeReportImage(
  _supabase: SupabaseClient,
  imageUrl: string
): Promise<AIAnalysisResponse> {
  const response = await fetch('/api/analyze-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'AI analysis failed')

  return data as AIAnalysisResponse
}

export async function saveReportWithAnalysis(
  supabase: SupabaseClient,
  params: {
    projectId: string
    imageUrl: string
    storagePath: string
    analysis: AIAnalysisResponse
  }
): Promise<ReportWithAnalysis> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('کاربر احراز هویت نشده است.')

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .insert({
      project_id: params.projectId,
      image_url: params.imageUrl,
      image_storage_path: params.storagePath,
      created_by: user.id,
    })
    .select()
    .single()

  if (reportError) throw new Error(reportError.message)

  const { error: analysisError } = await supabase.from('photo_analysis').insert({
    report_id: report.id,
    activity_type: params.analysis.activity_type,
    workforce_count: params.analysis.workforce_count,
    worker_roles_json: params.analysis.worker_roles_json,
    equipment_json: params.analysis.equipment_json,
    confidence_score: params.analysis.confidence_score,
    extended_analysis_json: params.analysis.extended_analysis_json ?? null,
    ai_raw_data: params.analysis.ai_raw_data ?? params.analysis,
  })

  if (analysisError) {
    await supabase.from('reports').delete().eq('id', report.id)
    throw new Error(analysisError.message)
  }

  return {
    ...report,
    activity_type: params.analysis.activity_type,
    workforce_count: params.analysis.workforce_count,
    worker_roles_json: params.analysis.worker_roles_json,
    equipment_json: params.analysis.equipment_json,
    confidence_score: params.analysis.confidence_score,
    extended_analysis_json: params.analysis.extended_analysis_json,
  }
}

export async function fetchReportsArchive(
  supabase: SupabaseClient,
  projectId?: string
): Promise<ReportWithAnalysis[]> {
  let query = supabase
    .from('v_reports_with_analysis')
    .select('*')
    .order('created_at', { ascending: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as ReportWithAnalysis[]
}

export async function fetchProjects(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, location')
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}
