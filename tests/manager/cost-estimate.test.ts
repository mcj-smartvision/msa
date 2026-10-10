import { describe, expect, it } from 'vitest'
import {
  EMPTY_ESTIMATE,
  buildBac,
  buildEstimateAlerts,
  canEditCostEstimate,
  computeManagerEvm,
  estimateFromRow,
  estimateIssues,
  estimateStatus,
  estimateTargets,
  estimateToRow,
  plannedDurationMonths,
  sumUnique,
  validateEstimate,
  wbsDirectCost,
  type CostEstimateSettings,
  type EstimateAlertInput,
  type ProgressCompareRow,
  type WbsBudgetRow,
} from '@/features/manager/lib/cost-estimate'

const row = (id: string, budget: number, weight = 10): WbsBudgetRow => ({
  id,
  kind: 'task',
  wbs: id,
  name: `فعالیت ${id}`,
  quantity: 1,
  unitPrice: budget,
  budget,
  weight,
})

// 1 Farvardin 1405 → 31 Shahrivar 1405: exactly six Jalali months.
const SIX_MONTHS = { plannedStart: '2026-03-21', plannedFinish: '2026-09-22' }

const settings = (over: Partial<CostEstimateSettings> = {}): CostEstimateSettings => ({
  ...EMPTY_ESTIMATE,
  ...SIX_MONTHS,
  contractValue: 2_000_000,
  monthlyOverhead: 10_000,
  monthlyPersonnel: 5_000,
  plannedEmployerPurchases: 30_000,
  otherFixedCosts: 20_000,
  riskMode: 'percent',
  riskValue: 10,
  ...over,
})

const direct = wbsDirectCost('technical_office_cost', [row('1', 600_000), row('2', 400_000)])

describe('planned duration', () => {
  it('counts Jalali months by covered days', () => {
    expect(plannedDurationMonths(SIX_MONTHS.plannedStart, SIX_MONTHS.plannedFinish)).toBe(6)
  })
  it('rejects zero or negative spans', () => {
    expect(plannedDurationMonths('2026-03-21', '2026-03-21')).toBeNull()
    expect(plannedDurationMonths('2026-04-01', '2026-03-01')).toBeNull()
  })
})

describe('BAC', () => {
  it('BAC base = direct + overhead×months + personnel×months + purchases + other; total adds the risk reserve', () => {
    const bac = buildBac(settings(), direct)
    expect(bac.durationMonths).toBe(6)
    expect(bac.bacBase).toBe(1_000_000 + 60_000 + 30_000 + 30_000 + 20_000)
    expect(bac.riskReserve).toBeCloseTo(114_000)
    expect(bac.bacTotal).toBeCloseTo(1_254_000)
  })

  it('without a risk reserve, total equals base', () => {
    const bac = buildBac(settings({ riskValue: null }), direct)
    expect(bac.riskReserve).toBe(0)
    expect(bac.bacTotal).toBe(bac.bacBase)
  })

  it('a fixed risk amount is added as entered', () => {
    const bac = buildBac(settings({ riskMode: 'amount', riskValue: 50_000 }), direct)
    expect(bac.bacTotal).toBe(bac.bacBase + 50_000)
  })

  it('does not count again what is already inside the WBS budgets', () => {
    const bac = buildBac(settings({ overheadInWbs: true, personnelInWbs: true, purchasesInWbs: true }), direct)
    expect(bac.bacBase).toBe(1_000_000 + 20_000)
    const overhead = bac.components.find((c) => c.key === 'overhead')!
    expect(overhead.amount).toBe(60_000)
    expect(overhead.included).toBe(false)
    expect(overhead.note).toMatch(/دوباره/)
  })

  it('keeps the contract value out of BAC', () => {
    const low = buildBac(settings({ contractValue: 1 }), direct)
    const high = buildBac(settings({ contractValue: 9_999_999_999 }), direct)
    expect(low.bacTotal).toBe(high.bacTotal)
    expect(low.components.some((c) => c.label.includes('قرارداد'))).toBe(false)
  })

  it('a project budget spread by weight is not a WBS estimate', () => {
    const d = wbsDirectCost('weighted_project_budget', [row('1', 500), row('2', 500)])
    expect(d.basis).toBe('none')
    expect(d.total).toBe(0)
    expect(d.missingRows).toHaveLength(2)
  })

  it('lists weighted activities without a budget as missing', () => {
    const d = wbsDirectCost('contract_value', [row('1', 100), row('2', 0, 20), row('3', 0, 0)])
    expect(d.total).toBe(100)
    expect(d.missingRows.map((r) => r.id)).toEqual(['2'])
  })
})

describe('validation', () => {
  it('rejects negative amounts, finish before start and risk percent outside 0–100', () => {
    const result = validateEstimate({
      contractValue: -1,
      monthlyOverhead: -5,
      plannedStart: '2026-05-01',
      plannedFinish: '2026-04-01',
      riskMode: 'percent',
      riskValue: 150,
    })
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(Object.keys(result.errors).sort()).toEqual(['contractValue', 'monthlyOverhead', 'plannedFinish', 'riskValue'])
    }
  })

  it('rejects a zero-length duration', () => {
    const result = validateEstimate({ plannedStart: '2026-05-01', plannedFinish: '2026-05-01' })
    expect(result.ok).toBe(false)
  })

  it('accepts a risk amount above 100 and keeps blanks as not entered', () => {
    const result = validateEstimate({ riskMode: 'amount', riskValue: 5_000_000, monthlyPersonnel: '' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.riskValue).toBe(5_000_000)
      expect(result.value.monthlyPersonnel).toBeNull()
    }
  })
})

describe('save and reload', () => {
  it('round-trips through the stored row', () => {
    const original = settings({ overheadInWbs: true, notes: 'یادداشت' })
    const back = estimateFromRow({ ...estimateToRow(original), approved_at: null, updated_at: '2026-10-10T00:00:00Z' })
    const { approvedAt, approvedBy, updatedAt, updatedBy, ...reloaded } = back
    expect(reloaded).toEqual(original)
    expect(approvedAt).toBeNull()
    expect(updatedAt).toBe('2026-10-10T00:00:00Z')
    expect(approvedBy).toBeNull()
    expect(updatedBy).toBeNull()
  })

  it('reads numeric strings from Postgres numeric columns', () => {
    const back = estimateFromRow({ contract_value: '1500000', risk_mode: 'amount', risk_value: '20' })
    expect(back.contractValue).toBe(1_500_000)
    expect(back.riskMode).toBe('amount')
  })
})

describe('status and incomplete data', () => {
  it('a project without a saved row needs setup', () => {
    const issues = estimateIssues(EMPTY_ESTIMATE, wbsDirectCost('none', []), buildBac(EMPTY_ESTIMATE, wbsDirectCost('none', [])))
    expect(estimateStatus(null, issues)).toBe('missing')
    expect(issues.some((i) => i.message.includes('ارزش قرارداد'))).toBe(true)
  })

  it('flags a contract-price stand-in for the direct cost', () => {
    const d = wbsDirectCost('contract_value', [row('1', 100)])
    const issues = estimateIssues(settings(), d, buildBac(settings(), d))
    expect(issues.some((i) => i.message.includes('قیمت قراردادی'))).toBe(true)
  })
})

describe('AC', () => {
  it('counts a record listed twice only once', () => {
    expect(
      sumUnique([
        { id: 'a', amount: 100 },
        { id: 'a', amount: 100 },
        { id: 'b', amount: 50 },
      ])
    ).toEqual({ total: 150, count: 2 })
  })
})

describe('manager EVM', () => {
  const base = { bacBase: 1_000_000, bacTotal: 1_100_000, contractValue: 1_500_000 }

  it('computes PV, EV, CV, SV, CPI, SPI and EAC', () => {
    const evm = computeManagerEvm({ ...base, plannedPercent: 50, earnedPercent: 40, ac: 500_000 })
    expect(evm.pv.value).toBe(500_000)
    expect(evm.ev.value).toBe(400_000)
    expect(evm.cv.value).toBe(-100_000)
    expect(evm.sv.value).toBe(-100_000)
    expect(evm.cpi.value).toBeCloseTo(0.8)
    expect(evm.spi.value).toBeCloseTo(0.8)
    expect(evm.eac.value).toBeCloseTo(500_000 + 600_000 / 0.8)
    expect(evm.vac.value).toBeCloseTo(1_100_000 - 1_250_000)
    expect(evm.margin.value).toBeCloseTo(1_500_000 - 1_250_000)
  })

  it('never divides by zero', () => {
    const evm = computeManagerEvm({ ...base, plannedPercent: 0, earnedPercent: 0, ac: 0 })
    expect(evm.cpi.value).toBeNull()
    expect(evm.spi.value).toBeNull()
    expect(evm.eac.value).toBeNull()
    expect(evm.cpi.reason).toMatch(/داده کافی نیست/)
    expect(evm.spi.reason).toMatch(/داده کافی نیست/)
  })

  it('EAC is unavailable while nothing is earned', () => {
    const evm = computeManagerEvm({ ...base, plannedPercent: 10, earnedPercent: 0, ac: 1000 })
    expect(evm.cpi.value).toBe(0)
    expect(evm.eac.value).toBeNull()
  })

  it('without a BAC every value is missing, not zero', () => {
    const evm = computeManagerEvm({ bacBase: null, bacTotal: null, contractValue: null, plannedPercent: 50, earnedPercent: 40, ac: 10 })
    expect(evm.pv.value).toBeNull()
    expect(evm.ev.value).toBeNull()
    expect(evm.cpi.value).toBeNull()
    expect(evm.ac).toBe(10)
  })
})

describe('alerts', () => {
  const evmOk = computeManagerEvm({ bacBase: 1_000_000, bacTotal: 1_100_000, contractValue: null, plannedPercent: 50, earnedPercent: 50, ac: 500_000 })
  const progressRow = (over: Partial<ProgressCompareRow>): ProgressCompareRow => ({
    id: 'x',
    name: 'فعالیت',
    wbs: '1',
    stored: 50,
    supervisor: 50,
    supervisorDate: '2026-10-01',
    plannedPercent: 50,
    started: true,
    ...over,
  })
  const input = (over: Partial<EstimateAlertInput> = {}): EstimateAlertInput => ({
    status: 'approved',
    issues: [],
    evm: evmOk,
    monthlyOverhead: 30_440,
    delayDays: null,
    progress: [],
    direct,
    ppc: null,
    ...over,
  })

  it('is quiet on a healthy project', () => {
    expect(buildEstimateAlerts(input())).toEqual([])
  })

  it('grades CPI by the central thresholds', () => {
    const warn = computeManagerEvm({ bacBase: 1_000_000, bacTotal: 1_000_000, contractValue: null, plannedPercent: 50, earnedPercent: 50, ac: 540_000 })
    const crit = computeManagerEvm({ bacBase: 1_000_000, bacTotal: 1_000_000, contractValue: null, plannedPercent: 50, earnedPercent: 50, ac: 700_000 })
    expect(buildEstimateAlerts(input({ evm: warn })).find((a) => a.id === 'cpi')?.level).toBe('warning')
    expect(buildEstimateAlerts(input({ evm: crit })).find((a) => a.id === 'cpi')?.level).toBe('critical')
    expect(buildEstimateAlerts(input({ evm: warn, thresholds: { cpiWarning: 0.9 } })).find((a) => a.id === 'cpi')).toBeUndefined()
  })

  it('AC above BAC total is critical', () => {
    const evm = computeManagerEvm({ bacBase: 100, bacTotal: 100, contractValue: null, plannedPercent: 50, earnedPercent: 50, ac: 1_000 })
    expect(buildEstimateAlerts(input({ evm })).find((a) => a.id === 'ac-over-bac')?.level).toBe('critical')
  })

  it('turns a forecast delay into extra overhead', () => {
    const alert = buildEstimateAlerts(input({ delayDays: 30.44 })).find((a) => a.id === 'delay-overhead')
    expect(alert?.level).toBe('critical')
    expect(alert?.basis).toContain('30,440')
  })

  it('shows both progress values and grades the gap', () => {
    const alerts = buildEstimateAlerts(input({ progress: [progressRow({ stored: 60, supervisor: 50 }), progressRow({ id: 'y', stored: 40, supervisor: 30 })] }))
    const gap = alerts.find((a) => a.id === 'progress-gap')!
    expect(gap.level).toBe('warning')
    expect(gap.items?.[0]?.detail).toContain('ثبت‌شده در برنامه 60%')
    expect(gap.items?.[0]?.detail).toContain('گزارش سرپرست 50%')
    const big = buildEstimateAlerts(input({ progress: [progressRow({ stored: 80, supervisor: 50 })] }))
    expect(big.find((a) => a.id === 'progress-gap')?.level).toBe('critical')
  })

  it('separates "no report" from "reported with zero progress"', () => {
    const alerts = buildEstimateAlerts(
      input({
        progress: [
          progressRow({ id: 'a', stored: 0, supervisor: null, supervisorDate: null, plannedPercent: 20 }),
          progressRow({ id: 'b', stored: 0, supervisor: 0, plannedPercent: 20 }),
        ],
      })
    )
    expect(alerts.find((a) => a.id === 'no-report')?.level).toBe('warning')
    expect(alerts.find((a) => a.id === 'zero-progress')?.level).toBe('info')
  })

  it('flags an incomplete WBS budget', () => {
    const d = wbsDirectCost('technical_office_cost', [row('1', 100), row('2', 0, 10)])
    expect(buildEstimateAlerts(input({ direct: d })).find((a) => a.id === 'wbs-incomplete')?.level).toBe('critical')
  })

  it('makes missing RNC visible when PPC is low', () => {
    const alert = buildEstimateAlerts(
      input({ ppc: { ppc: 50, weekLabel: 'هفته', missed: 4, missedWithoutReason: 4, source: 'schedule' } })
    ).find((a) => a.id === 'ppc-rnc')
    expect(alert?.level).toBe('critical')
    expect(alert?.title).toMatch(/علت/)
  })

  it('sorts critical first', () => {
    const evm = computeManagerEvm({ bacBase: 100, bacTotal: 100, contractValue: null, plannedPercent: 50, earnedPercent: 50, ac: 1_000 })
    const alerts = buildEstimateAlerts(input({ evm, status: 'incomplete', issues: [{ level: 'warning', message: 'x' }] }))
    expect(alerts[0]?.level).toBe('critical')
    expect(alerts.at(-1)?.level).toBe('info')
  })
})

describe('access', () => {
  it('only the project manager or a system admin may edit', () => {
    expect(canEditCostEstimate({ isSystemAdmin: false, positionKeys: ['project_manager'] })).toBe(true)
    expect(canEditCostEstimate({ isSystemAdmin: true, positionKeys: [] })).toBe(true)
    expect(canEditCostEstimate({ isSystemAdmin: false, positionKeys: ['site_supervisor', 'project_accountant'] })).toBe(false)
  })
})

describe('estimate targets', () => {
  it('profit = contract − BAC total, margin = profit ÷ contract, burn = BAC total ÷ months', () => {
    const bac = buildBac(settings(), direct)
    const t = estimateTargets(settings(), bac)
    expect(t.targetProfit).toBeCloseTo(2_000_000 - 1_254_000)
    expect(t.marginPercent).toBeCloseTo(((2_000_000 - 1_254_000) / 2_000_000) * 100)
    expect(t.burnRateMonthly).toBeCloseTo(1_254_000 / 6)
    expect(t.level).toBe('ok')
  })

  it('BAC above the contract is critical', () => {
    const bac = buildBac(settings({ contractValue: 1_000_000 }), direct)
    const t = estimateTargets(settings({ contractValue: 1_000_000 }), bac)
    expect(t.level).toBe('critical')
    expect(t.marginPercent!).toBeLessThan(0)
  })

  it('a margin under 5% is a warning', () => {
    const s = settings({ contractValue: 1_300_000 })
    const t = estimateTargets(s, buildBac(s, direct))
    expect(t.marginPercent!).toBeGreaterThan(0)
    expect(t.marginPercent!).toBeLessThan(5)
    expect(t.level).toBe('warning')
  })

  it('without a contract value nothing is derived', () => {
    const s = settings({ contractValue: null })
    const t = estimateTargets(s, buildBac(s, direct))
    expect(t.targetProfit).toBeNull()
    expect(t.marginPercent).toBeNull()
    expect(t.level).toBe('none')
  })
})
