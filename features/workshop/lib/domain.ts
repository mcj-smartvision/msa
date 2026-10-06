import type { CreatePackageInput, ReviewReasonCode } from './types'
import { WORKSHOP_UOMS } from './types'

export class WorkshopError extends Error {
  constructor(
    public code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND',
    message: string
  ) {
    super(message)
    this.name = 'WorkshopError'
  }
}

export function validateCreatePackage(input: CreatePackageInput) {
  const name = input.name?.trim()
  if (!name) throw new WorkshopError('VALIDATION', 'نام را وارد کنید')
  if (!(input.quantity > 0)) throw new WorkshopError('VALIDATION', 'مقدار باید بزرگ‌تر از صفر باشد')
  if (!input.uom?.trim()) throw new WorkshopError('VALIDATION', 'واحد را انتخاب کنید')
  if (!WORKSHOP_UOMS.includes(input.uom as (typeof WORKSHOP_UOMS)[number]) && input.uom.length > 12) {
    throw new WorkshopError('VALIDATION', 'واحد نامعتبر است')
  }
  if (!input.parentScheduleNodeId && !input.parentPackageId) {
    throw new WorkshopError('VALIDATION', 'یک ردیف والد را انتخاب کنید')
  }
  return {
    name,
    quantity: Number(input.quantity),
    uom: input.uom.trim(),
    location: input.location?.trim() || null,
    crew: input.crew?.trim() || null,
    note: input.note?.trim() || null,
    flag_for_review: Boolean(input.flagForReview),
    review_reason: input.reviewReason?.trim() || null,
  }
}

export function inferReviewReason(opts: {
  flagForReview?: boolean
  parentMissingBasis?: boolean
}): { flag: boolean; reasonCode: ReviewReasonCode | null; note: string | null } {
  if (opts.flagForReview) {
    return {
      flag: true,
      reasonCode: 'out_of_baseline_scope',
      note: 'کار خارج از فهرست پایه / نیاز به نگاشت فنی',
    }
  }
  if (opts.parentMissingBasis) {
    return {
      flag: true,
      reasonCode: 'missing_quantity_basis',
      note: 'داده پایه والد ناقص است — ثبت کارگاه مجاز است',
    }
  }
  return { flag: false, reasonCode: null, note: null }
}

export function wbsDepth(wbs: string | null | undefined): number {
  if (!wbs) return 0
  return wbs.split('.').filter(Boolean).length
}
