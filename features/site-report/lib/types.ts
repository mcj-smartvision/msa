/**
 * @file features/site-report/lib/types.ts
 * @purpose تایپ‌های گزارش روزانه ۱۲بخشی Liparta (صوتی / ساختاریافته)
 * @safe-to-edit YES
 * @affects features/site-report
 * @depends-on nothing
 */

export type DayTypeFa = 'کاری' | 'تعطیل'
export type ReportStatusFa = 'پیش‌نویس' | 'ارسال‌شده' | 'تأییدشده' | 'آرشیو شده'
export type WeatherImpactFa = 'بدون اثر' | 'کاهش بازده' | 'توقف کامل'
export type ActivityStatusFa = 'شروع شد' | 'در حال انجام' | 'تمام شد' | 'متوقف'
export type EquipmentOwnershipFa = 'ملکی' | 'اجاره‌ای'
export type SuppliedByFa = 'کارفرما' | 'پیمانکار'
export type MaterialUrgencyFa = 'فوری' | 'متوسط' | 'عادی'
export type QcResultFa = 'قبول' | 'رد' | 'مشروط' | 'در انتظار پاسخ'

export type DelayCauseCategoryFa =
  | 'آب‌وهوا'
  | 'تأخیر کارفرما'
  | 'نقص نقشه یا تغییر طرح'
  | 'کمبود مصالح'
  | 'مجوزها و شهرداری'
  | 'قطعی آب و برق'
  | 'معارضین و همسایه‌ها'
  | 'خرابی دستگاه'
  | 'سایر'

export const SITE_VISIT_DISCLAIMER =
  'ثبت گزارش سرپرست کارگاه - فاقد اثر دستور رسمی کارفرما' as const

export type SiteReportHeader = {
  project_name: string
  report_no: string
  date_shamsi: string
  day_of_week: string
  day_type: DayTypeFa
  supervisor_name: string
  submission_time?: string
  status: ReportStatusFa
}

export type SiteReportWeather = {
  /** Live site location name (from weather API) */
  location_name?: string | null
  /** Single current condition — not morning/noon/evening splits */
  condition?: string | null
  /** @deprecated kept for older JSON only — UI no longer collects these */
  morning_condition?: string | null
  noon_condition?: string | null
  evening_condition?: string | null
  min_temp_c?: number | null
  max_temp_c?: number | null
  impact_level: WeatherImpactFa
  lost_hours?: number | null
  notes?: string | null
}

export type SiteReportCrewRow = {
  contractor_or_crew: string
  trade: string
  activity_name: string
  wbs_code?: string | null
  location: {
    floor?: string | null
    zone?: string | null
    axis?: string | null
  }
  headcount: number | null
  regular_hours: number | null
  overtime_hours?: number | null
  work_done_today: {
    quantity: number | null
    unit: string | null
  }
  activity_status: ActivityStatusFa
  idle_hours?: number | null
  idle_reason?: string | null
  photo_urls?: string[]
  requires_completion: boolean
}

export type SiteReportStaffHeadcount = {
  client_staff?: number | null
  consultant_staff?: number | null
  contractor_staff?: number | null
  site_hq_staff?: number | null
}

export type SiteReportEquipmentRow = {
  name_or_code: string
  ownership: EquipmentOwnershipFa
  operator_name?: string | null
  operating_hours: number | null
  idle_hours: number | null
  breakdown_hours: number | null
  breakdown_cause?: string | null
  work_location?: string | null
  fuel_liters?: number | null
}

export type SiteReportMaterialReceived = {
  item_name: string
  quantity: number | null
  unit: string | null
  supplier?: string | null
  waybill_or_invoice_no?: string | null
  truck_plate?: string | null
  supplied_by: SuppliedByFa
}

export type SiteReportMaterialConsumed = {
  item_name: string
  quantity: number | null
  unit: string | null
  location_used?: string | null
}

export type SiteReportMaterialShortage = {
  item_name: string
  required_quantity: number | null
  unit: string | null
  needed_by_date?: string | null
  urgency: MaterialUrgencyFa
}

export type SiteReportMaterials = {
  received: SiteReportMaterialReceived[]
  consumed: SiteReportMaterialConsumed[]
  shortages: SiteReportMaterialShortage[]
}

export type SiteReportWorkSummary = {
  completed_activities: string[]
  ongoing_activities: Array<{ activity: string; cumulative_percent?: number | null }>
  unexecuted_planned_tasks: Array<{ task: string; reason: string }>
  out_of_plan_tasks: string[]
}

export type SiteReportQcRow = {
  test_type: string
  sample_code_and_element?: string | null
  result: QcResultFa
  inspection_request_status?: string | null
  ncr_details?: string | null
}

export type SiteReportVisitRow = {
  visitor_name_and_role: string
  visit_purpose?: string | null
  directive_or_decision: string
  official_letter_required: boolean
  disclaimer: typeof SITE_VISIT_DISCLAIMER
}

export type SiteReportHse = {
  accidents: string[]
  near_misses: string[]
  toolbox_talk: {
    held: boolean
    attendees_count?: number | null
    topic?: string | null
  }
  safety_warnings: string[]
  work_stopped_by_hse: boolean
  photo_urls?: string[]
}

export type SiteReportDelayRow = {
  description: string
  start_time?: string | null
  end_time?: string | null
  affected_activities: string[]
  cause_category: DelayCauseCategoryFa
  lost_hours?: number | null
  lost_man_hours?: number | null
  photo_urls?: string[]
}

export type SiteReportSpecialItems = {
  geotechnical_monitoring?: string | null
  neighbor_issues?: string | null
  municipal_and_utility_permits?: string | null
  rfis_and_design_changes?: string | null
  subcontractor_entries_exits?: string | null
}

export type SiteReportTomorrowPlan = {
  planned_activities: string[]
  required_manpower_and_equipment?: string | null
  required_materials?: string | null
  anticipated_blockers?: string | null
  procurement_or_tech_office_requests?: string | null
}

export type SiteReportAttachedPhoto = {
  url: string
  caption: string
  linked_activity_or_location?: string
}

/** Full 12-section Liparta daily site report (voice + form). */
export type LipartaDailyReportData = {
  header: SiteReportHeader
  weather: SiteReportWeather
  crews_and_progress: SiteReportCrewRow[]
  staff_headcount: SiteReportStaffHeadcount
  equipment: SiteReportEquipmentRow[]
  materials: SiteReportMaterials
  work_summary: SiteReportWorkSummary
  quality_control: SiteReportQcRow[]
  site_visits_and_directives: SiteReportVisitRow[]
  hse: SiteReportHse
  delays_and_blockers: SiteReportDelayRow[]
  special_project_items: SiteReportSpecialItems
  tomorrow_plan: SiteReportTomorrowPlan
  attached_photos: SiteReportAttachedPhoto[]
  free_notes?: string | null
}

export type SiteReportSectionId =
  | 'header'
  | 'weather'
  | 'crews_and_progress'
  | 'staff_headcount'
  | 'equipment'
  | 'materials'
  | 'work_summary'
  | 'quality_control'
  | 'site_visits_and_directives'
  | 'hse'
  | 'delays_and_blockers'
  | 'special_project_items'
  | 'tomorrow_plan'
  | 'attached_photos'
  | 'free_notes'

export type SiteReportActivityRef = {
  id: string
  wbs?: string | null
  name: string
}
