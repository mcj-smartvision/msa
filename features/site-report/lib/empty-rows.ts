/**
 * @file features/site-report/lib/empty-rows.ts
 * @purpose ردیف‌های خالی برای افزودن دستی در فرم گزارش
 * @safe-to-edit YES
 * @affects features/site-report/components
 * @depends-on features/site-report/lib/types
 */

import { SITE_VISIT_DISCLAIMER } from '@/features/site-report/lib/types'
import type {
  SiteReportCrewRow,
  SiteReportDelayRow,
  SiteReportEquipmentRow,
  SiteReportMaterialConsumed,
  SiteReportMaterialReceived,
  SiteReportMaterialShortage,
  SiteReportQcRow,
  SiteReportVisitRow,
} from '@/features/site-report/lib/types'

export function emptyCrewRow(): SiteReportCrewRow {
  return {
    contractor_or_crew: '',
    trade: '',
    activity_name: '',
    wbs_code: null,
    location: { floor: null, zone: null, axis: null },
    headcount: null,
    regular_hours: null,
    overtime_hours: null,
    work_done_today: { quantity: null, unit: null },
    activity_status: 'در حال انجام',
    idle_hours: null,
    idle_reason: null,
    photo_urls: [],
    requires_completion: true,
  }
}

export function emptyEquipmentRow(): SiteReportEquipmentRow {
  return {
    name_or_code: '',
    ownership: 'ملکی',
    operator_name: null,
    operating_hours: null,
    idle_hours: null,
    breakdown_hours: null,
    breakdown_cause: null,
    work_location: null,
    fuel_liters: null,
  }
}

export function emptyMaterialReceived(): SiteReportMaterialReceived {
  return {
    item_name: '',
    quantity: null,
    unit: null,
    supplier: null,
    waybill_or_invoice_no: null,
    truck_plate: null,
    supplied_by: 'پیمانکار',
  }
}

export function emptyMaterialConsumed(): SiteReportMaterialConsumed {
  return {
    item_name: '',
    quantity: null,
    unit: null,
    location_used: null,
  }
}

export function emptyMaterialShortage(): SiteReportMaterialShortage {
  return {
    item_name: '',
    required_quantity: null,
    unit: null,
    needed_by_date: null,
    urgency: 'عادی',
  }
}

export function emptyQcRow(): SiteReportQcRow {
  return {
    test_type: '',
    sample_code_and_element: null,
    result: 'در انتظار پاسخ',
    inspection_request_status: null,
    ncr_details: null,
  }
}

export function emptyVisitRow(): SiteReportVisitRow {
  return {
    visitor_name_and_role: '',
    visit_purpose: null,
    directive_or_decision: '',
    official_letter_required: false,
    disclaimer: SITE_VISIT_DISCLAIMER,
  }
}

export function emptyDelayRow(): SiteReportDelayRow {
  return {
    description: '',
    start_time: null,
    end_time: null,
    affected_activities: [],
    cause_category: 'سایر',
    lost_hours: null,
    lost_man_hours: null,
    photo_urls: [],
  }
}
