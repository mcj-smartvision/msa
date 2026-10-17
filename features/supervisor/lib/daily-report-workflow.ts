/**
 * @file features/supervisor/lib/daily-report-workflow.ts
 * @purpose وضعیت گردش‌کار گزارش روزانه (ثبت / ارسال به مدیر / تأیید)
 * @safe-to-edit YES
 * @affects تب گزارش روزانه و آرشیو
 * @depends-on nothing
 */

export const DAILY_REPORT_WORKFLOW = {
  draft: 'draft',
  finalized: 'finalized',
  submitted: 'submitted',
  approved: 'approved',
} as const

export type DailyReportWorkflowStatus =
  (typeof DAILY_REPORT_WORKFLOW)[keyof typeof DAILY_REPORT_WORKFLOW]

export function parseWorkflowStatus(value: unknown): DailyReportWorkflowStatus {
  if (value === 'finalized' || value === 'submitted' || value === 'approved') return value
  return 'draft'
}

/** Editable until sent to the manager (draft / legacy finalized). */
export function canEditDailyReportContent(status: DailyReportWorkflowStatus): boolean {
  return status === 'draft' || status === 'finalized'
}

export function canSaveDailyReport(status: DailyReportWorkflowStatus): boolean {
  return canEditDailyReportContent(status)
}

/** Confirm + send to manager from an open draft (or legacy finalized). */
export function canSendDailyReportToManager(status: DailyReportWorkflowStatus): boolean {
  return status === 'draft' || status === 'finalized'
}

export function canManagerApproveDailyReport(status: DailyReportWorkflowStatus): boolean {
  return status === 'submitted'
}

/** @deprecated use canSaveDailyReport — kept for older call sites */
export function canFinalizeDailyReport(status: DailyReportWorkflowStatus): boolean {
  return canSaveDailyReport(status)
}
