/**
 * @file features/site-report/lib/empty-report.ts
 * @purpose ساخت اسکلت خالی گزارش ۱۲بخشی
 * @safe-to-edit YES
 * @affects features/site-report
 * @depends-on features/site-report/lib/types
 */

import type { LipartaDailyReportData, SiteReportHeader } from '@/features/site-report/lib/types'

export function emptySiteReportHeader(partial?: Partial<SiteReportHeader>): SiteReportHeader {
  return {
    project_name: partial?.project_name ?? '',
    report_no: partial?.report_no ?? '',
    date_shamsi: partial?.date_shamsi ?? '',
    day_of_week: partial?.day_of_week ?? '',
    day_type: partial?.day_type ?? 'کاری',
    supervisor_name: partial?.supervisor_name ?? '',
    submission_time: partial?.submission_time,
    status: partial?.status ?? 'پیش‌نویس',
  }
}

export function emptyLipartaDailyReport(
  header?: Partial<SiteReportHeader>
): LipartaDailyReportData {
  return {
    header: emptySiteReportHeader(header),
    weather: {
      location_name: null,
      condition: null,
      morning_condition: null,
      noon_condition: null,
      evening_condition: null,
      min_temp_c: null,
      max_temp_c: null,
      impact_level: 'بدون اثر',
      lost_hours: null,
      notes: null,
    },
    crews_and_progress: [],
    staff_headcount: {
      client_staff: null,
      consultant_staff: null,
      contractor_staff: null,
      site_hq_staff: null,
    },
    equipment: [],
    materials: { received: [], consumed: [], shortages: [] },
    work_summary: {
      completed_activities: [],
      ongoing_activities: [],
      unexecuted_planned_tasks: [],
      out_of_plan_tasks: [],
    },
    quality_control: [],
    site_visits_and_directives: [],
    hse: {
      accidents: [],
      near_misses: [],
      toolbox_talk: { held: false, attendees_count: null, topic: null },
      safety_warnings: [],
      work_stopped_by_hse: false,
      photo_urls: [],
    },
    delays_and_blockers: [],
    special_project_items: {
      geotechnical_monitoring: null,
      neighbor_issues: null,
      municipal_and_utility_permits: null,
      rfis_and_design_changes: null,
      subcontractor_entries_exits: null,
    },
    tomorrow_plan: {
      planned_activities: [],
      required_manpower_and_equipment: null,
      required_materials: null,
      anticipated_blockers: null,
      procurement_or_tech_office_requests: null,
    },
    attached_photos: [],
    free_notes: null,
  }
}
