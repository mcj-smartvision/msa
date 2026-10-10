import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { enumerateProjectJalaliMonths, inclusiveDayCount } from '@/features/schedule/lib/monthly-deducted-weight'
import type { EvmBudgetBasis } from '@/features/evm/lib/metrics'
import { ROLE_DASHBOARD_ACCESS } from '@/features/schedule/lib/access'

/** Only the project manager (and system admins) may change the financial settings. */
export function canEditCostEstimate(input: { isSystemAdmin: boolean; positionKeys: string[] }): boolean {
  if (input.isSystemAdmin) return true
  const allowed = ROLE_DASHBOARD_ACCESS.manager as string[]
  return input.positionKeys.some((key) => allowed.includes(key))
}

/** Every amount on this page is whole toman, like schedule prices, overhead and employer purchases. */
export const ESTIMATE_CURRENCY = 'تومان'

export type RiskMode = 'percent' | 'amount'

/** What the manager enters. `null` means "not entered yet", which is different from an explicit 0. */
export interface CostEstimateSettings {
  contractValue: number | null
  plannedStart: string | null
  plannedFinish: string | null
  monthlyOverhead: number | null
  /** The schedule's activity budgets already carry site overhead. */
  overheadInWbs: boolean
  monthlyPersonnel: number | null
  personnelInWbs: boolean
  plannedEmployerPurchases: number | null
  purchasesInWbs: boolean
  otherFixedCosts: number | null
  riskMode: RiskMode
  riskValue: number | null
  notes: string | null
}

export interface CostEstimateRecord extends CostEstimateSettings {
  approvedAt: string | null
  approvedBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export const EMPTY_ESTIMATE: CostEstimateSettings = {
  contractValue: null,
  plannedStart: null,
  plannedFinish: null,
  monthlyOverhead: null,
  overheadInWbs: false,
  monthlyPersonnel: null,
  personnelInWbs: false,
  plannedEmployerPurchases: null,
  purchasesInWbs: false,
  otherFixedCosts: null,
  riskMode: 'percent',
  riskValue: null,
  notes: null,
}

/* ------------------------------------------------------------------ Storage */

type Row = Record<string, unknown>

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function strOrNull(value: unknown): string | null {
  return value == null || value === '' ? null : String(value)
}

export function estimateFromRow(row: Row): CostEstimateRecord {
  return {
    contractValue: numOrNull(row.contract_value),
    plannedStart: toIsoDateOnly(strOrNull(row.planned_start)),
    plannedFinish: toIsoDateOnly(strOrNull(row.planned_finish)),
    monthlyOverhead: numOrNull(row.monthly_overhead),
    overheadInWbs: row.overhead_in_wbs === true,
    monthlyPersonnel: numOrNull(row.monthly_personnel),
    personnelInWbs: row.personnel_in_wbs === true,
    plannedEmployerPurchases: numOrNull(row.planned_employer_purchases),
    purchasesInWbs: row.purchases_in_wbs === true,
    otherFixedCosts: numOrNull(row.other_fixed_costs),
    riskMode: row.risk_mode === 'amount' ? 'amount' : 'percent',
    riskValue: numOrNull(row.risk_value),
    notes: strOrNull(row.notes),
    approvedAt: strOrNull(row.approved_at),
    approvedBy: strOrNull(row.approved_by),
    updatedAt: strOrNull(row.updated_at),
    updatedBy: strOrNull(row.updated_by),
  }
}

export function estimateToRow(settings: CostEstimateSettings): Row {
  return {
    contract_value: settings.contractValue,
    planned_start: settings.plannedStart,
    planned_finish: settings.plannedFinish,
    monthly_overhead: settings.monthlyOverhead,
    overhead_in_wbs: settings.overheadInWbs,
    monthly_personnel: settings.monthlyPersonnel,
    personnel_in_wbs: settings.personnelInWbs,
    planned_employer_purchases: settings.plannedEmployerPurchases,
    purchases_in_wbs: settings.purchasesInWbs,
    other_fixed_costs: settings.otherFixedCosts,
    risk_mode: settings.riskMode,
    risk_value: settings.riskValue,
    notes: settings.notes,
  }
}

/* --------------------------------------------------------------- Validation */

export type EstimateField = keyof CostEstimateSettings

export type EstimateValidation =
  | { ok: true; value: CostEstimateSettings }
  | { ok: false; errors: Partial<Record<EstimateField, string>> }

const AMOUNT_FIELDS: Array<[EstimateField, string]> = [
  ['contractValue', 'ارزش قرارداد'],
  ['monthlyOverhead', 'بالاسری ماهانه'],
  ['monthlyPersonnel', 'هزینهٔ ماهانهٔ پرسنل'],
  ['plannedEmployerPurchases', 'خریدهای برنامه‌ریزی‌شدهٔ کارفرمایی'],
  ['otherFixedCosts', 'سایر هزینه‌های ثابت'],
]

/** Rejects negative amounts, an end on or before the start, and a risk percent outside 0–100. */
export function validateEstimate(input: Partial<Record<EstimateField, unknown>>): EstimateValidation {
  const errors: Partial<Record<EstimateField, string>> = {}
  const value: CostEstimateSettings = { ...EMPTY_ESTIMATE }

  for (const [field, label] of AMOUNT_FIELDS) {
    const raw = input[field]
    if (raw == null || raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n)) errors[field] = `${label} باید عدد باشد`
    else if (n < 0) errors[field] = `${label} نمی‌تواند منفی باشد`
    else (value[field] as number | null) = n
  }

  const start = input.plannedStart == null || input.plannedStart === '' ? null : toIsoDateOnly(String(input.plannedStart))
  const finish = input.plannedFinish == null || input.plannedFinish === '' ? null : toIsoDateOnly(String(input.plannedFinish))
  if (input.plannedStart && !start) errors.plannedStart = 'تاریخ شروع معتبر نیست'
  if (input.plannedFinish && !finish) errors.plannedFinish = 'تاریخ پایان معتبر نیست'
  if (start && finish && finish <= start) errors.plannedFinish = 'تاریخ پایان باید بعد از تاریخ شروع باشد'
  value.plannedStart = start
  value.plannedFinish = finish

  value.overheadInWbs = input.overheadInWbs === true
  value.personnelInWbs = input.personnelInWbs === true
  value.purchasesInWbs = input.purchasesInWbs === true
  value.riskMode = input.riskMode === 'amount' ? 'amount' : 'percent'

  if (input.riskValue != null && input.riskValue !== '') {
    const n = Number(input.riskValue)
    if (!Number.isFinite(n)) errors.riskValue = 'ذخیرهٔ ریسک باید عدد باشد'
    else if (n < 0) errors.riskValue = 'ذخیرهٔ ریسک نمی‌تواند منفی باشد'
    else if (value.riskMode === 'percent' && n > 100) errors.riskValue = 'درصد ذخیرهٔ ریسک باید بین 0 تا 100 باشد'
    else value.riskValue = n
  }

  const notes = typeof input.notes === 'string' ? input.notes.trim() : ''
  value.notes = notes ? notes.slice(0, 2000) : null

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value }
}

/* ----------------------------------------------------------------- Duration */

/**
 * Planned duration in Jalali months, the period the overhead workbook uses. Each month counts by the
 * share of its days inside [start, finish], so 1 Farvardin → 31 Farvardin is exactly 1.
 */
export function plannedDurationMonths(startIso: string | null, finishIso: string | null): number | null {
  const start = toIsoDateOnly(startIso)
  const finish = toIsoDateOnly(finishIso)
  if (!start || !finish || finish <= start) return null
  let months = 0
  for (const month of enumerateProjectJalaliMonths(start, finish)) {
    const from = month.startIso > start ? month.startIso : start
    const to = month.endIso < finish ? month.endIso : finish
    const covered = inclusiveDayCount(from, to)
    const length = inclusiveDayCount(month.startIso, month.endIso)
    if (covered > 0 && length > 0) months += covered / length
  }
  return months > 0 ? Math.round(months * 100) / 100 : null
}

export function plannedDurationDays(startIso: string | null, finishIso: string | null): number | null {
  const start = toIsoDateOnly(startIso)
  const finish = toIsoDateOnly(finishIso)
  if (!start || !finish || finish <= start) return null
  return inclusiveDayCount(start, finish)
}

/* ---------------------------------------------------------------------- BAC */

export interface WbsBudgetRow {
  id: string
  kind: 'task' | 'package'
  wbs: string | null
  name: string
  quantity: number
  unitPrice: number
  budget: number
  weight: number
}

export interface WbsDirectCost {
  /** Where the budgets were read from (see `resolveActivityBudgets`). */
  basis: EvmBudgetBasis
  total: number
  rows: WbsBudgetRow[]
  /** Leaf activities that carry schedule weight but no budget. */
  missingRows: WbsBudgetRow[]
}

export type BacComponentKey = 'direct' | 'overhead' | 'personnel' | 'purchases' | 'other'

export interface BacComponent {
  key: BacComponentKey
  label: string
  amount: number | null
  /** False when the amount is already inside the WBS budgets (or not entered). */
  included: boolean
  source: string
  formula: string
  note?: string
}

export interface BacModel {
  components: BacComponent[]
  durationMonths: number | null
  bacBase: number
  riskReserve: number
  riskFormula: string
  bacTotal: number
}

export const WBS_BASIS_LABEL: Record<EvmBudgetBasis, string> = {
  technical_office_cost: 'ستون «هزینه» برنامهٔ زمان‌بندی (برآورد دفتر فنی)',
  contract_value: 'مقدار × قیمت واحد ردیف‌ها (قیمت قراردادی، به‌جای برآورد هزینه)',
  weighted_project_budget: 'بودجهٔ کلی پروژه (از WBS استخراج نمی‌شود)',
  none: 'هیچ ردیف WBS بودجه یا قیمت ندارد',
}

/** The WBS part of BAC. A project-level budget spread by weight is not a WBS estimate, so it counts as missing. */
export function wbsDirectCost(basis: EvmBudgetBasis, rows: WbsBudgetRow[]): WbsDirectCost {
  const fromWbs = basis === 'technical_office_cost' || basis === 'contract_value'
  const budgeted = fromWbs ? rows.filter((r) => r.budget > 0) : []
  return {
    basis: fromWbs ? basis : 'none',
    total: budgeted.reduce((sum, r) => sum + r.budget, 0),
    rows: budgeted,
    missingRows: rows.filter((r) => r.weight > 0 && !(fromWbs && r.budget > 0)),
  }
}

function money(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/**
 * BAC base = WBS direct + planned overhead + personnel + planned employer purchases + other fixed costs.
 * BAC total = BAC base + risk reserve. A component flagged as already inside the WBS budgets is shown
 * but not added again.
 */
export function buildBac(settings: CostEstimateSettings, direct: WbsDirectCost): BacModel {
  const months = plannedDurationMonths(settings.plannedStart, settings.plannedFinish)
  const timeBased = (monthly: number | null) => (monthly == null || months == null ? null : monthly * months)
  const monthsText = months == null ? 'مدت برنامه‌ای' : `${months} ماه`

  const overhead = timeBased(settings.monthlyOverhead)
  const personnel = timeBased(settings.monthlyPersonnel)
  const inWbsNote = 'در بودجهٔ ردیف‌های WBS منظور شده است؛ دوباره اضافه نمی‌شود'

  const components: BacComponent[] = [
    {
      key: 'direct',
      label: 'هزینهٔ مستقیم فعالیت‌ها (WBS)',
      amount: direct.total,
      included: direct.total > 0,
      source: WBS_BASIS_LABEL[direct.basis],
      formula: `جمع ${direct.rows.length} ردیف برگ`,
    },
    {
      key: 'overhead',
      label: 'بالاسری برنامه‌ای',
      amount: overhead,
      included: overhead != null && !settings.overheadInWbs,
      source: 'تنظیمات برآورد',
      formula: `بالاسری ماهانه × ${monthsText}`,
      note: settings.overheadInWbs ? inWbsNote : undefined,
    },
    {
      key: 'personnel',
      label: 'پرسنل خارج از WBS',
      amount: personnel,
      included: personnel != null && !settings.personnelInWbs,
      source: 'تنظیمات برآورد',
      formula: `هزینهٔ ماهانهٔ پرسنل × ${monthsText}`,
      note: settings.personnelInWbs ? inWbsNote : undefined,
    },
    {
      key: 'purchases',
      label: 'خریدهای برنامه‌ریزی‌شدهٔ کارفرمایی',
      amount: settings.plannedEmployerPurchases,
      included: settings.plannedEmployerPurchases != null && !settings.purchasesInWbs,
      source: 'تنظیمات برآورد',
      formula: 'مبلغ واردشده',
      note: settings.purchasesInWbs ? inWbsNote : undefined,
    },
    {
      key: 'other',
      label: 'سایر هزینه‌های ثابت',
      amount: settings.otherFixedCosts,
      included: settings.otherFixedCosts != null,
      source: 'تنظیمات برآورد',
      formula: 'مبلغ واردشده',
    },
  ]

  const bacBase = components.reduce((sum, c) => sum + (c.included && c.amount != null ? c.amount : 0), 0)
  const risk = settings.riskValue ?? 0
  const riskReserve = settings.riskMode === 'percent' ? (bacBase * risk) / 100 : risk
  return {
    components,
    durationMonths: months,
    bacBase,
    riskReserve,
    riskFormula:
      settings.riskMode === 'percent' ? `${risk}% × BAC پایه (${money(bacBase)})` : 'مبلغ واردشده',
    bacTotal: bacBase + riskReserve,
  }
}

/* ------------------------------------------------------------ Targets (PART 3) */

/** Planned margin below this share of the contract is a warning. */
export const TARGET_MARGIN_WARNING_PERCENT = 5

export type TargetLevel = 'ok' | 'warning' | 'critical' | 'none'

export interface EstimateTargets {
  /** Contract value − BAC total. */
  targetProfit: number | null
  /** Target profit ÷ contract value × 100. */
  marginPercent: number | null
  /** BAC total ÷ planned duration (toman per month). */
  burnRateMonthly: number | null
  /** Planned overhead total ÷ planned days (toman per day); null when overhead is inside WBS or not entered. */
  overheadPerDay: number | null
  plannedOverheadTotal: number | null
  durationDays: number | null
  level: TargetLevel
  messages: { level: 'warning' | 'critical'; text: string }[]
}

export function estimateTargets(settings: CostEstimateSettings, bac: BacModel): EstimateTargets {
  const contract = settings.contractValue != null && settings.contractValue > 0 ? settings.contractValue : null
  const bacTotal = bac.bacTotal > 0 ? bac.bacTotal : null
  const targetProfit = contract != null && bacTotal != null ? contract - bacTotal : null
  const marginPercent = targetProfit != null && contract != null ? (targetProfit / contract) * 100 : null
  const months = bac.durationMonths
  const days = plannedDurationDays(settings.plannedStart, settings.plannedFinish)
  const overhead = bac.components.find((c) => c.key === 'overhead')
  const plannedOverheadTotal = overhead && overhead.included && overhead.amount != null ? overhead.amount : null

  const messages: EstimateTargets['messages'] = []
  if (contract != null && bacTotal != null && bacTotal > contract) {
    messages.push({ level: 'critical', text: 'بودجهٔ داخلی (BAC کل) از مبلغ قرارداد بیشتر است.' })
  }
  if (marginPercent != null && marginPercent < 0) {
    messages.push({ level: 'critical', text: `حاشیهٔ سود منفی است (${marginPercent.toFixed(1)}٪): این برآورد با زیان قراردادی بسته می‌شود.` })
  } else if (marginPercent != null && marginPercent < TARGET_MARGIN_WARNING_PERCENT) {
    messages.push({
      level: 'warning',
      text: `حاشیهٔ سود ${marginPercent.toFixed(1)}٪ و کمتر از ${TARGET_MARGIN_WARNING_PERCENT}٪ است؛ جای کمی برای جذب ریسک و تأخیر می‌ماند.`,
    })
  }
  const level: TargetLevel =
    targetProfit == null
      ? 'none'
      : messages.some((m) => m.level === 'critical')
        ? 'critical'
        : messages.length
          ? 'warning'
          : 'ok'

  return {
    targetProfit,
    marginPercent,
    burnRateMonthly: bacTotal != null && months != null && months > 0 ? bacTotal / months : null,
    overheadPerDay: plannedOverheadTotal != null && days != null && days > 0 ? plannedOverheadTotal / days : null,
    plannedOverheadTotal,
    durationDays: days,
    level,
    messages,
  }
}

/* ------------------------------------------------------------------ Status */

export type EstimateStatus = 'missing' | 'incomplete' | 'draft' | 'approved'

export interface EstimateIssue {
  level: 'warning' | 'info'
  message: string
}

/** Problems the manager should see before approving the estimate. */
export function estimateIssues(settings: CostEstimateSettings, direct: WbsDirectCost, bac: BacModel): EstimateIssue[] {
  const issues: EstimateIssue[] = []
  if (settings.contractValue == null) issues.push({ level: 'warning', message: 'ارزش قرارداد با کارفرما وارد نشده است.' })
  if (!settings.plannedStart || !settings.plannedFinish) {
    issues.push({ level: 'warning', message: 'تاریخ شروع و پایان مصوب کامل نیست؛ بالاسری و پرسنل برنامه‌ای محاسبه نمی‌شوند.' })
  }
  if (settings.monthlyOverhead == null && !settings.overheadInWbs) {
    issues.push({ level: 'warning', message: 'بالاسری ماهانه وارد نشده است (اگر بالاسری در بودجهٔ WBS است، گزینهٔ مربوط را بزنید).' })
  }
  if (direct.basis === 'none') {
    issues.push({ level: 'warning', message: 'هیچ ردیف WBS بودجه یا قیمت ندارد؛ هزینهٔ مستقیم صفر است.' })
  } else if (direct.basis === 'contract_value') {
    issues.push({
      level: 'warning',
      message: 'ستون «هزینه» برنامهٔ زمان‌بندی خالی است؛ هزینهٔ مستقیم از قیمت قراردادی ردیف‌ها (مقدار × قیمت واحد) گرفته شده و برآورد هزینهٔ داخلی نیست.',
    })
  }
  if (direct.missingRows.length > 0) {
    issues.push({
      level: 'warning',
      message: `${direct.missingRows.length} فعالیت وزن‌دار بدون بودجه یا قیمت در WBS است؛ هزینهٔ مستقیم ناقص است.`,
    })
  }
  if (settings.contractValue != null && bac.bacTotal > settings.contractValue && settings.contractValue > 0) {
    issues.push({ level: 'info', message: 'BAC کل از ارزش قرارداد بیشتر است؛ پروژه با این برآورد زیان قراردادی دارد.' })
  }
  if (settings.riskValue == null) issues.push({ level: 'info', message: 'ذخیرهٔ ریسک وارد نشده است (صفر در نظر گرفته می‌شود).' })
  return issues
}

export function estimateStatus(record: CostEstimateRecord | null, issues: EstimateIssue[]): EstimateStatus {
  if (!record) return 'missing'
  if (issues.some((i) => i.level === 'warning')) return record.approvedAt ? 'approved' : 'incomplete'
  return record.approvedAt ? 'approved' : 'draft'
}

/* ---------------------------------------------------------------------- AC */

export interface ActualCostPart {
  key: 'overhead' | 'contractor' | 'purchases'
  label: string
  amount: number
  source: string
}

export interface ActualCostModel {
  total: number
  parts: ActualCostPart[]
  /** Records shown for reference only; counting them would double the contractor and overhead parts. */
  excluded: Array<{ label: string; amount: number; count: number; reason: string }>
}

/** Sums each record once, even if a source lists it twice (e.g. a purchase read from two queries). */
export function sumUnique(records: Array<{ id: string; amount: number }>): { total: number; count: number } {
  const seen = new Map<string, number>()
  for (const r of records) {
    if (!r.id || seen.has(r.id)) continue
    seen.set(r.id, Number.isFinite(r.amount) && r.amount > 0 ? r.amount : 0)
  }
  let total = 0
  for (const amount of seen.values()) total += amount
  return { total, count: seen.size }
}

/* ---------------------------------------------------------------------- EVM */

export interface IndexValue {
  value: number | null
  /** Why the value is null. */
  reason?: string
}

export interface ManagerEvm {
  bacBase: number | null
  bacTotal: number | null
  pv: IndexValue
  ev: IndexValue
  ac: number
  cv: IndexValue
  sv: IndexValue
  cpi: IndexValue
  spi: IndexValue
  eac: IndexValue
  etc: IndexValue
  /** BAC total − EAC: positive = under the approved budget. */
  vac: IndexValue
  /** Contract value − EAC: the forecast contractual margin. */
  margin: IndexValue
  eacFormula: string
}

const NOT_ENOUGH = 'داده کافی نیست'

/**
 * PV = BAC base × planned %, EV = BAC base × approved earned %, both weighted by schedule weight (the
 * same basis as «پیشرفت تجمعی»). The risk reserve is outside the baseline, so PV/EV/EAC use BAC base;
 * VAC compares EAC with BAC total. Any ratio with a zero or missing denominator is null with a reason.
 */
export function computeManagerEvm(input: {
  bacBase: number | null
  bacTotal: number | null
  contractValue: number | null
  plannedPercent: number | null
  earnedPercent: number | null
  ac: number
}): ManagerEvm {
  const bac = input.bacBase != null && input.bacBase > 0 ? input.bacBase : null
  const noBac = 'BAC پایه ثبت نشده یا صفر است'
  const pct = (p: number | null) => (p == null || !Number.isFinite(p) ? null : Math.min(100, Math.max(0, p)))
  const planned = pct(input.plannedPercent)
  const earned = pct(input.earnedPercent)
  const ac = Number.isFinite(input.ac) && input.ac > 0 ? input.ac : 0

  const pv: IndexValue = bac == null ? { value: null, reason: noBac } : planned == null ? { value: null, reason: 'درصد برنامه‌ای در دست نیست' } : { value: (bac * planned) / 100 }
  const ev: IndexValue = bac == null ? { value: null, reason: noBac } : earned == null ? { value: null, reason: 'پیشرفت تأییدشده در دست نیست' } : { value: (bac * earned) / 100 }

  const cv: IndexValue = ev.value == null ? { value: null, reason: ev.reason } : { value: ev.value - ac }
  const sv: IndexValue = ev.value == null || pv.value == null ? { value: null, reason: ev.reason ?? pv.reason } : { value: ev.value - pv.value }

  const cpi: IndexValue =
    ev.value == null
      ? { value: null, reason: ev.reason }
      : ac <= 0
        ? { value: null, reason: `${NOT_ENOUGH}: هزینهٔ واقعی (AC) صفر است` }
        : { value: ev.value / ac }
  const spi: IndexValue =
    ev.value == null || pv.value == null
      ? { value: null, reason: ev.reason ?? pv.reason }
      : !(pv.value > 0)
        ? { value: null, reason: `${NOT_ENOUGH}: تا امروز کاری برنامه‌ریزی نشده (PV = 0)` }
        : { value: ev.value / pv.value }

  const eac: IndexValue =
    bac == null || ev.value == null
      ? { value: null, reason: ev.reason ?? noBac }
      : cpi.value == null
        ? { value: null, reason: cpi.reason }
        : !(cpi.value > 0)
          ? { value: null, reason: `${NOT_ENOUGH}: هنوز ارزشی کسب نشده (EV = 0)` }
          : { value: ac + (bac - ev.value) / cpi.value }
  const etc: IndexValue = eac.value == null ? { value: null, reason: eac.reason } : { value: Math.max(0, eac.value - ac) }
  const bacTotal = input.bacTotal != null && input.bacTotal > 0 ? input.bacTotal : null
  const vac: IndexValue = eac.value == null || bacTotal == null ? { value: null, reason: eac.reason ?? noBac } : { value: bacTotal - eac.value }
  const margin: IndexValue =
    eac.value == null
      ? { value: null, reason: eac.reason }
      : input.contractValue == null
        ? { value: null, reason: 'ارزش قرارداد وارد نشده است' }
        : { value: input.contractValue - eac.value }

  return {
    bacBase: bac,
    bacTotal,
    pv,
    ev,
    ac,
    cv,
    sv,
    cpi,
    spi,
    eac,
    etc,
    vac,
    margin,
    eacFormula: 'EAC = AC + (BAC پایه − EV) ÷ CPI — فرض: کار باقی‌مانده با همان کارایی هزینه‌ای تاکنون انجام می‌شود',
  }
}

/* ------------------------------------------------------------------- Alerts */

/** Every alert threshold in one place. */
export const ESTIMATE_ALERT_THRESHOLDS = {
  cpiWarning: 0.95,
  cpiCritical: 0.9,
  spiWarning: 0.95,
  spiCritical: 0.9,
  /** Percent points between the schedule's stored progress and the latest supervisor report. */
  progressGapWarning: 5,
  progressGapCritical: 15,
  delayWarningDays: 7,
  delayCriticalDays: 30,
  ppcTarget: 80,
  ppcLow: 60,
  /** Share (%) of weighted activities without a budget that turns the incomplete-WBS alert red. */
  missingBudgetCriticalShare: 25,
} as const

export type EstimateThresholds = { -readonly [K in keyof typeof ESTIMATE_ALERT_THRESHOLDS]: number }

export type EstimateAlertLevel = 'info' | 'warning' | 'critical'

export interface EstimateAlert {
  id: string
  level: EstimateAlertLevel
  title: string
  cause: string
  /** The numbers the alert rests on. */
  basis: string
  action: string
  items?: Array<{ label: string; detail: string }>
}

export interface ProgressCompareRow {
  id: string
  name: string
  wbs: string | null
  /** Percent stored on the activity (basis of EV). */
  stored: number
  /** Latest supervisor daily report, or null when none exists. */
  supervisor: number | null
  supervisorDate: string | null
  plannedPercent: number
  /** Baseline start on or before today. */
  started: boolean
}

export interface PpcSignal {
  ppc: number | null
  weekLabel: string | null
  missed: number
  /** Missed commitments with no recorded reason (RNC). */
  missedWithoutReason: number
  /** `schedule`: commitments come from the schedule, which has no RNC field. */
  source: 'schedule' | 'wwp'
}

export interface EstimateAlertInput {
  status: EstimateStatus
  issues: EstimateIssue[]
  evm: ManagerEvm
  monthlyOverhead: number | null
  delayDays: number | null
  progress: ProgressCompareRow[]
  direct: WbsDirectCost
  ppc: PpcSignal | null
  thresholds?: Partial<EstimateThresholds>
}

const fmt2 = (n: number) => n.toFixed(2)
const fmtPct = (n: number) => `${Math.round(n * 10) / 10}%`

function levelBelow(value: number, warning: number, critical: number): EstimateAlertLevel | null {
  if (value < critical) return 'critical'
  if (value < warning) return 'warning'
  return null
}

export function buildEstimateAlerts(input: EstimateAlertInput): EstimateAlert[] {
  const t = { ...ESTIMATE_ALERT_THRESHOLDS, ...input.thresholds }
  const alerts: EstimateAlert[] = []
  const { evm } = input

  if (input.status === 'missing' || input.status === 'incomplete') {
    const warnings = input.issues.filter((i) => i.level === 'warning')
    alerts.push({
      id: 'estimate-incomplete',
      level: input.status === 'missing' ? 'warning' : 'info',
      title: input.status === 'missing' ? 'برآورد اولیه ثبت نشده است' : 'برآورد اولیه کامل نیست',
      cause:
        input.status === 'missing'
          ? 'برای این پروژه هنوز تنظیمات مالی و برآورد اولیه ذخیره نشده؛ BAC و شاخص‌های هزینه محاسبه نمی‌شوند.'
          : 'بعضی اجزای BAC وارد نشده یا داده‌های WBS ناقص است.',
      basis: warnings.length ? `${warnings.length} مورد نیازمند تکمیل` : '—',
      action: 'بخش «تنظیمات مالی و برآورد اولیه» را تکمیل و ذخیره کنید.',
      items: warnings.map((w) => ({ label: w.message, detail: '' })),
    })
  }

  if (evm.bacTotal != null && evm.ac > evm.bacTotal) {
    alerts.push({
      id: 'ac-over-bac',
      level: 'critical',
      title: 'هزینهٔ واقعی از BAC کل بیشتر شده است',
      cause: 'هزینهٔ ثبت‌شده تا امروز از کل بودجهٔ مصوب پروژه عبور کرده است.',
      basis: `AC = ${money(evm.ac)} > BAC کل = ${money(evm.bacTotal)} ${ESTIMATE_CURRENCY}`,
      action: 'پیش از هر تصمیمی منبع داده را بررسی کنید: BAC ناقص (ردیف‌های بی‌قیمت WBS) یا هزینهٔ ثبت‌شدهٔ اشتباه هم همین نتیجه را می‌دهد.',
    })
  }

  if (evm.cpi.value != null && evm.ev.value != null) {
    const level = levelBelow(evm.cpi.value, t.cpiWarning, t.cpiCritical)
    if (level) {
      alerts.push({
        id: 'cpi',
        level,
        title: 'هزینهٔ واقعی بیشتر از ارزش کار انجام‌شده',
        cause: 'به ازای هر تومان هزینه، کمتر از یک تومان ارزش کسب شده است (AC > EV).',
        basis: `CPI = EV ÷ AC = ${money(evm.ev.value)} ÷ ${money(evm.ac)} = ${fmt2(evm.cpi.value)} (آستانه‌ها: ${t.cpiWarning} و ${t.cpiCritical})`,
        action: 'هزینه‌های هر جزء (بالاسری، پیمانکاران، خرید) را با پیشرفت تأییدشده تطبیق دهید و اقلام بدون پیشرفت متناظر را پیگیری کنید.',
      })
    }
  }

  if (evm.spi.value != null && evm.pv.value != null && evm.ev.value != null) {
    const level = levelBelow(evm.spi.value, t.spiWarning, t.spiCritical)
    if (level) {
      alerts.push({
        id: 'spi',
        level,
        title: 'پیشرفت از برنامه عقب است',
        cause: 'ارزش کار انجام‌شده کمتر از ارزش برنامه‌ریزی‌شده تا امروز است.',
        basis: `SPI = EV ÷ PV = ${money(evm.ev.value)} ÷ ${money(evm.pv.value)} = ${fmt2(evm.spi.value)}`,
        action: 'فعالیت‌های عقب‌افتادهٔ مسیر بحرانی را اولویت‌بندی و برنامهٔ جبرانی را تصویب کنید.',
      })
    }
  }

  if (input.delayDays != null && input.delayDays >= t.delayWarningDays) {
    const extra = input.monthlyOverhead != null ? (input.monthlyOverhead * input.delayDays) / 30.44 : null
    alerts.push({
      id: 'delay-overhead',
      level: input.delayDays >= t.delayCriticalDays ? 'critical' : 'warning',
      title: 'تأخیر پیش‌بینی‌شده و افزایش بالاسری',
      cause: 'با روند فعلی (SPI(t)) پروژه دیرتر از برنامه تمام می‌شود و بالاسری وابسته به زمان بیشتر می‌شود.',
      basis:
        extra != null
          ? `تأخیر ≈ ${Math.round(input.delayDays)} روز × بالاسری ماهانه ${money(input.monthlyOverhead!)} ÷ 30.44 ≈ ${money(extra)} ${ESTIMATE_CURRENCY} بالاسری اضافه`
          : `تأخیر ≈ ${Math.round(input.delayDays)} روز (بالاسری ماهانه وارد نشده؛ اثر مالی محاسبه نمی‌شود)`,
      action: 'برنامهٔ جبرانی را با هزینهٔ بالاسری اضافه مقایسه کنید و در صورت نیاز تمدید قرارداد را پیگیری کنید.',
    })
  }

  const gaps = input.progress
    .filter((r) => r.supervisor != null && Math.abs(r.stored - r.supervisor) >= t.progressGapWarning)
    .sort((a, b) => Math.abs(b.stored - b.supervisor!) - Math.abs(a.stored - a.supervisor!))
  if (gaps.length) {
    const max = Math.abs(gaps[0]!.stored - gaps[0]!.supervisor!)
    alerts.push({
      id: 'progress-gap',
      level: max >= t.progressGapCritical ? 'critical' : 'warning',
      title: 'اختلاف پیشرفت ثبت‌شده با گزارش سرپرست',
      cause: 'درصد ثبت‌شده روی فعالیت (مبنای EV) با آخرین گزارش روزانهٔ سرپرست یکی نیست. هیچ‌کدام خودکار جایگزین نمی‌شود.',
      basis: `${gaps.length} فعالیت با اختلاف ≥ ${t.progressGapWarning} واحد درصد؛ بیشترین ${fmtPct(max)}`,
      action: 'مقدار درست را با سرپرست و دفتر فنی بررسی و در برنامه یا گزارش روزانه اصلاح کنید.',
      items: gaps.slice(0, 10).map((r) => ({
        label: `${r.wbs ? `${r.wbs} · ` : ''}${r.name}`,
        detail: `ثبت‌شده در برنامه ${fmtPct(r.stored)} · گزارش سرپرست ${fmtPct(r.supervisor!)}${r.supervisorDate ? ` (${r.supervisorDate})` : ''}`,
      })),
    })
  }

  if (input.direct.missingRows.length) {
    const weighted = input.direct.missingRows.length + input.direct.rows.filter((r) => r.weight > 0).length
    const share = weighted > 0 ? (input.direct.missingRows.length / weighted) * 100 : 100
    alerts.push({
      id: 'wbs-incomplete',
      level: share >= t.missingBudgetCriticalShare ? 'critical' : 'warning',
      title: 'بودجهٔ WBS ناقص است',
      cause: 'فعالیت‌های وزن‌دار بدون بودجه یا قیمت، هزینهٔ مستقیم و BAC را کمتر از واقع نشان می‌دهند.',
      basis: `${input.direct.missingRows.length} از ${weighted} فعالیت وزن‌دار (${fmtPct(share)}) بدون بودجه`,
      action: 'دفتر فنی ستون «هزینه» یا قیمت واحد این ردیف‌ها را در برنامهٔ زمان‌بندی تکمیل کند.',
      items: input.direct.missingRows.slice(0, 10).map((r) => ({ label: `${r.wbs ? `${r.wbs} · ` : ''}${r.name}`, detail: `وزن ${fmtPct(r.weight)}` })),
    })
  } else if (input.direct.basis === 'contract_value') {
    alerts.push({
      id: 'wbs-contract-price',
      level: 'info',
      title: 'هزینهٔ مستقیم از قیمت قراردادی گرفته شده است',
      cause: 'ستون «هزینه» برنامهٔ زمان‌بندی خالی است؛ مقدار × قیمت واحد جایگزین برآورد هزینهٔ داخلی شده است.',
      basis: `هزینهٔ مستقیم = ${money(input.direct.total)} ${ESTIMATE_CURRENCY}`,
      action: 'اگر برآورد هزینهٔ داخلی با قیمت قراردادی فرق دارد، دفتر فنی ستون «هزینه» را پر کند.',
    })
  }

  const stalled = input.progress.filter((r) => r.started && r.plannedPercent > 0 && r.stored <= 0)
  const noReport = stalled.filter((r) => r.supervisor == null)
  const zeroReport = stalled.filter((r) => r.supervisor != null)
  if (noReport.length) {
    alerts.push({
      id: 'no-report',
      level: 'warning',
      title: 'فعالیت شروع‌شده بدون هیچ گزارشی',
      cause: 'طبق برنامه این فعالیت‌ها باید شروع شده باشند، ولی سرپرست هنوز هیچ گزارشی برایشان ثبت نکرده است.',
      basis: `${noReport.length} فعالیت با پیشرفت برنامه‌ای > 0 و بدون گزارش`,
      action: 'از سرپرست بخواهید وضعیت این فعالیت‌ها را در گزارش روزانه ثبت کند (حتی اگر صفر است).',
      items: noReport.slice(0, 10).map((r) => ({ label: `${r.wbs ? `${r.wbs} · ` : ''}${r.name}`, detail: `برنامه ${fmtPct(r.plannedPercent)} · گزارشی ثبت نشده` })),
    })
  }
  if (zeroReport.length) {
    alerts.push({
      id: 'zero-progress',
      level: 'info',
      title: 'گزارش ثبت شده اما پیشرفت صفر است',
      cause: 'سرپرست این فعالیت‌ها را گزارش کرده، ولی پیشرفتی نداشته‌اند.',
      basis: `${zeroReport.length} فعالیت با گزارش و پیشرفت 0%`,
      action: 'علت توقف (مصالح، نیرو، جبههٔ کاری) را از سرپرست بپرسید.',
      items: zeroReport.slice(0, 10).map((r) => ({
        label: `${r.wbs ? `${r.wbs} · ` : ''}${r.name}`,
        detail: `برنامه ${fmtPct(r.plannedPercent)} · آخرین گزارش ${r.supervisorDate ?? ''}`,
      })),
    })
  }

  const ppc = input.ppc
  if (ppc && ppc.ppc != null && ppc.ppc < t.ppcTarget) {
    const missingReasons = ppc.missedWithoutReason
    alerts.push({
      id: 'ppc-rnc',
      level: ppc.ppc < t.ppcLow ? 'critical' : 'warning',
      title: missingReasons > 0 ? 'PPC پایین و علت عدم تحقق ثبت نشده' : 'PPC کمتر از هدف',
      cause:
        missingReasons > 0
          ? ppc.source === 'schedule'
            ? 'تعهدات این هفته از برنامهٔ زمان‌بندی خوانده می‌شود که فیلد علت عدم تحقق (RNC) ندارد؛ علت هیچ تعهد محقق‌نشده‌ای ثبت نشده است.'
            : 'برای بعضی تعهدات محقق‌نشده علت ثبت نشده است.'
          : 'درصد تحقق تعهدات هفتگی کمتر از هدف است.',
      basis: `PPC ${ppc.weekLabel ?? ''} = ${fmtPct(ppc.ppc)} (هدف ${t.ppcTarget}%) · ${ppc.missed} تعهد محقق‌نشده${missingReasons > 0 ? `، ${missingReasons} بدون علت` : ''}`,
      action:
        ppc.source === 'schedule'
          ? 'علت عدم تحقق را با سرپرست مرور کنید؛ برای ثبت اجباری RNC، برنامهٔ هفتگی متعهد (migration 100) باید فعال شود.'
          : 'علت هر تعهد محقق‌نشده را پیش از بستن هفته ثبت کنید.',
    })
  }

  const order: Record<EstimateAlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}
