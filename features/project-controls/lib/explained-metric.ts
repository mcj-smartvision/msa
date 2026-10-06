import type { DataQuality, ExplainedKpi, KpiStatus, RagStatus, SnapshotField } from '@/shared/types/project-controls';

export const KPI_STATUS_TOKENS: Record<KpiStatus, { bg: string; text: string; border: string; label_fa: string }> = {
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label_fa: 'سالم' },
  yellow: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label_fa: 'هشدار' },
  red: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label_fa: 'بحرانی' },
  gray: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label_fa: 'بدون وضعیت' },
}

export const DATA_QUALITY_FA: Record<DataQuality, string> = {
  ok: 'داده کامل',
  missing: 'داده موجود نیست',
  stale: 'داده قدیمی',
  invalid: 'داده نامعتبر',
}

export function statusFromRag(rag: RagStatus | undefined): KpiStatus {
  if (rag === 'HEALTHY') return 'green'
  if (rag === 'WARNING') return 'yellow'
  if (rag === 'CRITICAL') return 'red'
  return 'gray'
}

type InputValues<I extends Record<string, SnapshotField<unknown>>> = { [K in keyof I]: NonNullable<I[K]['value']> }

export interface ComputedKpi<T> {
  value: T | null
  substitution: string
  interpretation_fa: string
  status: KpiStatus
  /** A computation may itself find the inputs unusable (e.g. a domain error). */
  invalid_reason_fa?: string
  actionable_decision_fa?: string
  assumptions?: string[]
  debug?: Record<string, unknown>
}

export interface ExplainedMetricSpec<T, I extends Record<string, SnapshotField<unknown>>> {
  key: string
  title_fa: string
  unit: string
  formula: string
  code?: string
  /** Fallback evidence date when the KPI has no inputs. */
  asOf: string
  inputs: I
  /** Display names of the inputs, used in the missing-data explanation. */
  inputLabels?: Partial<Record<keyof I, string>>
  compute: (values: InputValues<I>) => ComputedKpi<T>
}

function isUsable(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

/**
 * The single constructor for KPI output. It refuses to produce a value from missing or invalid
 * inputs: those KPIs come back gray, with value null and the reason spelled out.
 */
export function buildExplainedMetric<T, I extends Record<string, SnapshotField<unknown>>>(
  spec: ExplainedMetricSpec<T, I>
): ExplainedKpi<T> {
  const fields = Object.entries(spec.inputs) as [keyof I & string, SnapshotField<unknown>][]
  const sources = Array.from(new Set(fields.map(([, f]) => f.source)))
  const asOf = fields.length > 0 ? fields.map(([, f]) => f.asOf).sort()[0]! : spec.asOf
  const evidence = { sources, asOf }
  const base = { key: spec.key, title_fa: spec.title_fa, unit: spec.unit, formula: spec.formula, code: spec.code, evidence }

  const blocking = fields.filter(([, f]) => f.quality === 'missing' || f.quality === 'invalid' || !isUsable(f.value))
  if (blocking.length > 0) {
    const quality: DataQuality = blocking.some(([, f]) => f.quality === 'invalid') ? 'invalid' : 'missing'
    const reasons = blocking.map(([name, f]) => `${spec.inputLabels?.[name] ?? name}: ${f.reason_fa ?? DATA_QUALITY_FA[f.quality]}`)
    return {
      ...base,
      value: null,
      substitution: `${spec.formula} ⇐ ${DATA_QUALITY_FA[quality]} (${blocking.map(([name]) => spec.inputLabels?.[name] ?? name).join('، ')})`,
      interpretation_fa: `این شاخص محاسبه نشد. ${reasons.join(' · ')}`,
      status: 'gray',
      data_quality: quality,
      reason_fa: reasons.join(' · '),
    }
  }

  const values = Object.fromEntries(fields.map(([name, f]) => [name, f.value])) as InputValues<I>
  let computed: ComputedKpi<T>
  try {
    computed = spec.compute(values)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'خطای محاسبه'
    return {
      ...base,
      value: null,
      substitution: `${spec.formula} ⇐ ${DATA_QUALITY_FA.invalid}`,
      interpretation_fa: `این شاخص محاسبه نشد. ${reason}`,
      status: 'gray',
      data_quality: 'invalid',
      reason_fa: reason,
    }
  }

  if (computed.invalid_reason_fa || (typeof computed.value === 'number' && !Number.isFinite(computed.value))) {
    const reason = computed.invalid_reason_fa ?? 'نتیجهٔ محاسبه عدد معتبر نیست'
    return {
      ...base,
      value: null,
      substitution: computed.substitution,
      interpretation_fa: `این شاخص محاسبه نشد. ${reason}`,
      status: 'gray',
      data_quality: 'invalid',
      reason_fa: reason,
      debug: computed.debug,
    }
  }

  const stale = fields.some(([, f]) => f.quality === 'stale')
  return {
    ...base,
    value: computed.value,
    substitution: computed.substitution,
    interpretation_fa: computed.interpretation_fa,
    status: computed.status,
    data_quality: stale ? 'stale' : 'ok',
    actionable_decision_fa: computed.actionable_decision_fa,
    assumptions: computed.assumptions,
    debug: computed.debug,
  }
}
