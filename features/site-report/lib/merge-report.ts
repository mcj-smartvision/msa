/**
 * @file features/site-report/lib/merge-report.ts
 * @purpose ادغام تکراری صوت — nullها فیلدهای قبلی را پاک نمی‌کنند
 * @safe-to-edit YES
 * @affects تحلیل صوت گزارش روزانه
 * @depends-on features/site-report/lib/types, features/site-report/lib/empty-report
 */

import { emptyLipartaDailyReport } from '@/features/site-report/lib/empty-report'
import { SITE_VISIT_DISCLAIMER, type LipartaDailyReportData } from '@/features/site-report/lib/types'

function preferScalar<T>(prev: T, next: T): T {
  if (next == null) return prev
  if (typeof next === 'string' && next.trim() === '') return prev
  return next
}

function mergeStringLists(prev: string[], next: unknown): string[] {
  if (!Array.isArray(next)) return prev
  const out = [...prev]
  for (const item of next) {
    const s = String(item ?? '').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

function mergeByKey<T extends Record<string, unknown>>(
  prev: T[],
  next: unknown,
  keyOf: (row: T) => string
): T[] {
  if (!Array.isArray(next)) return prev
  const map = new Map<string, T>()
  for (const row of prev) map.set(keyOf(row), row)
  for (const raw of next) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as T
    const key = keyOf(row)
    if (!key) continue
    const existing = map.get(key)
    map.set(key, existing ? ({ ...existing, ...stripNulls(row) } as T) : row)
  }
  return [...map.values()]
}

function stripNulls<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

/** Deep-merge patch into base without wiping filled fields with null/empty. */
export function mergeLipartaDailyReport(
  base: LipartaDailyReportData,
  patch: Partial<LipartaDailyReportData> | null | undefined
): LipartaDailyReportData {
  if (!patch) return base
  const next = structuredClone(base)

  if (patch.header) {
    next.header = {
      ...next.header,
      project_name: preferScalar(next.header.project_name, patch.header.project_name),
      report_no: preferScalar(next.header.report_no, patch.header.report_no),
      date_shamsi: preferScalar(next.header.date_shamsi, patch.header.date_shamsi),
      day_of_week: preferScalar(next.header.day_of_week, patch.header.day_of_week),
      day_type: preferScalar(next.header.day_type, patch.header.day_type),
      supervisor_name: preferScalar(next.header.supervisor_name, patch.header.supervisor_name),
      submission_time: preferScalar(next.header.submission_time, patch.header.submission_time),
      status: preferScalar(next.header.status, patch.header.status),
    }
  }

  if (patch.weather) {
    next.weather = {
      ...next.weather,
      location_name: preferScalar(next.weather.location_name, patch.weather.location_name),
      condition: preferScalar(next.weather.condition, patch.weather.condition),
      morning_condition: preferScalar(next.weather.morning_condition, patch.weather.morning_condition),
      noon_condition: preferScalar(next.weather.noon_condition, patch.weather.noon_condition),
      evening_condition: preferScalar(next.weather.evening_condition, patch.weather.evening_condition),
      min_temp_c: preferScalar(next.weather.min_temp_c, patch.weather.min_temp_c),
      max_temp_c: preferScalar(next.weather.max_temp_c, patch.weather.max_temp_c),
      impact_level: preferScalar(next.weather.impact_level, patch.weather.impact_level),
      lost_hours: preferScalar(next.weather.lost_hours, patch.weather.lost_hours),
      notes: preferScalar(next.weather.notes, patch.weather.notes),
    }
  }

  if (patch.crews_and_progress) {
    const crewKey = (r: { wbs_code?: string | null; activity_name: string; contractor_or_crew: string }) =>
      `${r.wbs_code ?? ''}|${r.activity_name}|${r.contractor_or_crew}`
    next.crews_and_progress = mergeByKey(next.crews_and_progress, patch.crews_and_progress, crewKey)
    if (Array.isArray(patch.crews_and_progress)) {
      const byKey = new Map(next.crews_and_progress.map((r) => [crewKey(r), r] as const))
      for (const raw of patch.crews_and_progress) {
        if (!raw || typeof raw !== 'object') continue
        const cur = byKey.get(crewKey(raw))
        if (!cur?.location) continue
        byKey.set(crewKey(raw), {
          ...cur,
          location: {
            floor: preferScalar(cur.location.floor, raw.location?.floor),
            zone: preferScalar(cur.location.zone, raw.location?.zone),
            axis: preferScalar(cur.location.axis, raw.location?.axis),
          },
          headcount: preferScalar(cur.headcount, raw.headcount),
          regular_hours: preferScalar(cur.regular_hours, raw.regular_hours),
          work_done_today: {
            quantity: preferScalar(cur.work_done_today.quantity, raw.work_done_today?.quantity),
            unit: preferScalar(cur.work_done_today.unit, raw.work_done_today?.unit),
          },
        })
      }
      next.crews_and_progress = [...byKey.values()]
    }
  }

  if (patch.staff_headcount) {
    next.staff_headcount = {
      client_staff: preferScalar(next.staff_headcount.client_staff, patch.staff_headcount.client_staff),
      consultant_staff: preferScalar(next.staff_headcount.consultant_staff, patch.staff_headcount.consultant_staff),
      contractor_staff: preferScalar(next.staff_headcount.contractor_staff, patch.staff_headcount.contractor_staff),
      site_hq_staff: preferScalar(next.staff_headcount.site_hq_staff, patch.staff_headcount.site_hq_staff),
    }
  }

  if (patch.equipment) {
    next.equipment = mergeByKey(next.equipment, patch.equipment, (r) => r.name_or_code)
  }

  if (patch.materials) {
    next.materials = {
      received: mergeByKey(
        next.materials.received,
        patch.materials.received,
        (r) => `${r.item_name}|${r.waybill_or_invoice_no ?? ''}|${r.truck_plate ?? ''}`
      ),
      consumed: mergeByKey(
        next.materials.consumed,
        patch.materials.consumed,
        (r) => `${r.item_name}|${r.location_used ?? ''}`
      ),
      shortages: mergeByKey(next.materials.shortages, patch.materials.shortages, (r) => r.item_name),
    }
  }

  if (patch.work_summary) {
    next.work_summary = {
      completed_activities: mergeStringLists(
        next.work_summary.completed_activities,
        patch.work_summary.completed_activities
      ),
      ongoing_activities: mergeByKey(
        next.work_summary.ongoing_activities,
        patch.work_summary.ongoing_activities,
        (r) => r.activity
      ),
      unexecuted_planned_tasks: mergeByKey(
        next.work_summary.unexecuted_planned_tasks,
        patch.work_summary.unexecuted_planned_tasks,
        (r) => r.task
      ),
      out_of_plan_tasks: mergeStringLists(
        next.work_summary.out_of_plan_tasks,
        patch.work_summary.out_of_plan_tasks
      ),
    }
  }

  if (patch.quality_control) {
    next.quality_control = mergeByKey(
      next.quality_control,
      patch.quality_control,
      (r) => `${r.test_type}|${r.sample_code_and_element ?? ''}`
    )
  }

  if (patch.site_visits_and_directives) {
    const visits = Array.isArray(patch.site_visits_and_directives)
      ? patch.site_visits_and_directives.map((v) => ({
          ...v,
          disclaimer: SITE_VISIT_DISCLAIMER,
        }))
      : []
    next.site_visits_and_directives = mergeByKey(
      next.site_visits_and_directives,
      visits,
      (r) => `${r.visitor_name_and_role}|${r.directive_or_decision}`
    )
  }

  if (patch.hse) {
    next.hse = {
      accidents: mergeStringLists(next.hse.accidents, patch.hse.accidents),
      near_misses: mergeStringLists(next.hse.near_misses, patch.hse.near_misses),
      toolbox_talk: {
        held: patch.hse.toolbox_talk?.held ?? next.hse.toolbox_talk.held,
        attendees_count: preferScalar(
          next.hse.toolbox_talk.attendees_count,
          patch.hse.toolbox_talk?.attendees_count
        ),
        topic: preferScalar(next.hse.toolbox_talk.topic, patch.hse.toolbox_talk?.topic),
      },
      safety_warnings: mergeStringLists(next.hse.safety_warnings, patch.hse.safety_warnings),
      work_stopped_by_hse: patch.hse.work_stopped_by_hse ?? next.hse.work_stopped_by_hse,
      photo_urls: mergeStringLists(next.hse.photo_urls ?? [], patch.hse.photo_urls),
    }
  }

  if (patch.delays_and_blockers) {
    next.delays_and_blockers = mergeByKey(
      next.delays_and_blockers,
      patch.delays_and_blockers,
      (r) => `${r.description}|${r.cause_category}`
    )
  }

  if (patch.special_project_items) {
    const s = patch.special_project_items
    next.special_project_items = {
      geotechnical_monitoring: preferScalar(
        next.special_project_items.geotechnical_monitoring,
        s.geotechnical_monitoring
      ),
      neighbor_issues: preferScalar(next.special_project_items.neighbor_issues, s.neighbor_issues),
      municipal_and_utility_permits: preferScalar(
        next.special_project_items.municipal_and_utility_permits,
        s.municipal_and_utility_permits
      ),
      rfis_and_design_changes: preferScalar(
        next.special_project_items.rfis_and_design_changes,
        s.rfis_and_design_changes
      ),
      subcontractor_entries_exits: preferScalar(
        next.special_project_items.subcontractor_entries_exits,
        s.subcontractor_entries_exits
      ),
    }
  }

  if (patch.tomorrow_plan) {
    next.tomorrow_plan = {
      planned_activities: mergeStringLists(
        next.tomorrow_plan.planned_activities,
        patch.tomorrow_plan.planned_activities
      ),
      required_manpower_and_equipment: preferScalar(
        next.tomorrow_plan.required_manpower_and_equipment,
        patch.tomorrow_plan.required_manpower_and_equipment
      ),
      required_materials: preferScalar(
        next.tomorrow_plan.required_materials,
        patch.tomorrow_plan.required_materials
      ),
      anticipated_blockers: preferScalar(
        next.tomorrow_plan.anticipated_blockers,
        patch.tomorrow_plan.anticipated_blockers
      ),
      procurement_or_tech_office_requests: preferScalar(
        next.tomorrow_plan.procurement_or_tech_office_requests,
        patch.tomorrow_plan.procurement_or_tech_office_requests
      ),
    }
  }

  if (patch.attached_photos) {
    next.attached_photos = mergeByKey(
      next.attached_photos,
      patch.attached_photos,
      (r) => r.url || `${r.caption}|${r.linked_activity_or_location ?? ''}`
    )
  }

  if (patch.free_notes != null) {
    next.free_notes = preferScalar(next.free_notes, patch.free_notes)
  }

  return next
}

export function parsePartialSiteReport(raw: unknown): Partial<LipartaDailyReportData> {
  if (!raw || typeof raw !== 'object') return {}
  return raw as Partial<LipartaDailyReportData>
}

export function coerceSiteReport(raw: unknown, header?: Parameters<typeof emptyLipartaDailyReport>[0]): LipartaDailyReportData {
  const base = emptyLipartaDailyReport(header)
  return mergeLipartaDailyReport(base, parsePartialSiteReport(raw))
}
