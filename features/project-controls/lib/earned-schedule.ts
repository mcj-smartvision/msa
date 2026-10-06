import type {
ControlsEngineResult,
EarnedScheduleInput, PVCurvePoint,
RagStatus
} from '@/shared/types/project-controls'
import { todayTehranIso, toTehranDateOnly } from '@/shared/lib/time/tehran'

const DAY_MS = 86_400_000

export const DAYS_PER_UNIT = { days: 1, weeks: 7, months: 30.44 } as const

const UNIT_FA: Record<keyof typeof DAYS_PER_UNIT, string> = { days: 'روز', weeks: 'هفته', months: 'ماه' }

export const RAG_TOKENS: Record<RagStatus, { bg: string; text: string; border: string; accent: string }> = {
  CRITICAL: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: 'rose-600' },
  WARNING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: 'amber-600' },
  HEALTHY: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'emerald-600' },
}

export const RAG_LABEL_FA: Record<RagStatus, string> = { HEALTHY: 'سالم', WARNING: 'هشدار', CRITICAL: 'بحرانی' }

export class EarnedScheduleDomainError extends Error {
  constructor(
    readonly code: 'INVALID_DATE' | 'NON_POSITIVE_AT' | 'EMPTY_CURVE' | 'INVALID_CURVE' | 'INVALID_DURATION' | 'INVALID_EV' | 'INVALID_UNIT',
    message: string
  ) {
    super(message)
    this.name = 'EarnedScheduleDomainError'
  }
}

/** SPI(t) < 0.90 critical, 0.90–0.98 warning, ≥ 0.98 healthy; an undefined index is critical. */
export function ragFromSpiT(spiT: number | null): RagStatus {
  if (spiT == null || !Number.isFinite(spiT) || spiT < 0.9) return 'CRITICAL'
  if (spiT < 0.98) return 'WARNING'
  return 'HEALTHY'
}

function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

function fmt(value: number, digits = 2): string {
  return round(value, digits).toFixed(digits)
}

function faNum(value: number, digits = 2): string {
  return round(value, digits).toLocaleString('fa-IR', { maximumFractionDigits: digits })
}

function dateOnly(value: Date | string, field: string): string {
  const iso = value instanceof Date ? (Number.isNaN(value.getTime()) ? null : toTehranDateOnly(value.toISOString())) : toTehranDateOnly(value)
  if (!iso || Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) {
    throw new EarnedScheduleDomainError('INVALID_DATE', `${field} تاریخ معتبر نیست`)
  }
  return iso
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS)
}

function normalizeCurve(points: PVCurvePoint[]): PVCurvePoint[] {
  if (!points?.length) throw new EarnedScheduleDomainError('EMPTY_CURVE', 'منحنی PV مبنا خالی است')
  const curve = [...points].sort((a, b) => a.periodIndex - b.periodIndex)
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i]!
    if (!Number.isFinite(p.periodIndex) || !Number.isFinite(p.cumulativePV) || p.cumulativePV < 0) {
      throw new EarnedScheduleDomainError('INVALID_CURVE', `نقطهٔ ${i} منحنی PV معتبر نیست`)
    }
    if (i > 0 && p.cumulativePV < curve[i - 1]!.cumulativePV - 1e-9) {
      throw new EarnedScheduleDomainError('INVALID_CURVE', 'منحنی PV تجمعی نباید نزولی باشد')
    }
    if (i > 0 && p.periodIndex === curve[i - 1]!.periodIndex) {
      throw new EarnedScheduleDomainError('INVALID_CURVE', `دورهٔ ${p.periodIndex} در منحنی PV تکراری است`)
    }
  }
  return curve
}

export interface EarnedScheduleSolution {
  es: number
  bac: number
  /** Index of the bracketing point C (null when ES is fixed by an edge case). */
  c: { index: number; periodIndex: number; pv: number } | null
  next: { periodIndex: number; pv: number } | null
  fraction: number
  rule: 'ev_non_positive' | 'ev_at_or_above_bac' | 'before_first_point' | 'interpolated'
}

/** ES = C + I on the cumulative baseline PV curve (`PV_C ≤ EV < PV_C+1`, I = (EV − PV_C) ÷ (PV_C+1 − PV_C)). */
export function solveEarnedSchedule(curveInput: PVCurvePoint[], ev: number, plannedDuration: number): EarnedScheduleSolution {
  const curve = normalizeCurve(curveInput)
  const bac = curve[curve.length - 1]!.cumulativePV
  if (ev <= 0) return { es: 0, bac, c: null, next: null, fraction: 0, rule: 'ev_non_positive' }
  if (ev >= bac) return { es: plannedDuration, bac, c: null, next: null, fraction: 0, rule: 'ev_at_or_above_bac' }

  const first = curve[0]!
  if (ev < first.cumulativePV) {
    const fraction = first.cumulativePV > 0 ? ev / first.cumulativePV : 0
    return { es: first.periodIndex * fraction, bac, c: null, next: { periodIndex: first.periodIndex, pv: first.cumulativePV }, fraction, rule: 'before_first_point' }
  }

  let c = 0
  for (let i = 0; i < curve.length - 1; i++) {
    if (curve[i]!.cumulativePV <= ev && ev < curve[i + 1]!.cumulativePV) {
      c = i
      break
    }
  }
  const pc = curve[c]!
  const pn = curve[c + 1]!
  const span = pn.cumulativePV - pc.cumulativePV
  const fraction = span > 0 ? (ev - pc.cumulativePV) / span : 0
  return {
    es: pc.periodIndex + fraction * (pn.periodIndex - pc.periodIndex),
    bac,
    c: { index: c, periodIndex: pc.periodIndex, pv: pc.cumulativePV },
    next: { periodIndex: pn.periodIndex, pv: pn.cumulativePV },
    fraction,
    rule: 'interpolated',
  }
}

export function computeEarnedSchedule(input: EarnedScheduleInput, options: { now?: Date } = {}): ControlsEngineResult {
  const periodUnit = input.periodUnit ?? 'months'
  if (!(periodUnit in DAYS_PER_UNIT)) throw new EarnedScheduleDomainError('INVALID_UNIT', `واحد دورهٔ ${periodUnit} پشتیبانی نمی‌شود`)
  const daysPerUnit = input.customDaysPerUnit ?? DAYS_PER_UNIT[periodUnit]
  if (!(daysPerUnit > 0)) throw new EarnedScheduleDomainError('INVALID_UNIT', 'تعداد روز هر دوره باید مثبت باشد')
  const pd = input.plannedDurationPeriods
  if (!Number.isFinite(pd) || pd <= 0) throw new EarnedScheduleDomainError('INVALID_DURATION', 'مدت برنامه‌ریزی‌شده (PD) باید مثبت باشد')
  const ev = input.currentEV
  if (!Number.isFinite(ev)) throw new EarnedScheduleDomainError('INVALID_EV', 'ارزش کسب‌شده (EV) عدد معتبر نیست')

  const now = options.now ?? new Date()
  const start = dateOnly(input.projectStartDate, 'تاریخ شروع پروژه')
  const status = input.statusDate != null ? dateOnly(input.statusDate, 'تاریخ وضعیت') : todayTehranIso(now.getTime())
  const elapsedDays = daysBetween(start, status)
  const at = elapsedDays / daysPerUnit
  if (at <= 0) {
    throw new EarnedScheduleDomainError('NON_POSITIVE_AT', `زمان واقعی (AT) باید مثبت باشد؛ تاریخ وضعیت ${status} قبل از شروع ${start} یا برابر آن است`)
  }

  const unit = UNIT_FA[periodUnit]
  const unitAssumption =
    periodUnit === 'days' && daysPerUnit === 1 ? 'واحد دوره: روز تقویمی' : `هر ${unit} = ${daysPerUnit} روز تقویمی`
  const assumptions = [unitAssumption, 'تقویم: روز تقویمی (بدون تعطیلات)', 'تاریخ‌ها بر مبنای تقویم تهران (Asia/Tehran)']

  const sol = solveEarnedSchedule(input.baselinePVCurve, ev, pd)
  const es = sol.es
  const spiT = es > 0 ? es / at : 0
  const svT = es - at
  const eacT = spiT > 0 ? pd / spiT : null
  const delayPeriods = eacT == null ? null : eacT - pd
  const delayDays = delayPeriods == null ? null : delayPeriods * daysPerUnit
  const rag = ragFromSpiT(eacT == null ? null : spiT)

  const esSubstitution =
    sol.rule === 'ev_non_positive'
      ? `EV = ${fmt(ev)} ≤ 0 ⇒ ES = 0`
      : sol.rule === 'ev_at_or_above_bac'
        ? `EV = ${fmt(ev)} ≥ BAC = ${fmt(sol.bac)} ⇒ ES = PD = ${fmt(pd)}`
        : sol.rule === 'before_first_point'
          ? `EV = ${fmt(ev)} < PV_0 = ${fmt(sol.next!.pv)} ⇒ ES = ${fmt(sol.next!.periodIndex)} × ${fmt(sol.fraction, 4)} = ${fmt(es)}`
          : `PV_C = ${fmt(sol.c!.pv)} ≤ EV = ${fmt(ev)} < PV_C+1 = ${fmt(sol.next!.pv)} ⇒ I = (${fmt(ev)} − ${fmt(sol.c!.pv)}) ÷ (${fmt(sol.next!.pv)} − ${fmt(sol.c!.pv)}) = ${fmt(sol.fraction, 4)} ⇒ ES = ${fmt(sol.c!.periodIndex)} + ${fmt(sol.fraction, 4)}${sol.next!.periodIndex - sol.c!.periodIndex !== 1 ? ` × ${fmt(sol.next!.periodIndex - sol.c!.periodIndex)}` : ''} = ${fmt(es)}`

  const metrics: ControlsEngineResult['metrics'] = {
    at: {
      key: 'at',
      label_fa: 'زمان واقعی سپری‌شده (AT)',
      value: round(at, 2),
      unit,
      formula: 'AT = (statusDate − projectStartDate) ÷ daysPerUnit',
      substitution: `AT = (${status} − ${start}) ÷ ${daysPerUnit} = ${elapsedDays} ÷ ${daysPerUnit} = ${fmt(at)}`,
      interpretation_fa: `از شروع پروژه تا تاریخ وضعیت ${faNum(at)} ${unit} گذشته است.`,
      assumptions,
      debug: { start, status, elapsedDays, daysPerUnit },
    },
    es: {
      key: 'es',
      label_fa: 'زمان کسب‌شده (ES)',
      value: round(es, 2),
      unit,
      formula: 'ES = C + I ;  I = (EV − PV_C) ÷ (PV_C+1 − PV_C) ;  PV_C ≤ EV < PV_C+1',
      substitution: esSubstitution,
      interpretation_fa: `کار انجام‌شده تا امروز معادل ${faNum(es)} ${unit} از برنامهٔ مبناست.`,
      assumptions: [...assumptions, 'منحنی PV تجمعی مبنا (baseline) و غیرنزولی است', 'BAC = بیشینهٔ PV منحنی'],
      debug: { ...sol, ev },
    },
    spi_t: {
      key: 'spi_t',
      label_fa: 'شاخص عملکرد زمانی مبتنی بر زمان (SPI(t))',
      value: eacT == null ? null : round(spiT, 3),
      unit: 'ضریب',
      formula: 'SPI(t) = ES ÷ AT',
      substitution: `SPI(t) = ${fmt(es)} ÷ ${fmt(at)} = ${fmt(spiT, 3)}`,
      interpretation_fa:
        eacT == null
          ? 'هنوز ارزشی کسب نشده و سرعت اجرا قابل‌محاسبه نیست؛ وضعیت بحرانی تلقی می‌شود.'
          : spiT >= 1
            ? `به ازای هر ${unit} سپری‌شده، ${faNum(spiT, 2)} ${unit} از برنامه انجام شده است؛ پروژه جلوتر یا هم‌گام با برنامه است.`
            : `به ازای هر ${unit} سپری‌شده فقط ${faNum(spiT, 2)} ${unit} از برنامه انجام شده است؛ سرعت اجرا ${faNum((1 - spiT) * 100, 0)}٪ کمتر از برنامه است.`,
      rag,
      assumptions,
    },
    sv_t: {
      key: 'sv_t',
      label_fa: 'انحراف زمانی مبتنی بر زمان (SV(t))',
      value: round(svT, 2),
      unit,
      formula: 'SV(t) = ES − AT',
      substitution: `SV(t) = ${fmt(es)} − ${fmt(at)} = ${fmt(svT)}`,
      interpretation_fa:
        svT < 0
          ? `پروژه ${faNum(-svT)} ${unit} (حدود ${faNum(-svT * daysPerUnit, 0)} روز) از برنامه عقب است.`
          : svT > 0
            ? `پروژه ${faNum(svT)} ${unit} (حدود ${faNum(svT * daysPerUnit, 0)} روز) از برنامه جلوتر است.`
            : 'پروژه دقیقاً مطابق برنامه است.',
      rag,
      assumptions,
    },
    eac_t: {
      key: 'eac_t',
      label_fa: 'مدت پیش‌بینی‌شدهٔ تکمیل (EAC(t))',
      value: eacT == null ? null : round(eacT, 2),
      unit,
      formula: 'EAC(t) = PD ÷ SPI(t)',
      substitution: eacT == null ? `SPI(t) = ${fmt(spiT, 3)} ≤ 0 ⇒ EAC(t) تعریف‌نشده` : `EAC(t) = ${fmt(pd)} ÷ ${fmt(spiT, 3)} = ${fmt(eacT)}`,
      interpretation_fa:
        eacT == null
          ? 'تا وقتی ارزشی کسب نشده، مدت تکمیل قابل پیش‌بینی نیست.'
          : `اگر سرعت فعلی ادامه یابد، کل پروژه ${faNum(eacT)} ${unit} طول می‌کشد (مدت برنامه ${faNum(pd)} ${unit}).`,
      rag,
      assumptions: [...assumptions, 'سرعت اجرای باقی‌مانده برابر SPI(t) فعلی فرض شده است'],
    },
    delay_forecast: {
      key: 'delay_forecast',
      label_fa: 'تأخیر پیش‌بینی‌شده (روز تقویمی)',
      value: delayDays == null ? null : round(delayDays, 0),
      unit: 'روز',
      formula: 'Delay = (EAC(t) − PD) × daysPerUnit',
      substitution:
        delayDays == null
          ? 'EAC(t) تعریف‌نشده ⇒ تأخیر قابل محاسبه نیست'
          : `Delay = (${fmt(eacT!)} − ${fmt(pd)}) × ${daysPerUnit} = ${fmt(delayPeriods!)} × ${daysPerUnit} = ${fmt(delayDays, 0)}`,
      interpretation_fa:
        delayDays == null
          ? 'پیش‌بینی تأخیر ممکن نیست.'
          : delayDays > 0
            ? `با ادامهٔ سرعت فعلی، پایان پروژه حدود ${faNum(delayDays, 0)} روز دیرتر از برنامه پیش‌بینی می‌شود (تأخیر پیش‌بینی‌شده).`
            : delayDays < 0
              ? `با ادامهٔ سرعت فعلی، پروژه حدود ${faNum(-delayDays, 0)} روز زودتر از برنامه تمام می‌شود (تعجیل).`
              : 'پایان پروژه مطابق برنامه پیش‌بینی می‌شود.',
      rag,
      assumptions: [...assumptions, 'سرعت اجرای باقی‌مانده برابر SPI(t) فعلی فرض شده است'],
    },
  }

  const summaryTextFa =
    eacT == null
      ? `وضعیت ${RAG_LABEL_FA[rag]}: هنوز ارزشی کسب نشده و شاخص‌های زمانی قابل‌محاسبه نیستند.`
      : `وضعیت ${RAG_LABEL_FA[rag]}: SPI(t) = ${faNum(spiT, 2)}؛ ${metrics.sv_t.interpretation_fa} ${metrics.delay_forecast.interpretation_fa}`

  const { bg, text, border } = RAG_TOKENS[rag]
  return { metrics, overallRag: rag, ragTokens: { bg, text, border }, summaryTextFa, computedAt: now.toISOString() }
}
