/** How a value is formatted in the calculation ledger drawer. */
export type CalcTraceUnit =
  | 'index'
  | 'percent'
  | 'points'
  | 'toman'
  | 'toman_per_month'
  | 'toman_per_day'
  | 'days'
  | 'months'
  | 'count'
  | 'weight'
  | 'text'

export type CalcTraceStatus = 'ok' | 'warning' | 'critical' | 'insufficient'

/** Where an input was read from: table, row and column, or a description when it is itself computed. */
export interface CalcTraceSource {
  table: string | null
  rowId?: string | null
  column?: string | null
  note?: string | null
}

export interface CalcTraceInput {
  key: string
  label: string
  value: number | string | null
  unit: CalcTraceUnit
  source: CalcTraceSource
  updatedAt?: string | null
}

export interface CalcTracePoint {
  result: number | null
  computedAt: string
}

/** One dashboard number with everything needed to recompute it by hand. */
export interface CalcTrace {
  /** Stable key, namespaced by page (e.g. `home.cpi`); history is kept per project + metric. */
  metric: string
  label: string
  result: number | null
  unit: CalcTraceUnit
  status: CalcTraceStatus
  /** Symbolic formula, e.g. `CPI = EV ÷ AC`. */
  formula: string
  /** The same formula with the actual numbers, in Persian. */
  formulaHuman: string
  inputs: CalcTraceInput[]
  warnings: string[]
  /** Last value recorded before today. */
  previousPeriod: CalcTracePoint | null
  /** Up to 12 recorded values, oldest first. */
  history: CalcTracePoint[]
  /** Why there is no history (e.g. migration 107 not run, or history not kept for this metric). */
  historyNote?: string | null
  computedAt: string
}

export type CalcTraceMap = Record<string, CalcTrace>

export const CALC_TRACE_HISTORY_LIMIT = 12
