export type RagStatus = 'GREEN' | 'AMBER' | 'RED'

export interface RagThresholds {
  /** SPI/CPI at or above this is on track. */
  onTrack: number
  /** SPI/CPI below this is critical. */
  critical: number
  /** Float consumption (%) above this raises AMBER. */
  floatConsumptionAmber: number
}

export const DEFAULT_RAG_THRESHOLDS: RagThresholds = {
  onTrack: 0.95,
  critical: 0.85,
  floatConsumptionAmber: 75,
}

export interface RagInput {
  spi: number | null
  cpi: number | null
  /** Lowest total float (days) on the critical path; null when CPM has not run. */
  criticalFloatDays: number | null
  /** Worst float consumption vs first CPM sample (%); null when there is no history. */
  floatConsumptionPercent: number | null
}

export type RagReasonCode =
  | 'SPI_CRITICAL'
  | 'SPI_WARNING'
  | 'CPI_CRITICAL'
  | 'CPI_WARNING'
  | 'NEGATIVE_CRITICAL_FLOAT'
  | 'FLOAT_CONSUMPTION'

export interface RagReason {
  code: RagReasonCode
  level: Exclude<RagStatus, 'GREEN'>
  messageFa: string
}

export interface RagResult {
  status: RagStatus
  reasons: RagReason[]
  /** False when no SPI, CPI or float data exists — status is then not meaningful. */
  evaluated: boolean
}

function fmt(value: number): string {
  return value.toFixed(2)
}

function indexReasons(
  code: 'SPI' | 'CPI',
  value: number | null,
  t: RagThresholds
): RagReason | null {
  if (value == null || !Number.isFinite(value)) return null
  const label = code === 'SPI' ? 'شاخص عملکرد زمانی (SPI)' : 'شاخص عملکرد هزینه (CPI)'
  if (value < t.critical) {
    return {
      code: `${code}_CRITICAL`,
      level: 'RED',
      messageFa: `${label} برابر ${fmt(value)} و کمتر از ${fmt(t.critical)} است.`,
    }
  }
  if (value < t.onTrack) {
    return {
      code: `${code}_WARNING`,
      level: 'AMBER',
      messageFa: `${label} برابر ${fmt(value)} و بین ${fmt(t.critical)} و ${fmt(t.onTrack)} است.`,
    }
  }
  return null
}

export function evaluateRagStatus(
  input: RagInput,
  thresholds: RagThresholds = DEFAULT_RAG_THRESHOLDS
): RagResult {
  const reasons: RagReason[] = []

  const spi = indexReasons('SPI', input.spi, thresholds)
  if (spi) reasons.push(spi)
  const cpi = indexReasons('CPI', input.cpi, thresholds)
  if (cpi) reasons.push(cpi)

  if (input.criticalFloatDays != null && input.criticalFloatDays < 0) {
    reasons.push({
      code: 'NEGATIVE_CRITICAL_FLOAT',
      level: 'RED',
      messageFa: `شناوری مسیر بحرانی منفی است (${Math.round(input.criticalFloatDays)} روز).`,
    })
  }

  if (
    input.floatConsumptionPercent != null &&
    input.floatConsumptionPercent > thresholds.floatConsumptionAmber
  ) {
    reasons.push({
      code: 'FLOAT_CONSUMPTION',
      level: 'AMBER',
      messageFa: `${Math.round(input.floatConsumptionPercent)}٪ از شناوری مصرف شده است (آستانه ${thresholds.floatConsumptionAmber}٪).`,
    })
  }

  const status: RagStatus = reasons.some((r) => r.level === 'RED')
    ? 'RED'
    : reasons.length > 0
      ? 'AMBER'
      : 'GREEN'

  return {
    status,
    reasons,
    evaluated:
      input.spi != null || input.cpi != null || input.criticalFloatDays != null,
  }
}

export interface FloatSample {
  taskId: string
  totalFloat: number
  isCritical: boolean
}

export interface FloatHealth {
  criticalFloatDays: number | null
  /** Task holding `criticalFloatDays`. */
  criticalTaskId: string | null
  /** True when no task was flagged critical and the lowest float overall was used. */
  criticalFromAllTasks: boolean
  floatConsumptionPercent: number | null
  worstConsumptionTaskId: string | null
  worstInitialFloat: number | null
  worstCurrentFloat: number | null
}

const EMPTY_FLOAT_HEALTH: FloatHealth = {
  criticalFloatDays: null,
  criticalTaskId: null,
  criticalFromAllTasks: false,
  floatConsumptionPercent: null,
  worstConsumptionTaskId: null,
  worstInitialFloat: null,
  worstCurrentFloat: null,
}

/**
 * Critical float = lowest float among critical tasks (all tasks when none is flagged).
 * Consumption compares each task's first recorded float with its current float.
 */
export function summarizeFloatHealth(
  current: FloatSample[],
  initialFloatByTask: Map<string, number>
): FloatHealth {
  const valid = current.filter((s) => Number.isFinite(s.totalFloat))
  if (valid.length === 0) return EMPTY_FLOAT_HEALTH

  const critical = valid.filter((s) => s.isCritical)
  const pool = critical.length > 0 ? critical : valid
  const lowest = pool.reduce((min, s) => (s.totalFloat < min.totalFloat ? s : min))

  let worst: { taskId: string; percent: number; initial: number; current: number } | null = null
  for (const sample of valid) {
    const initial = initialFloatByTask.get(sample.taskId)
    if (initial == null || !Number.isFinite(initial) || initial <= 0) continue
    const percent = Math.max(0, ((initial - sample.totalFloat) / initial) * 100)
    if (!worst || percent > worst.percent) {
      worst = { taskId: sample.taskId, percent, initial, current: sample.totalFloat }
    }
  }

  return {
    criticalFloatDays: lowest.totalFloat,
    criticalTaskId: lowest.taskId,
    criticalFromAllTasks: critical.length === 0,
    floatConsumptionPercent: worst?.percent ?? null,
    worstConsumptionTaskId: worst?.taskId ?? null,
    worstInitialFloat: worst?.initial ?? null,
    worstCurrentFloat: worst?.current ?? null,
  }
}
