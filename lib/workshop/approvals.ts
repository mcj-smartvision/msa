import { WorkshopError } from './domain'

/** Temporary: save auto-approves packages; PM submit step disabled in UI */
export const WORKSHOP_SKIP_PM_APPROVAL = true

export type ApprovalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'change_requested'

export function canEditPackageContent(approvalStatus: ApprovalStatus | null | undefined): boolean {
  const s = approvalStatus ?? 'draft'
  if (WORKSHOP_SKIP_PM_APPROVAL) {
    return s !== 'change_requested'
  }
  return s === 'draft' || s === 'rejected' || s === 'pending_approval'
}

/** Row-level edit in schedule workspace (includes user-added sub-branches). */
export function canEditWorkshopPackageRow(
  approvalStatus: ApprovalStatus | null | undefined,
  origin?: string | null
): boolean {
  if (WORKSHOP_SKIP_PM_APPROVAL) {
    return (approvalStatus ?? 'draft') !== 'change_requested'
  }
  if (origin === 'user_added') return true
  return canEditPackageContent(approvalStatus)
}

export function canDeletePackage(approvalStatus: ApprovalStatus | null | undefined): boolean {
  if (WORKSHOP_SKIP_PM_APPROVAL) {
    return canEditPackageContent(approvalStatus)
  }
  return canEditPackageContent(approvalStatus)
}

export function canReviseChangeRequest(approvalStatus: ApprovalStatus | null | undefined): boolean {
  return (approvalStatus ?? 'draft') === 'change_requested'
}

export function assertCanEditPackage(
  approvalStatus: ApprovalStatus | null | undefined,
  origin?: string | null
) {
  if (!canEditWorkshopPackageRow(approvalStatus, origin ?? 'user_added')) {
    throw new WorkshopError(
      'VALIDATION',
      'این مورد تأیید شده است. برای تغییر باید «درخواست تغییر» بدهید تا مدیر پروژه تأیید کند.'
    )
  }
}

export function assertCanDeletePackage(approvalStatus: ApprovalStatus | null | undefined) {
  if (!canDeletePackage(approvalStatus)) {
    throw new WorkshopError(
      'VALIDATION',
      'بعد از تأیید مدیر پروژه نمی‌توان حذف کرد. در صورت نیاز درخواست تغییر بدهید.'
    )
  }
}

export function assertCanSubmitForApproval(approvalStatus: ApprovalStatus | null | undefined) {
  const s = approvalStatus ?? 'draft'
  if (s !== 'draft' && s !== 'rejected') {
    throw new WorkshopError('VALIDATION', 'فقط پیش‌نویس یا رد‌شده قابل ارسال برای تأیید است')
  }
}

export function assertCanRequestChange(approvalStatus: ApprovalStatus | null | undefined) {
  if ((approvalStatus ?? 'draft') !== 'approved') {
    throw new WorkshopError('VALIDATION', 'درخواست تغییر فقط بعد از تأیید مدیر پروژه ممکن است')
  }
}

export function assertCanSendToToday(approvalStatus: ApprovalStatus | null | undefined) {
  if (WORKSHOP_SKIP_PM_APPROVAL) {
    const s = approvalStatus ?? 'draft'
    if (s === 'change_requested') {
      throw new WorkshopError('VALIDATION', 'ابتدا درخواست تغییر را از مدیر پروژه پیگیری کنید')
    }
    return
  }
  if ((approvalStatus ?? 'draft') !== 'approved') {
    throw new WorkshopError(
      'VALIDATION',
      'فقط موارد تأیید‌شده توسط مدیر پروژه قابل ارسال به امروز هستند'
    )
  }
}

export function approvalStatusFa(status: ApprovalStatus | null | undefined): string {
  const map: Record<ApprovalStatus, string> = {
    draft: 'پیش‌نویس',
    pending_approval: 'در انتظار تأیید',
    approved: 'تأیید شده',
    rejected: 'رد شده',
    change_requested: 'درخواست تغییر',
  }
  return map[status ?? 'draft']
}
