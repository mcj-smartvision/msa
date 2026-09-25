import { WorkshopError } from './domain'

/** Temporary: save auto-approves packages; PM submit step disabled in UI */
export const WORKSHOP_SKIP_PM_APPROVAL = true

export type ApprovalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'change_requested'

/** Workshop packages created in UI (default DB origin). */
export function isUserAddedOrigin(origin?: string | null): boolean {
  return origin == null || origin === '' || origin === 'user_added'
}

export function canEditPackageContent(approvalStatus: ApprovalStatus | null | undefined): boolean {
  const s = approvalStatus ?? 'draft'
  if (WORKSHOP_SKIP_PM_APPROVAL) {
    return s !== 'change_requested'
  }
  return s === 'draft' || s === 'rejected' || s === 'pending_approval'
}

/**
 * Row-level edit in schedule workspace.
 * User-added sub-branches stay editable after save (even when auto-approved).
 * Only `change_requested` locks the row (revise via dedicated flow).
 */
export function canEditWorkshopPackageRow(
  approvalStatus: ApprovalStatus | null | undefined,
  origin?: string | null
): boolean {
  const s = approvalStatus ?? 'draft'
  if (s === 'change_requested') return false

  // Sub-branches the user added must remain editable after ذخیره
  if (isUserAddedOrigin(origin)) return true

  if (WORKSHOP_SKIP_PM_APPROVAL) return true
  return canEditPackageContent(s)
}

export function canDeletePackage(
  approvalStatus: ApprovalStatus | null | undefined,
  origin?: string | null
): boolean {
  return canEditWorkshopPackageRow(approvalStatus, origin)
}

export function canReviseChangeRequest(approvalStatus: ApprovalStatus | null | undefined): boolean {
  return (approvalStatus ?? 'draft') === 'change_requested'
}

export function assertCanEditPackage(
  approvalStatus: ApprovalStatus | null | undefined,
  origin?: string | null
) {
  if (!canEditWorkshopPackageRow(approvalStatus, origin)) {
    throw new WorkshopError(
      'VALIDATION',
      'این مورد تأیید شده است. برای تغییر باید «درخواست تغییر» بدهید تا مدیر پروژه تأیید کند.'
    )
  }
}

export function assertCanDeletePackage(
  approvalStatus: ApprovalStatus | null | undefined,
  origin?: string | null
) {
  if (!canDeletePackage(approvalStatus, origin)) {
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
