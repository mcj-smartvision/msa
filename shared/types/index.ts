export interface Project {
  id: string
  name: string
  description?: string | null
  location?: string
  status?: string
  created_at?: string
}

export interface Report {
  id: string
  project_id: string
  image_url: string
  image_storage_path?: string | null
  description?: string | null
  is_finalized?: boolean
  created_by: string
  created_at: string
}

export interface WorkerRole {
  role: string
  count: number
  activity_fa?: string
}

export interface EquipmentItem {
  name: string
  visible: boolean
  usage_fa?: string
}

export type SafetyLevel = 'yes' | 'no' | 'partial' | 'unknown'

export interface SafetyEquipmentAnalysis {
  helmets?: SafetyLevel
  harnesses?: SafetyLevel
  high_visibility_vests?: SafetyLevel
  gloves?: SafetyLevel
  safety_boots?: SafetyLevel
  fall_protection?: SafetyLevel
  missing_or_concerns_fa?: string[]
  overall_safety_rating?: 'good' | 'moderate' | 'poor' | 'unknown'
  notes_fa?: string
}

export interface LightingAnalysis {
  adequate?: boolean
  level?: string
  artificial_light_visible?: boolean
  notes_fa?: string
}

export interface WeatherAirAnalysis {
  weather_apparent?: string
  weather_fa?: string
  visibility?: string
  wind_signs_fa?: string
  air_quality_apparent?: string
  air_quality_fa?: string
  notes_fa?: string
}

export interface ExtendedAnalysis {
  activity_description_fa?: string
  work_being_performed_fa?: string
  safety_equipment?: SafetyEquipmentAnalysis
  time_of_day?: string
  time_of_day_fa?: string
  lighting?: LightingAnalysis
  weather_air?: WeatherAirAnalysis
  risks_observed_fa?: string[]
  supervisor_summary_fa?: string
}

export interface PhotoAnalysis {
  id: string
  report_id: string
  activity_type: string
  workforce_count: number
  worker_roles_json: WorkerRole[]
  equipment_json: EquipmentItem[]
  confidence_score: number | null
  extended_analysis_json?: ExtendedAnalysis | null
  ai_raw_data?: Record<string, unknown> | null
  created_at: string
}

export interface ReportWithAnalysis {
  id: string
  project_id: string
  project_name?: string | null
  image_url: string
  image_storage_path?: string | null
  created_by: string
  created_at: string
  activity_type?: string | null
  workforce_count?: number | null
  worker_roles_json?: WorkerRole[] | null
  equipment_json?: EquipmentItem[] | null
  confidence_score?: number | null
  extended_analysis_json?: ExtendedAnalysis | null
  ai_raw_data?: Record<string, unknown> | null
}

export interface AIAnalysisResponse {
  activity_type: string
  workforce_count: number
  worker_roles_json: WorkerRole[]
  equipment_json: EquipmentItem[]
  confidence_score: number
  extended_analysis_json?: ExtendedAnalysis
  ai_raw_data?: Record<string, unknown>
}

export type SubmitReportStatus =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'saving'
  | 'done'
  | 'error'

export interface SubmitReportState {
  status: SubmitReportStatus
  progress: number
  message: string
  error: string | null
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
