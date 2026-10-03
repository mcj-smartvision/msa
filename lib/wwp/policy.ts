/**
 * Weekly Work Plan governance (Last Planner). Mirrors the triggers in
 * database/100-weekly-work-plans.sql so the API can refuse early with a clear message;
 * the database stays the final authority.
 */

export type WwpStatus = 'DRAFT' | 'FROZEN' | 'CLOSED'

export type WwpAction = 'edit_draft' | 'freeze' | 'record_outcome' | 'close'

export const WWP_ROLES: Record<WwpAction, readonly string[]> = {
  edit_draft: ['planning_engineer', 'site_supervisor'],
  freeze: ['project_manager', 'planning_engineer'],
  record_outcome: ['project_manager'],
  close: ['project_manager'],
}

export const WWP_ACTION_FA: Record<WwpAction, string> = {
  edit_draft: 'ایجاد برنامهٔ هفتگی و ثبت تعهدات',
  freeze: 'قفل‌کردن برنامهٔ هفتگی',
  record_outcome: 'ثبت نتیجهٔ تعهدات (ارزیابی هفته)',
  close: 'بستن و ارزیابی هفته',
}

const ROLE_FA: Record<string, string> = {
  project_manager: 'مدیر پروژه',
  planning_engineer: 'مهندس برنامه‌ریزی',
  site_supervisor: 'سرپرست کارگاه',
}

export const ROOT_CAUSE_CATEGORIES = [
  'materials',
  'crew',
  'equipment',
  'permit_approval',
  'design_info',
  'prerequisite_work',
  'weather',
  'site_access',
  'payment',
  'qc_rework',
  'other',
] as const

export type RootCauseCategory = (typeof ROOT_CAUSE_CATEGORIES)[number]

export const ROOT_CAUSE_FA: Record<RootCauseCategory, string> = {
  materials: 'مصالح',
  crew: 'اکیپ / نیروی انسانی',
  equipment: 'تجهیزات',
  permit_approval: 'مجوز / تأییدیه',
  design_info: 'نقشه / ابهام فنی',
  prerequisite_work: 'کار پیش‌نیاز تمام نشده',
  weather: 'جوی',
  site_access: 'دسترسی / کارگاه',
  payment: 'پرداخت',
  qc_rework: 'رفع عیب (QC)',
  other: 'سایر',
}

export type PolicyResult = { ok: true } | { ok: false; reason_fa: string; code: 'FORBIDDEN' | 'VALIDATION' }

const OK: PolicyResult = { ok: true }

function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** Saturday → Friday week containing nothing but the given Saturday. */
export function weekBounds(startDate: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null
  const day = new Date(`${startDate}T00:00:00Z`).getUTCDay()
  if (day !== 6) return null
  return { start: startDate, end: addDays(startDate, 6) }
}

/** Sequential project week (1 = the week containing the project start), Saturday-based. */
export function projectWeekNumber(projectStart: string, weekStart: string): number {
  const startDay = new Date(`${projectStart}T00:00:00Z`).getUTCDay()
  const firstSaturday = addDays(projectStart, -((startDay + 1) % 7))
  const diff = (Date.parse(`${weekStart}T00:00:00Z`) - Date.parse(`${firstSaturday}T00:00:00Z`)) / 86_400_000
  return Math.floor(diff / 7) + 1
}

export function hasWwpRole(positionKeys: readonly string[], action: WwpAction): boolean {
  return WWP_ROLES[action].some((role) => positionKeys.includes(role))
}

export function wwpForbiddenMessage(action: WwpAction): string {
  const roles = WWP_ROLES[action].map((r) => ROLE_FA[r] ?? r).join('، ')
  return `دسترسی ندارید: ${WWP_ACTION_FA[action]} فقط برای ${roles} مجاز است`
}

function forbidden(action: WwpAction): PolicyResult {
  return { ok: false, code: 'FORBIDDEN', reason_fa: wwpForbiddenMessage(action) }
}

/** Every rule for one action on a plan, evaluated against the Tehran calendar date `today`. */
export function checkWwpAction(input: {
  action: WwpAction
  positionKeys: readonly string[]
  status: WwpStatus
  startDate: string
  endDate: string
  today: string
  commitmentCount?: number
  openOutcomeCount?: number
}): PolicyResult {
  if (!hasWwpRole(input.positionKeys, input.action)) return forbidden(input.action)
  if (input.status === 'CLOSED') return { ok: false, code: 'VALIDATION', reason_fa: 'برنامهٔ هفتگی بسته‌شده قابل تغییر نیست' }

  switch (input.action) {
    case 'edit_draft':
      return input.status === 'DRAFT'
        ? OK
        : { ok: false, code: 'VALIDATION', reason_fa: 'پس از قفل‌شدن برنامه، تعهدی اضافه، ویرایش یا حذف نمی‌شود' }
    case 'freeze':
      if (input.status !== 'DRAFT') return { ok: false, code: 'VALIDATION', reason_fa: 'فقط برنامهٔ پیش‌نویس قفل می‌شود' }
      if (input.today > input.startDate) {
        return { ok: false, code: 'VALIDATION', reason_fa: `قفل برنامهٔ هفتگی باید حداکثر تا شنبهٔ همان هفته (${input.startDate}) انجام شود` }
      }
      if ((input.commitmentCount ?? 0) <= 0) return { ok: false, code: 'VALIDATION', reason_fa: 'برنامهٔ هفتگی بدون تعهد قابل قفل‌شدن نیست' }
      return OK
    case 'record_outcome':
      return input.status === 'FROZEN'
        ? OK
        : { ok: false, code: 'VALIDATION', reason_fa: 'نتیجهٔ تعهد فقط پس از قفل‌شدن برنامه ثبت می‌شود' }
    case 'close':
      if (input.status !== 'FROZEN') return { ok: false, code: 'VALIDATION', reason_fa: 'فقط برنامهٔ قفل‌شده بسته می‌شود' }
      if (input.today < input.endDate) return { ok: false, code: 'VALIDATION', reason_fa: `هفته از جمعه (${input.endDate}) به بعد قابل بستن است` }
      if ((input.openOutcomeCount ?? 0) > 0) {
        return { ok: false, code: 'VALIDATION', reason_fa: `برای بستن هفته، نتیجهٔ همهٔ تعهدات باید ثبت شود (${input.openOutcomeCount} مورد باز است)` }
      }
      return OK
  }
}

export interface OutcomeInput {
  isCompleted: boolean
  rootCauseCategory?: string | null
  rootCauseNote?: string | null
  actualOutput?: number | null
}

/** Same rules as the table CHECKs: a miss needs a root cause; "other" needs a note; a hit has none. */
export function validateOutcome(input: OutcomeInput): PolicyResult {
  if (input.actualOutput != null && (!Number.isFinite(input.actualOutput) || input.actualOutput < 0)) {
    return { ok: false, code: 'VALIDATION', reason_fa: 'مقدار واقعی نامعتبر است' }
  }
  if (input.isCompleted) {
    return input.rootCauseCategory
      ? { ok: false, code: 'VALIDATION', reason_fa: 'تعهد انجام‌شده علت عدم تحقق ندارد' }
      : OK
  }
  if (!input.rootCauseCategory || !(ROOT_CAUSE_CATEGORIES as readonly string[]).includes(input.rootCauseCategory)) {
    return { ok: false, code: 'VALIDATION', reason_fa: 'برای تعهد انجام‌نشده، علت عدم تحقق از فهرست الزامی است' }
  }
  if (input.rootCauseCategory === 'other' && !input.rootCauseNote?.trim()) {
    return { ok: false, code: 'VALIDATION', reason_fa: 'برای علت «سایر» توضیح لازم است' }
  }
  return OK
}
