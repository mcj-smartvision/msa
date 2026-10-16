/**
 * @file features/project-manager/lib/types.ts
 * @purpose تعاریف نوع — اتاق فرمان مدیر پروژه و کارتابل (types)
 * @safe-to-edit YES
 * @affects اتاق فرمان مدیر پروژه و کارتابل
 * @depends-on nothing
 */

/** Shared approval type keys used by AI action routing. */
export type ApprovalItemType =
  | 'purchase_request'
  | 'subcontractor_instruction'
  | 'hse_alert'
  | 'qc_action'
  | 'schedule_change'
  | 'resource_escalation'
  | 'daily_report'
  | 'workshop_package'
  | 'workshop_change'
