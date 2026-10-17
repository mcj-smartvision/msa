/**
 * @file features/site-report/lib/section-visibility.ts
 * @purpose تشخیص بخش‌های خالی برای چاپ / ارسال تمیز
 * @safe-to-edit YES
 * @affects چاپ A4 و UI
 * @depends-on features/site-report/lib/types, features/site-report/config
 */

import { SITE_REPORT_EVENT_SECTIONS } from '@/features/site-report/config'
import type { LipartaDailyReportData, SiteReportSectionId } from '@/features/site-report/lib/types'

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasNum(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isSiteReportSectionEmpty(
  report: LipartaDailyReportData,
  section: SiteReportSectionId
): boolean {
  switch (section) {
    case 'header':
      return !hasText(report.header.project_name) && !hasText(report.header.report_no)
    case 'weather': {
      const w = report.weather
      return (
        !hasText(w.condition) &&
        !hasText(w.location_name) &&
        !hasText(w.morning_condition) &&
        !hasText(w.noon_condition) &&
        !hasText(w.evening_condition) &&
        !hasNum(w.min_temp_c) &&
        !hasNum(w.max_temp_c) &&
        !hasNum(w.lost_hours) &&
        !hasText(w.notes) &&
        w.impact_level === 'بدون اثر'
      )
    }
    case 'crews_and_progress':
      return report.crews_and_progress.length === 0
    case 'staff_headcount': {
      const s = report.staff_headcount
      return !hasNum(s.client_staff) && !hasNum(s.consultant_staff) && !hasNum(s.contractor_staff) && !hasNum(s.site_hq_staff)
    }
    case 'equipment':
      return report.equipment.length === 0
    case 'materials': {
      const m = report.materials
      return m.received.length === 0 && m.consumed.length === 0 && m.shortages.length === 0
    }
    case 'work_summary': {
      const w = report.work_summary
      return (
        w.completed_activities.length === 0 &&
        w.ongoing_activities.length === 0 &&
        w.unexecuted_planned_tasks.length === 0 &&
        w.out_of_plan_tasks.length === 0
      )
    }
    case 'quality_control':
      return report.quality_control.length === 0
    case 'site_visits_and_directives':
      return report.site_visits_and_directives.length === 0
    case 'hse': {
      const h = report.hse
      return (
        h.accidents.length === 0 &&
        h.near_misses.length === 0 &&
        !h.toolbox_talk.held &&
        h.safety_warnings.length === 0 &&
        !h.work_stopped_by_hse &&
        (h.photo_urls?.length ?? 0) === 0
      )
    }
    case 'delays_and_blockers':
      return report.delays_and_blockers.length === 0
    case 'special_project_items': {
      const s = report.special_project_items
      return (
        !hasText(s.geotechnical_monitoring) &&
        !hasText(s.neighbor_issues) &&
        !hasText(s.municipal_and_utility_permits) &&
        !hasText(s.rfis_and_design_changes) &&
        !hasText(s.subcontractor_entries_exits)
      )
    }
    case 'tomorrow_plan':
      return (
        report.tomorrow_plan.planned_activities.length === 0 &&
        !hasText(report.tomorrow_plan.required_manpower_and_equipment) &&
        !hasText(report.tomorrow_plan.required_materials) &&
        !hasText(report.tomorrow_plan.anticipated_blockers) &&
        !hasText(report.tomorrow_plan.procurement_or_tech_office_requests)
      )
    case 'attached_photos':
      return report.attached_photos.length === 0
    case 'free_notes':
      return !hasText(report.free_notes)
    default:
      return true
  }
}

/** Sections to render on clean A4 print (skips empty event / optional tables). */
export function sectionsForPrint(report: LipartaDailyReportData): SiteReportSectionId[] {
  const always: SiteReportSectionId[] = [
    'header',
    'weather',
    'crews_and_progress',
    'staff_headcount',
    'equipment',
    'materials',
    'work_summary',
    'tomorrow_plan',
    'attached_photos',
    'free_notes',
  ]
  const event = SITE_REPORT_EVENT_SECTIONS
  return [...always, ...event].filter((id) => !isSiteReportSectionEmpty(report, id))
}
