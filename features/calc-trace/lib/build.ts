import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import type { CalcTrace, CalcTraceInput, CalcTraceStatus, CalcTraceUnit } from './types'

/** Thresholds of the automatic ledger warnings. */
export const CALC_TRACE_THRESHOLDS = {
  /** Stored (MSP) vs supervisor weighted progress, in percentage points. */
  progressGapPoints: 3,
  cpiCritical: 0.8,
  /** PV counts as flat when this many consecutive curve points have the same value. */
  flatPvPoints: 3,
} as const

export function formatTraceValue(value: number | string | null | undefined, unit: CalcTraceUnit): string {
  if (value == null) return '—'
  if (typeof value === 'string') return unit === 'text' && /^\d{4}-\d{2}-\d{2}/.test(value) ? jalaliDate(value) : value
  if (!Number.isFinite(value)) return '—'
  switch (unit) {
    case 'index':
      return faNumber(value, 2)
    case 'percent':
      return `${faNumber(value, 1)}٪`
    case 'points':
      return `${faNumber(value, 1)} واحد درصد`
    case 'toman':
      return `${faNumber(Math.round(value))} تومان`
    case 'toman_per_month':
      return `${faNumber(Math.round(value))} تومان در ماه`
    case 'toman_per_day':
      return `${faNumber(Math.round(value))} تومان در روز`
    case 'days':
      return `${faNumber(value, 1)} روز`
    case 'months':
      return `${faNumber(value, 2)} ماه`
    case 'weight':
      return faNumber(value, 2)
    case 'count':
      return faNumber(value)
    default:
      return String(value)
  }
}

/** Shorthand for `formulaHuman`: a value formatted in its unit. */
export const v = formatTraceValue

export function traceInput(
  key: string,
  label: string,
  value: number | string | null,
  unit: CalcTraceUnit,
  source: CalcTraceInput['source'],
  updatedAt?: string | null
): CalcTraceInput {
  return { key, label, value, unit, source, updatedAt: updatedAt ?? null }
}

export function makeTrace(input: {
  metric: string
  label: string
  result: number | null
  unit: CalcTraceUnit
  formula: string
  formulaHuman: string
  inputs: CalcTraceInput[]
  warnings?: (string | null | undefined)[]
  critical?: boolean
  computedAt?: string
}): CalcTrace {
  const warnings = (input.warnings ?? []).filter((w): w is string => Boolean(w))
  const status: CalcTraceStatus =
    input.result == null || !Number.isFinite(input.result)
      ? 'insufficient'
      : input.critical
        ? 'critical'
        : warnings.length
          ? 'warning'
          : 'ok'
  return {
    metric: input.metric,
    label: input.label,
    result: input.result != null && Number.isFinite(input.result) ? input.result : null,
    unit: input.unit,
    status,
    formula: input.formula,
    formulaHuman: input.formulaHuman,
    inputs: input.inputs,
    warnings,
    previousPeriod: null,
    history: [],
    historyNote: null,
    computedAt: input.computedAt ?? new Date().toISOString(),
  }
}

/* ------------------------------------------------------------ Automatic warnings */

export function warnBacScope(input: { bacIsWbsOnly: boolean; acOverhead: number }): string | null {
  return input.bacIsWbsOnly && input.acOverhead > 0
    ? `AC شامل بالاسری است (${formatTraceValue(input.acOverhead, 'toman')}) اما BAC فقط هزینهٔ مستقیم WBS را دربر می‌گیرد — CPI کمتر از واقع نشان داده می‌شود.`
    : null
}

export function warnPpcZeroDenominator(planned: number | null): string | null {
  return planned == null || planned === 0 ? 'هیچ تعهد هفتگی ثبت نشده — PPC قابل محاسبه نیست.' : null
}

/**
 * The project PV curve is a straight line (uniform spread) or stops moving before 100%, instead of the
 * S shape the activity baselines should give. `points` are cumulative planned percents, oldest first.
 */
export function warnUniformPv(points: number[]): string | null {
  const n = CALC_TRACE_THRESHOLDS.flatPvPoints
  const inPlan = points.filter((p) => p > 0.05 && p < 99.95)
  if (inPlan.length >= n) {
    const tail = inPlan.slice(-n)
    const last = tail[tail.length - 1]!
    if (tail.every((x) => Math.abs(x - last) < 0.005)) {
      return `PV در ${faNumber(n)} دورهٔ آخر ثابت مانده (${formatTraceValue(last, 'percent')}) — تاریخ‌های baseline یا وزن فعالیت‌های این بازه را بررسی کنید.`
    }
  }
  if (points.length >= 4) {
    const first = points[0]!
    const last = points[points.length - 1]!
    const step = (last - first) / (points.length - 1)
    const linear = step > 0.05 && points.every((p, i) => Math.abs(p - (first + step * i)) < 0.5)
    if (linear) return 'PV بر اساس توزیع یکنواخت محاسبه شده — منحنی S واقعی اعمال نشده (همهٔ دوره‌ها سهم برابر دارند).'
  }
  return null
}

export function warnProgressGap(stored: number | null, supervisor: number | null): string | null {
  if (stored == null || supervisor == null) return null
  const gap = stored - supervisor
  return Math.abs(gap) > CALC_TRACE_THRESHOLDS.progressGapPoints
    ? `مغایرت پیشرفت: مدیر پروژه (MSP) ${formatTraceValue(Math.abs(gap), 'percent')} ${gap > 0 ? 'بیشتر' : 'کمتر'} از سرپرست گزارش داده (آستانه ${faNumber(CALC_TRACE_THRESHOLDS.progressGapPoints)}٪).`
    : null
}

export function warnEacBelowAc(eac: number | null, ac: number | null): string | null {
  return eac != null && ac != null && eac < ac
    ? `EAC (${formatTraceValue(eac, 'toman')}) از AC (${formatTraceValue(ac, 'toman')}) کمتر است — خطای منطقی در داده‌های ورودی.`
    : null
}

export function cpiIsCritical(cpi: number | null): boolean {
  return cpi != null && cpi > 0 && cpi < CALC_TRACE_THRESHOLDS.cpiCritical
}

export function warnCpiLow(cpi: number | null): string | null {
  return cpiIsCritical(cpi)
    ? `بحران هزینه: به ازای هر 1 تومان کار انجام‌شده، ${faNumber(1 / cpi!, 2)} تومان هزینه شده.`
    : null
}

/* ------------------------------------------------------------ Shared metric builders */

export interface ProgressCompareInput {
  id: string
  name: string
  wbs: string | null
  weight: number
  /** Stored (MSP / schedule) physical percent — the EV basis. */
  stored: number
  /** Latest supervisor daily report; null when never reported. */
  supervisor: number | null
  supervisorDate: string | null
  table: 'project_tasks' | 'workshop_packages'
}

/**
 * Manager (stored) vs supervisor weighted progress, over the activities the supervisor has reported.
 * Never reconciled automatically — the gap is only shown.
 */
export function progressGapTrace(metric: string, rows: ProgressCompareInput[]): CalcTrace {
  const reported = rows.filter((r) => r.weight > 0 && r.supervisor != null)
  const weight = reported.reduce((s, r) => s + r.weight, 0)
  const stored = weight > 0 ? reported.reduce((s, r) => s + r.weight * r.stored, 0) / weight : null
  const supervisor = weight > 0 ? reported.reduce((s, r) => s + r.weight * (r.supervisor ?? 0), 0) / weight : null
  const gap = stored != null && supervisor != null ? stored - supervisor : null
  const unreported = rows.filter((r) => r.weight > 0 && r.supervisor == null).length
  return makeTrace({
    metric,
    label: 'اختلاف پیشرفت مدیر (MSP) و سرپرست',
    result: gap,
    unit: 'points',
    formula: 'Gap = Σ(wᵢ × MSPᵢ) ÷ Σwᵢ − Σ(wᵢ × سرپرستᵢ) ÷ Σwᵢ   (فقط فعالیت‌های گزارش‌شده)',
    formulaHuman:
      gap == null
        ? 'هیچ فعالیت وزن‌داری گزارش سرپرست ندارد؛ مقایسه ممکن نیست.'
        : `${v(stored, 'percent')} − ${v(supervisor, 'percent')} = ${v(gap, 'points')}   (روی ${faNumber(reported.length)} فعالیت با Σw = ${faNumber(weight, 2)})`,
    inputs: [
      traceInput('stored', 'پیشرفت وزنی ثبت‌شده (MSP)', stored, 'percent', {
        table: 'project_tasks / workshop_packages',
        column: 'percent_complete',
        note: 'درصد فیزیکی ذخیره‌شده؛ مبنای EV',
      }),
      traceInput('supervisor', 'پیشرفت وزنی گزارش سرپرست', supervisor, 'percent', {
        table: 'task_progress_updates / package_progress_updates',
        column: 'percent_complete',
        note: 'آخرین گزارش روزانهٔ هر فعالیت',
      }),
      traceInput('unreported', 'فعالیت وزن‌دار بدون گزارش سرپرست (در مقایسه نیامده)', unreported, 'count', {
        table: null,
        note: 'گزارش‌نشده با «پیشرفت صفر» یکی گرفته نمی‌شود',
      }),
      ...reported
        .filter((r) => Math.abs(r.stored - (r.supervisor ?? 0)) >= 0.05)
        .sort((a, b) => Math.abs(b.stored - (b.supervisor ?? 0)) - Math.abs(a.stored - (a.supervisor ?? 0)))
        .slice(0, 15)
        .map((r) =>
          traceInput(
            `act-${r.id}`,
            `${r.wbs ? `${r.wbs} ` : ''}${r.name} — MSP ${v(r.stored, 'percent')} / سرپرست (w=${faNumber(r.weight, 2)})`,
            r.supervisor,
            'percent',
            { table: r.table, rowId: r.id, column: 'percent_complete' },
            r.supervisorDate
          )
        ),
    ],
    warnings: [warnProgressGap(stored, supervisor)],
  })
}

export function ppcTrace(
  metric: string,
  week: { start: string; end: string; planned: number; completed: number; ppc: number | null } | null,
  source: 'schedule' | 'wwp'
): CalcTrace {
  const planned = week?.planned ?? null
  const completed = week?.completed ?? null
  const ppc = week && week.planned > 0 ? (week.completed / week.planned) * 100 : null
  const table = source === 'wwp' ? 'weekly_work_plan_commitments' : 'project_tasks + task_progress_updates'
  return makeTrace({
    metric,
    label: 'PPC — درصد تعهدات انجام‌شده',
    result: ppc,
    unit: 'percent',
    formula: 'PPC = تعهدات کامل‌شده ÷ کل تعهدات هفته × 100',
    formulaHuman: !week
      ? 'هنوز هفتهٔ بسته‌شده‌ای وجود ندارد.'
      : ppc == null
        ? `${faNumber(week.completed)} ÷ 0 — مخرج صفر است`
        : `${faNumber(week.completed)} ÷ ${faNumber(week.planned)} × 100 = ${v(ppc, 'percent')}`,
    inputs: [
      traceInput('week', 'هفته (آخرین هفتهٔ بسته‌شده)', week ? `${jalaliDate(week.start)} تا ${jalaliDate(week.end)}` : null, 'text', {
        table: null,
        note: source === 'wwp' ? 'برنامهٔ کاری هفتگی متعهدشده' : 'تعهد هر هفته = کار برنامه‌شدهٔ آن هفته در برنامهٔ زمان‌بندی',
      }),
      traceInput('planned', 'کل تعهدات هفته', planned, 'count', { table, note: 'مخرج' }),
      traceInput('completed', 'تعهدات کامل‌شده', completed, 'count', {
        table,
        note: 'تعهد نیمه‌کاره «انجام‌نشده» حساب می‌شود',
      }),
    ],
    warnings: [warnPpcZeroDenominator(planned)],
  })
}
