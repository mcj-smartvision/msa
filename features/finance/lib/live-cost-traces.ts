import type { EvmBudgetBasis } from '@/features/evm/lib/metrics'
import { faNumber } from '@/features/manager/lib/format'
import { WBS_BASIS_LABEL } from '@/features/manager/lib/cost-estimate'
import { makeTrace, traceInput, v, warnBacScope } from '@/features/calc-trace/lib/build'
import type { CalcTraceMap } from '@/features/calc-trace/lib/types'
import type { LiveWorkshopCostModel } from './live-workshop-cost'
import type { CostCurvePoint } from './workshop-cost-curve'

const OVERHEAD_TABLE = 'project_overhead_workbooks'
const WBS_TABLE = 'project_tasks / workshop_packages'

/** Traces of the accountant's «هزینه تا این لحظه» tab; same numbers as `/api/finance/live-costs`. */
export function buildLiveCostTraces(input: {
  model: LiveWorkshopCostModel
  curve: CostCurvePoint[]
  budgetBasis: EvmBudgetBasis
  activities: { id: string; name: string; wbs: string | null; contractValue: number; currentPercent: number; kind?: string }[]
}): CalcTraceMap {
  const { model } = input
  const traces: CalcTraceMap = {}
  const overheadRows = model.breakdown.filter((r) => r.kind === 'overhead-exact' || r.kind === 'overhead-estimate')

  traces['accountant.overhead_cumulative'] = makeTrace({
    metric: 'accountant.overhead_cumulative',
    label: 'هزینهٔ بالاسری تجمعی',
    result: model.overhead,
    unit: 'toman',
    formula: 'بالاسری تجمعی = Σ ماه‌های بسته + (آخرین ماه بستهٔ غیرصفر × روزهای گذشتهٔ ماه جاری ÷ روزهای ماه)',
    formulaHuman: `${v(model.overheadExact, 'toman')} + ${v(model.overheadEstimated, 'toman')} = ${v(model.overhead, 'toman')}`,
    inputs: overheadRows.map((r) =>
      traceInput(r.id, r.title, r.amount, 'toman', { table: OVERHEAD_TABLE, note: r.note })
    ),
    warnings: [
      overheadRows.length === 0 ? 'هیچ ماه بالاسری در جدول بالاسری کارگاه ثبت نشده است.' : null,
      model.overheadEstimated > 0 ? 'بخشی از عدد (ماه جاری) برآورد است، نه هزینهٔ ثبت‌شده.' : null,
    ],
  })

  const today = input.curve.find((p) => p.isToday) ?? null
  const ev = today?.earned ?? null
  const ac = model.total
  const variance = ev != null ? ev - ac : null
  traces['accountant.cost_variance'] = makeTrace({
    metric: 'accountant.cost_variance',
    label: 'واریانس هزینه (CV = EV − AC)',
    result: variance,
    unit: 'toman',
    formula: 'CV = EV − AC   ·   EV = BAC × درصد کسب‌شدهٔ وزنی',
    formulaHuman:
      variance == null
        ? 'قابل محاسبه نیست: بودجهٔ فعالیت‌ها (BAC) ثبت نشده و EV در دست نیست'
        : `${v(ev, 'toman')} − ${v(ac, 'toman')} = ${v(variance, 'toman')}`,
    inputs: [
      traceInput('ev', 'EV امروز', ev, 'toman', {
        table: WBS_TABLE,
        column: 'percent_complete × physical_weight',
        note: WBS_BASIS_LABEL[input.budgetBasis],
      }),
      traceInput('ac', 'AC — کل هزینه تا این لحظه', ac, 'toman', { table: null, note: 'بالاسری + پیمانکاران + خرید کارفرمایی' }),
      traceInput('overhead', 'بالاسری', model.overhead, 'toman', { table: OVERHEAD_TABLE }),
      traceInput('contractor', 'کارکرد پیمانکاران', model.contractor, 'toman', { table: WBS_TABLE, column: 'quantity × unit_price × percent_complete' }),
      traceInput('purchases', 'خرید کارفرمایی', model.employerPurchases, 'toman', { table: 'employer_purchases', column: 'amount' }),
      traceInput('pv', 'PV امروز (برای مقایسه)', today?.planned ?? null, 'toman', { table: WBS_TABLE, column: 'baseline × physical_weight' }),
    ],
    warnings: [
      warnBacScope({
        bacIsWbsOnly: input.budgetBasis === 'technical_office_cost' || input.budgetBasis === 'contract_value',
        acOverhead: model.overhead,
      }),
    ],
  })

  const share = model.total > 0 ? (model.contractor / model.total) * 100 : null
  const contributors = input.activities
    .map((a) => ({ ...a, amount: a.contractValue * (Math.min(100, Math.max(0, a.currentPercent)) / 100) }))
    .filter((a) => a.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  traces['accountant.contractor_share'] = makeTrace({
    metric: 'accountant.contractor_share',
    label: 'نسبت هزینهٔ پیمانکار به کل',
    result: share,
    unit: 'percent',
    formula: 'سهم پیمانکار = Σ(مقدار × قیمت واحد × پیشرفت) ÷ کل هزینه × 100',
    formulaHuman:
      share == null ? 'قابل محاسبه نیست: کل هزینه صفر است' : `${v(model.contractor, 'toman')} ÷ ${v(model.total, 'toman')} × 100 = ${v(share, 'percent')}`,
    inputs: [
      traceInput('contractor', 'کارکرد پیمانکاران', model.contractor, 'toman', { table: WBS_TABLE, column: 'quantity × unit_price × percent_complete' }),
      traceInput('total', 'کل هزینه تا این لحظه', model.total, 'toman', { table: null }),
      ...contributors.slice(0, 12).map((a) =>
        traceInput(
          `act-${a.id}`,
          `${a.wbs ? `${a.wbs} ` : ''}${a.name} — ${v(a.contractValue, 'toman')} × ${faNumber(a.currentPercent, 1)}٪`,
          a.amount,
          'toman',
          { table: a.kind === 'package' ? 'workshop_packages' : 'project_tasks', rowId: a.id, column: 'quantity × unit_price × percent_complete' }
        )
      ),
    ],
    warnings: [contributors.length > 12 ? `${faNumber(contributors.length - 12)} فعالیت دیگر هم سهم دارند (در جدول نیامده‌اند).` : null],
  })
  return traces
}
