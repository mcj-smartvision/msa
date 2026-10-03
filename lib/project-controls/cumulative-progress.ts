import type { ProjectEvmSnapshot } from '@/lib/evm/load-project-evm'
import { progressWeightOf, type EvmBudgetBasis, type EvmProgressBasis } from '@/lib/evm/metrics'
import { jalaliDate } from '@/lib/manager/format'

export const CUMULATIVE_FORMULA_LATEX = 'Cum\\% = \\frac{\\sum (W_i \\times P_i)}{\\sum W_i}'

/** Where a row's actual percent comes from. */
export type ActualProgressSource =
  /** Current approved physical percent (as-of = today). */
  | 'current'
  /** Latest approved progress record dated on or before the as-of date. */
  | 'record'
  /** No progress record on or before the as-of date: counted as 0. */
  | 'no_record'

export interface CumulativeBreakdownRow {
  activity_id: string
  kind: 'task' | 'package'
  wbs_code: string
  task_name: string
  /** Raw weight on the progress basis: schedule weight (% of project) or budget (Toman). */
  weight: number
  /** Share of Σ weight, percent. */
  weight_percentage: number
  baseline_start: string | null
  baseline_finish: string | null
  /** Baseline plan percent of this row on the as-of date (calendar days). */
  planned_progress: number
  /** Approved physical percent of this row on the as-of date. */
  actual_progress: number
  actual_source: ActualProgressSource
  /** (Wᵢ ÷ ΣW) × Plannedᵢ — this row's contribution in percentage points; the column sums to Planned_Cum_%. */
  weighted_planned: number
  /** (Wᵢ ÷ ΣW) × Actualᵢ — this row's contribution in percentage points; the column sums to Actual_Cum_%. */
  weighted_actual: number
}

export interface ExplainedCumulativeProgress {
  status: 'ok' | 'data_missing'
  project_id: string
  as_of: string
  progress_basis: EvmProgressBasis
  budget_basis: EvmBudgetBasis
  planned_cum_percent: number | null
  actual_cum_percent: number | null
  total_weight: number
  bac_total: number
  pv_value: number | null
  ev_value: number | null
  formula_latex: string
  formula_ev_latex: string
  /** Actual: `((wᵢ × pᵢ) + …) / ΣW = x%` with normalized weights. */
  substitution_text: string
  substitution_planned_text: string
  breakdown_table: CumulativeBreakdownRow[]
  interpretation_fa: string
  reason_fa: string | null
  /** Data-quality notes (weight issues, rows counted as 0 for lack of history). */
  warnings_fa: string[]
}

const clamp = (p: number) => (Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0)

const fa = (value: number, digits = 1) =>
  value.toLocaleString('fa-IR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const latin = (value: number, digits: number) => value.toFixed(digits).replace(/\.?0+$/, '') || '0'

function substitution(rows: CumulativeBreakdownRow[], pick: (r: CumulativeBreakdownRow) => number, total: number): string {
  const terms = rows.map((r) => `(${latin(r.weight_percentage / 100, 4)} × ${latin(pick(r), 2)}%)`)
  return `( ${terms.join(' + ')} ) / 1.00 = ${total.toFixed(2)}%`
}

/**
 * Explainable cumulative progress on the same rows, weights and basis as `computeEvmMetrics`:
 * Cum% = Σ(Wᵢ × Pᵢ) ÷ ΣWᵢ for the plan (baseline, calendar days) and for approved physical progress;
 * PV = BAC × Planned_Cum_% and EV = BAC × Actual_Cum_%. `actualAsOf` replaces the current percent
 * when the as-of date is in the past (latest approved record on or before it).
 */
export function buildExplainedCumulativeProgress(
  evm: ProjectEvmSnapshot,
  actualAsOf?: Map<string, { percent: number; source: Exclude<ActualProgressSource, 'current'> }>
): ExplainedCumulativeProgress {
  const m = evm.metrics
  const basis = m.progressBasis
  const weighted = evm.activities.filter((a) => progressWeightOf(a, basis) > 0)
  const totalWeight = weighted.reduce((s, a) => s + progressWeightOf(a, basis), 0)
  const base = {
    project_id: evm.projectId,
    as_of: m.asOf,
    progress_basis: basis,
    budget_basis: m.budgetBasis,
    total_weight: totalWeight,
    bac_total: m.bac,
    formula_latex: CUMULATIVE_FORMULA_LATEX,
    formula_ev_latex: 'EV = BAC \\times \\frac{Actual\\_Cum\\%}{100},\\quad PV = BAC \\times \\frac{Planned\\_Cum\\%}{100}',
  }
  const weightWarnings = evm.weightIssues.map(
    (issue) => `خطای کیفیت وزن${issue.parentLabel ? ` («${issue.parentLabel}»)` : ''}: ${issue.message_fa}`
  )

  if (totalWeight <= 0) {
    return {
      ...base,
      status: 'data_missing',
      planned_cum_percent: null,
      actual_cum_percent: null,
      pv_value: null,
      ev_value: null,
      substitution_text: '',
      substitution_planned_text: '',
      breakdown_table: [],
      interpretation_fa: 'پیشرفت تجمعی قابل محاسبه نیست.',
      reason_fa: 'هیچ فعالیت برگی وزن زمان‌بندی یا بودجه ندارد؛ مخرج میانگین وزنی (ΣW) صفر است.',
      warnings_fa: weightWarnings,
    }
  }

  const rows: CumulativeBreakdownRow[] = weighted.map((a) => {
    const w = progressWeightOf(a, basis)
    const share = w / totalWeight
    const override = actualAsOf?.get(a.id)
    const actual = clamp(override ? override.percent : actualAsOf ? 0 : a.physicalPercent)
    const planned = clamp(a.plannedPercent)
    return {
      activity_id: a.id,
      kind: a.kind,
      wbs_code: a.wbs ?? '—',
      task_name: a.name,
      weight: w,
      weight_percentage: share * 100,
      baseline_start: a.baselineStart,
      baseline_finish: a.baselineFinish,
      planned_progress: planned,
      actual_progress: actual,
      actual_source: override ? override.source : actualAsOf ? 'no_record' : 'current',
      weighted_planned: share * planned,
      weighted_actual: share * actual,
    }
  })
  const planned = rows.reduce((s, r) => s + r.weighted_planned, 0)
  const actual = rows.reduce((s, r) => s + r.weighted_actual, 0)
  const hasBudget = m.bac > 0
  const pv = hasBudget ? (m.bac * planned) / 100 : null
  const ev = hasBudget ? (m.bac * actual) / 100 : null

  const gap = actual - planned
  const toman = (v: number) => `${Math.round(Math.abs(v)).toLocaleString('fa-IR')} تومان`
  const parts: string[] = []
  if (Math.abs(gap) < 0.05) parts.push(`پیشرفت واقعی تجمعی (${fa(actual, 2)}٪) هم‌پای برنامهٔ مصوب (${fa(planned, 2)}٪) است.`)
  else
    parts.push(
      `پیشرفت واقعی تجمعی ${fa(actual, 2)}٪ و برنامهٔ مصوب ${fa(planned, 2)}٪ است؛ یعنی ${fa(Math.abs(gap), 2)} واحد درصد ${gap < 0 ? 'عقب‌تر از' : 'جلوتر از'} برنامه.`
    )
  if (pv != null && ev != null && Math.abs(gap) >= 0.05) {
    parts.push(gap < 0 ? `این عقب‌ماندگی معادل ${toman(pv - ev)} EV Lag (PV − EV) است.` : `این جلوافتادگی معادل ${toman(ev - pv)} ارزش کسب‌شدهٔ بیش از برنامه است.`)
  } else if (!hasBudget) {
    parts.push('بودجه (BAC) ثبت نشده؛ PV و EV ریالی قابل محاسبه نیست.')
  }
  const lagging = [...rows]
    .filter((r) => r.weighted_planned - r.weighted_actual > 0.005)
    .sort((a, b) => b.weighted_planned - b.weighted_actual - (a.weighted_planned - a.weighted_actual))
    .slice(0, 3)
  if (lagging.length && gap < -0.05) {
    parts.push(
      `بیشترین سهم در عقب‌ماندگی: ${lagging
        .map((r) => `«${r.task_name}» (${fa(r.weighted_planned - r.weighted_actual, 2)} واحد)`)
        .join('، ')}.`
    )
  }

  const noRecord = rows.filter((r) => r.actual_source === 'no_record')
  const warnings = [...weightWarnings]
  if (noRecord.length) {
    warnings.push(
      `${noRecord.length.toLocaleString('fa-IR')} ردیف تا تاریخ ${jalaliDate(m.asOf)} رکورد پیشرفت تأییدشده ندارد و پیشرفت واقعی آن صفر منظور شده است.`
    )
  }

  return {
    ...base,
    status: 'ok',
    planned_cum_percent: planned,
    actual_cum_percent: actual,
    pv_value: pv,
    ev_value: ev,
    substitution_text: substitution(rows, (r) => r.actual_progress, actual),
    substitution_planned_text: substitution(rows, (r) => r.planned_progress, planned),
    breakdown_table: rows,
    interpretation_fa: parts.join(' '),
    reason_fa: null,
    warnings_fa: warnings,
  }
}
