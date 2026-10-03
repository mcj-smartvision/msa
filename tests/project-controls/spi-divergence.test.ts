import { describe, expect, it } from 'vitest'
import type { ExplainedKpi } from '@/types/project-controls'
import { SPI_DIVERGENCE_WARNING_FA, spiDivergenceWarning } from '@/lib/project-controls/kpis'

function kpi(value: number | null): ExplainedKpi {
  return {
    key: 'k',
    title_fa: 'k',
    value,
    unit: 'ضریب',
    formula: '',
    substitution: '',
    interpretation_fa: '',
    status: value == null ? 'gray' : 'green',
    data_quality: value == null ? 'missing' : 'ok',
    evidence: { sources: [], asOf: '2026-10-03' },
  }
}

describe('spiDivergenceWarning', () => {
  it('warns when SPI is near 1 but SPI(t) is below 0.9', () => {
    expect(spiDivergenceWarning(kpi(0.97), kpi(0.82))).toBe(SPI_DIVERGENCE_WARNING_FA)
    expect(spiDivergenceWarning(kpi(1.04), kpi(0.6))).toBe(SPI_DIVERGENCE_WARNING_FA)
    expect(spiDivergenceWarning(kpi(0.95), kpi(0.899))).toBe(SPI_DIVERGENCE_WARNING_FA)
  })

  it('stays quiet when SPI is not near 1, SPI(t) is ≥ 0.9, or a value is missing', () => {
    expect(spiDivergenceWarning(kpi(0.7405), kpi(0.307))).toBeNull()
    expect(spiDivergenceWarning(kpi(1.06), kpi(0.5))).toBeNull()
    expect(spiDivergenceWarning(kpi(0.99), kpi(0.9))).toBeNull()
    expect(spiDivergenceWarning(kpi(null), kpi(0.5))).toBeNull()
    expect(spiDivergenceWarning(kpi(1), kpi(null))).toBeNull()
  })
})
