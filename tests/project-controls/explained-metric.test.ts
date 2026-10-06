import { describe, expect, it } from 'vitest'
import type { ControlsSnapshot, SnapshotField } from '@/shared/types/project-controls'
import { buildExplainedMetric } from '@/features/project-controls/lib/explained-metric'
import { buildPpcKpi, buildTcpiKpi } from '@/features/project-controls/lib/kpis'
import { buildControlsSnapshot } from '@/features/project-controls/lib/controls-snapshot'
import type { ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'

const AS_OF = '2026-10-01'

function ok<T>(value: T, source = 'src-a', asOf = AS_OF): SnapshotField<T> {
  return { value, quality: 'ok', source, asOf }
}

function missing<T>(reason: string, source = 'src-a'): SnapshotField<T> {
  return { value: null, quality: 'missing', source, asOf: AS_OF, reason_fa: reason }
}

function snapshot(overrides: Partial<ControlsSnapshot> = {}): ControlsSnapshot {
  return {
    projectId: 'p1',
    asOf: AS_OF,
    generatedAt: `${AS_OF}T08:00:00.000Z`,
    periodUnit: 'months',
    daysPerUnit: 30.44,
    budgetBasis: 'contract',
    progressBasis: 'schedule_weight',
    bac: ok(1000, 'budget'),
    pv: ok(50, 'schedule'),
    ev: ok(40, 'schedule'),
    evCost: ok(400, 'budget'),
    ac: ok(450, 'cost'),
    pvCurve: missing('no curve', 'schedule'),
    projectStart: missing('no curve', 'schedule'),
    baselineFinish: missing('no curve', 'schedule'),
    plannedDuration: missing('no curve', 'schedule'),
    actualTime: missing('no curve', 'schedule'),
    earnedSchedule: missing('no curve', 'schedule'),
    weeklyPlan: missing('WWP not implemented', 'wwp'),
    weightIssues: [],
    ...overrides,
  } as ControlsSnapshot
}

const emptyEvm = {
  projectId: 'p1',
  metrics: {
    asOf: '2026-10-03',
    budgetBasis: 'none',
    progressBasis: 'budget',
    bac: 0,
    pv: 0,
    ev: 0,
    evAmount: 0,
    ac: 0,
    plannedPercent: 0,
    earnedPercent: 0,
    totalWeight: 0,
    activityCount: 0,
  },
  activities: [],
  weightIssues: [],
} as unknown as ProjectEvmSnapshot

const spec = {
  key: 'ratio',
  title_fa: 'نسبت',
  unit: 'ضریب',
  formula: 'R = A ÷ B',
  asOf: AS_OF,
}

describe('buildExplainedMetric contract', () => {
  it('returns every contract field for a computed KPI', () => {
    const kpi = buildExplainedMetric({
      ...spec,
      inputs: { a: ok(6, 'src-a', '2026-09-30'), b: ok(3, 'src-b') },
      compute: ({ a, b }) => ({ value: a / b, substitution: `R = ${a} ÷ ${b} = ${a / b}`, interpretation_fa: 'خوب', status: 'green' }),
    })
    expect(kpi).toMatchObject({
      key: 'ratio',
      title_fa: 'نسبت',
      value: 2,
      unit: 'ضریب',
      formula: 'R = A ÷ B',
      substitution: 'R = 6 ÷ 3 = 2',
      interpretation_fa: 'خوب',
      status: 'green',
      data_quality: 'ok',
      evidence: { sources: ['src-a', 'src-b'], asOf: '2026-09-30' },
    })
  })

  it('never computes from missing input: gray, null value, explicit reason', () => {
    let called = false
    const kpi = buildExplainedMetric({
      ...spec,
      inputs: { a: ok(6), b: missing<number>('B ثبت نشده است') },
      inputLabels: { b: 'مقدار B' },
      compute: () => {
        called = true
        return { value: 1, substitution: '', interpretation_fa: '', status: 'green' }
      },
    })
    expect(called).toBe(false)
    expect(kpi.value).toBeNull()
    expect(kpi.status).toBe('gray')
    expect(kpi.data_quality).toBe('missing')
    expect(kpi.reason_fa).toContain('مقدار B: B ثبت نشده است')
  })

  it('treats invalid input and thrown errors as invalid', () => {
    const invalid = buildExplainedMetric({
      ...spec,
      inputs: { a: { value: null, quality: 'invalid', source: 's', asOf: AS_OF, reason_fa: 'منفی' } as SnapshotField<number> },
      compute: () => ({ value: 1, substitution: '', interpretation_fa: '', status: 'green' }),
    })
    expect(invalid).toMatchObject({ value: null, status: 'gray', data_quality: 'invalid' })

    const thrown = buildExplainedMetric({
      ...spec,
      inputs: { a: ok(1) },
      compute: () => {
        throw new Error('دامنهٔ نامعتبر')
      },
    })
    expect(thrown).toMatchObject({ value: null, status: 'gray', data_quality: 'invalid', reason_fa: 'دامنهٔ نامعتبر' })
  })

  it('rejects non-finite results', () => {
    const kpi = buildExplainedMetric({
      ...spec,
      inputs: { a: ok(1), b: ok(0) },
      compute: ({ a, b }) => ({ value: a / b, substitution: '', interpretation_fa: '', status: 'green' }),
    })
    expect(kpi).toMatchObject({ value: null, status: 'gray', data_quality: 'invalid' })
  })

  it('propagates stale inputs while keeping the value', () => {
    const kpi = buildExplainedMetric({
      ...spec,
      inputs: { a: { ...ok(4), quality: 'stale' }, b: ok(2) },
      compute: ({ a, b }) => ({ value: a / b, substitution: '', interpretation_fa: '', status: 'yellow' }),
    })
    expect(kpi).toMatchObject({ value: 2, status: 'yellow', data_quality: 'stale' })
  })
})

describe('KPIs built from ControlsSnapshot', () => {
  it('TCPI is data-missing (not "healthy") when AC is not recorded', () => {
    const kpi = buildTcpiKpi(snapshot({ ac: missing('هزینهٔ واقعی (AC) هنوز ثبت نشده است', 'cost') }))
    expect(kpi).toMatchObject({ key: 'tcpi_bac', value: null, status: 'gray', data_quality: 'missing' })
    expect(kpi.reason_fa).toContain('AC')
  })

  it('TCPI computes from real inputs', () => {
    const kpi = buildTcpiKpi(snapshot())
    expect(kpi.value).toBeCloseTo(600 / 550, 3)
    expect(kpi.data_quality).toBe('ok')
    expect(kpi.evidence.sources).toEqual(['budget', 'cost'])
  })

  it('PPC is data-missing with the WWP reason when no weekly plan exists', () => {
    const kpi = buildPpcKpi(snapshot())
    expect(kpi).toMatchObject({ key: 'ppc', value: null, status: 'gray', data_quality: 'missing' })
    expect(kpi.reason_fa).toContain('WWP')
  })

  it('PPC carries the loader reason when no closed WWP week exists', () => {
    const controls = buildControlsSnapshot({
      evm: emptyEvm,
      weeklyPlanMissingReason: 'هنوز هیچ هفته‌ای از برنامهٔ هفتگی متعهد (WWP) بسته نشده است',
      now: new Date('2026-10-03T08:00:00Z'),
    })
    const kpi = buildPpcKpi(controls)
    expect(kpi.data_quality).toBe('missing')
    expect(kpi.reason_fa).toContain('بسته نشده')
  })

  it('PPC from a long-past closed week is flagged stale but still shown', () => {
    const controls = buildControlsSnapshot({
      evm: emptyEvm,
      weeklyPlan: { planned: 10, completed: 7, weekStart: '2026-08-29', weekEnd: '2026-09-04' },
      now: new Date('2026-10-03T08:00:00Z'),
    })
    expect(buildPpcKpi(controls)).toMatchObject({ value: 70, status: 'yellow', data_quality: 'stale' })
  })

  it('snapshot exposes weight issues from the EVM loader', () => {
    const controls = buildControlsSnapshot({
      evm: {
        ...emptyEvm,
        weightIssues: [
          { code: 'children_sum_mismatch', parentId: 't1', parentLabel: 'x', expected: 17, actual: 12, message_fa: 'جمع نمی‌خواند' },
        ],
      },
      now: new Date('2026-10-03T08:00:00Z'),
    })
    expect(controls.weightIssues).toEqual(['جمع نمی‌خواند'])
  })

  it('PPC computes from a committed weekly plan', () => {
    const kpi = buildPpcKpi(
      snapshot({ weeklyPlan: ok({ planned: 20, completed: 18, weekStart: '2026-09-26', weekEnd: '2026-10-02' }, 'wwp', '2026-10-02') })
    )
    expect(kpi).toMatchObject({ value: 90, status: 'green', data_quality: 'ok' })
  })
})
