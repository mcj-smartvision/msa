import type { EvmBudgetBasis } from '@/features/evm/lib/metrics'
import type { ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'
import {
  cpiIsCritical,
  makeTrace,
  ppcTrace,
  progressGapTrace,
  traceInput,
  v,
  warnBacScope,
  warnCpiLow,
  warnEacBelowAc,
  warnUniformPv,
  type ProgressCompareInput,
} from '@/features/calc-trace/lib/build'
import type { CalcTraceInput, CalcTraceMap } from '@/features/calc-trace/lib/types'
import { faNumber, jalaliDate } from './format'
import type { ManagerCurve, ManagerEvmSummary } from './overview-types'
import type { ProgressRecordRow } from './progress-curve'
import {
  WBS_BASIS_LABEL,
  type ActualCostModel,
  type BacModel,
  type CostEstimateSettings,
  type EstimateTargets,
  type IndexValue,
  type ManagerEvm,
} from './cost-estimate'

const WBS_TABLE = 'project_tasks / workshop_packages'

const BUDGET_COLUMN: Record<EvmBudgetBasis, string | null> = {
  technical_office_cost: 'cost',
  contract_value: 'quantity × unit_price',
  weighted_project_budget: 'projects.budget × physical_weight',
  none: null,
}

const isWbsBudget = (basis: EvmBudgetBasis) => basis === 'technical_office_cost' || basis === 'contract_value'

/** Latest supervisor record of each activity (by report date, then entry time). */
export function latestRecordByActivity(records: ProgressRecordRow[]): Map<string, ProgressRecordRow> {
  const out = new Map<string, ProgressRecordRow>()
  for (const r of records) {
    const prev = out.get(r.activityId)
    if (!prev || r.date > prev.date || (r.date === prev.date && r.at > prev.at)) out.set(r.activityId, r)
  }
  return out
}

export function progressRowsFromSnapshot(
  snapshot: ProjectEvmSnapshot,
  latest: (id: string) => { percent: number; date: string } | null
): ProgressCompareInput[] {
  return snapshot.activities
    .filter((a) => a.weight > 0)
    .map((a) => {
      const report = latest(a.id)
      return {
        id: a.id,
        name: a.name,
        wbs: a.wbs,
        weight: a.weight,
        stored: a.physicalPercent,
        supervisor: report ? report.percent : null,
        supervisorDate: report ? report.date : null,
        table: a.kind === 'package' ? 'workshop_packages' : 'project_tasks',
      }
    })
}

function curvePlannedPoints(curve: ManagerCurve | null): { date: string; planned: number }[] {
  if (!curve) return []
  return curve.points.filter((p) => p.kind === 'month' || p.kind === 'today').map((p) => ({ date: p.date, planned: p.planned }))
}

/* --------------------------------------------------------------------- Home */

/** Traces of the manager home cards; same numbers as `KpiStrip` (BAC from WBS, AC from cost records). */
export function buildHomeTraces(input: {
  evm: ManagerEvmSummary
  snapshot: ProjectEvmSnapshot
  curve: ManagerCurve | null
  progressRows: ProgressCompareInput[]
}): CalcTraceMap {
  const { evm, snapshot, curve } = input
  const m = snapshot.metrics
  const basis = m.budgetBasis
  const costReady = basis !== 'none' && m.ac > 0
  const scope = warnBacScope({ bacIsWbsOnly: isWbsBudget(basis), acOverhead: m.acBySource.overhead })

  const bacIn = traceInput('bac', 'BAC — جمع بودجهٔ فعالیت‌ها', m.bac, 'toman', {
    table: basis === 'weighted_project_budget' ? 'projects' : WBS_TABLE,
    column: BUDGET_COLUMN[basis],
    note: WBS_BASIS_LABEL[basis],
  })
  const evIn = traceInput('ev', 'EV — Σ(بودجهٔ فعالیت × درصد فیزیکی)', m.evAmount, 'toman', {
    table: WBS_TABLE,
    column: 'percent_complete',
    note: `${faNumber(m.activityCount)} فعالیت برگ`,
  })
  const acParts: CalcTraceInput[] = [
    traceInput('ac_expense', 'AC: اسناد هزینهٔ حسابداری', m.acBySource.expense, 'toman', {
      table: 'accounting_documents → expense_items',
      column: 'amount',
      note: 'اسناد قطعی/اصلاح‌شده تا امروز؛ ریال ÷ 10',
    }),
    traceInput('ac_bill', 'AC: صورت‌حساب تأمین‌کنندگان', m.acBySource.vendor_bill, 'toman', {
      table: 'vendor_bills',
      column: 'amount',
      note: 'ریال ÷ 10',
    }),
    traceInput('ac_overhead', 'AC: بالاسری کارگاه', m.acBySource.overhead, 'toman', {
      table: 'project_overhead_workbooks',
      note: 'ماه‌های بسته + برآورد ماه جاری',
    }),
  ]
  const acIn = traceInput('ac', 'AC — هزینهٔ واقعی تا امروز', m.ac, 'toman', { table: null, note: 'جمع سه ردیف AC' })

  const cpi = costReady ? evm.cpi : null
  const eac = costReady && cpi != null && cpi > 0 ? m.bac / cpi : null
  const etc = eac != null ? eac - m.ac : null
  const cv = costReady ? m.evAmount - m.ac : null
  const notReady = basis === 'none' ? 'بودجهٔ فعالیت‌ها ثبت نشده' : 'هزینهٔ واقعی (AC) صفر است'
  const traces: CalcTraceMap = {}

  traces['home.cpi'] = makeTrace({
    metric: 'home.cpi',
    label: 'CPI — شاخص عملکرد هزینه',
    result: cpi,
    unit: 'index',
    formula: 'CPI = EV ÷ AC',
    formulaHuman: cpi == null ? `قابل محاسبه نیست: ${notReady}` : `${v(m.evAmount, 'toman')} ÷ ${v(m.ac, 'toman')} = ${v(cpi, 'index')}`,
    inputs: [evIn, acIn, ...acParts, bacIn],
    warnings: [scope, warnCpiLow(cpi)],
    critical: cpiIsCritical(cpi),
  })
  traces['home.cv'] = makeTrace({
    metric: 'home.cv',
    label: 'CV — انحراف هزینه',
    result: cv,
    unit: 'toman',
    formula: 'CV = EV − AC',
    formulaHuman: cv == null ? `قابل محاسبه نیست: ${notReady}` : `${v(m.evAmount, 'toman')} − ${v(m.ac, 'toman')} = ${v(cv, 'toman')}`,
    inputs: [evIn, acIn, ...acParts],
    warnings: [scope],
  })
  traces['home.eac'] = makeTrace({
    metric: 'home.eac',
    label: 'EAC — برآورد هزینهٔ نهایی',
    result: eac,
    unit: 'toman',
    formula: 'EAC = BAC ÷ CPI',
    formulaHuman: eac == null ? `قابل محاسبه نیست: ${cpi == null ? notReady : 'CPI صفر است'}` : `${v(m.bac, 'toman')} ÷ ${v(cpi, 'index')} = ${v(eac, 'toman')}`,
    inputs: [bacIn, traceInput('cpi', 'CPI', cpi, 'index', { table: null, note: 'EV ÷ AC' }), evIn, acIn],
    warnings: [scope, warnEacBelowAc(eac, m.ac), warnCpiLow(cpi)],
    critical: cpiIsCritical(cpi) || (eac != null && eac < m.ac),
  })
  traces['home.etc'] = makeTrace({
    metric: 'home.etc',
    label: 'ETC — هزینهٔ باقی‌مانده تا پایان',
    result: etc,
    unit: 'toman',
    formula: 'ETC = EAC − AC',
    formulaHuman: etc == null ? 'قابل محاسبه نیست: EAC در دست نیست' : `${v(eac, 'toman')} − ${v(m.ac, 'toman')} = ${v(etc, 'toman')}`,
    inputs: [traceInput('eac', 'EAC', eac, 'toman', { table: null, note: 'BAC ÷ CPI' }), acIn],
    warnings: [scope, warnEacBelowAc(eac, m.ac)],
    critical: eac != null && eac < m.ac,
  })

  const progressInputs = [
    bacIn,
    traceInput('planned', 'درصد برنامه‌ای تا امروز Σ(wᵢ × planᵢ) ÷ Σwᵢ', m.plannedPercent, 'percent', {
      table: WBS_TABLE,
      column: 'baseline_start / baseline_finish × physical_weight',
    }),
    traceInput('earned', 'درصد کسب‌شده Σ(wᵢ × physicalᵢ) ÷ Σwᵢ', m.earnedPercent, 'percent', {
      table: WBS_TABLE,
      column: 'percent_complete × physical_weight',
    }),
    traceInput('weight', 'Σwᵢ — جمع وزن فعالیت‌ها', m.totalWeight, 'weight', { table: WBS_TABLE, column: 'physical_weight' }),
  ]
  traces['home.sv'] = makeTrace({
    metric: 'home.sv',
    label: 'SV — انحراف زمان‌بندی (ریالی)',
    result: basis === 'none' ? null : m.sv,
    unit: 'toman',
    formula: 'SV = EV − PV = BAC × (درصد کسب‌شده − درصد برنامه‌ای)',
    formulaHuman:
      basis === 'none'
        ? 'قابل محاسبه نیست: بودجهٔ فعالیت‌ها ثبت نشده'
        : `${v(m.ev, 'toman')} − ${v(m.pv, 'toman')} = ${v(m.sv, 'toman')}`,
    inputs: [
      traceInput('pv', 'PV = BAC × درصد برنامه‌ای', m.pv, 'toman', { table: null }),
      traceInput('ev_s', 'EV = BAC × درصد کسب‌شده', m.ev, 'toman', { table: null }),
      ...progressInputs,
    ],
  })

  const plannedPoints = curvePlannedPoints(curve)
  const uniform = warnUniformPv(plannedPoints.map((p) => p.planned))
  const f = evm.scheduleForecast
  traces['home.spi_t'] = makeTrace({
    metric: 'home.spi_t',
    label: 'SPI(t) — شاخص عملکرد زمانی (Earned Schedule)',
    result: f?.spiT ?? null,
    unit: 'index',
    formula: 'SPI(t) = ES ÷ AT',
    formulaHuman:
      f?.spiT == null
        ? 'قابل محاسبه نیست: امروز پیش از شروع baseline است یا برنامه‌ای در دست نیست'
        : `${v(f.earnedScheduleDays, 'days')} ÷ ${v(f.actualTimeDays, 'days')} = ${v(f.spiT, 'index')}`,
    inputs: f
      ? [
          traceInput('start', 'شروع baseline (کمترین تاریخ شروع)', f.start, 'text', { table: WBS_TABLE, column: 'baseline_start' }),
          traceInput('finish', 'پایان baseline (بیشترین تاریخ پایان)', f.plannedFinish, 'text', { table: WBS_TABLE, column: 'baseline_finish' }),
          traceInput('es', 'ES — روزی که برنامه به EV امروز می‌رسید', f.earnedScheduleDays, 'days', {
            table: null,
            note: 'درون‌یابی درصد کسب‌شده روی منحنی PV',
          }),
          traceInput('at', 'AT — روزهای سپری‌شده از شروع', f.actualTimeDays, 'days', { table: null }),
          traceInput('pd', 'PD — مدت برنامه', f.plannedDurationDays, 'days', { table: null }),
          traceInput('earned', 'درصد کسب‌شده', m.earnedPercent, 'percent', { table: WBS_TABLE, column: 'percent_complete' }),
          traceInput('variance', 'انحراف زمانی AT − ES', f.varianceDays, 'days', { table: null }),
        ]
      : progressInputs,
    warnings: [uniform, f?.planPeriodEnded ? 'دورهٔ برنامهٔ مبنا تمام شده؛ بازبرنامه‌ریزی را در نظر بگیرید.' : null],
  })

  traces['home.pv_curve'] = makeTrace({
    metric: 'home.pv_curve',
    label: 'منحنی S — مقدار PV هر دوره',
    result: m.plannedPercent,
    unit: 'percent',
    formula: 'PV(t) = Σ(wᵢ × planᵢ(t)) ÷ Σwᵢ   — planᵢ(t) خطی بین شروع و پایان baseline فعالیت',
    formulaHuman: `PV امروز = ${v(m.plannedPercent, 'percent')} (${faNumber(plannedPoints.length)} نقطهٔ منحنی)`,
    inputs: plannedPoints.map((p, i) =>
      traceInput(`pv-${i}`, `PV ${jalaliDate(p.date)}`, p.planned, 'percent', {
        table: WBS_TABLE,
        column: 'baseline_start / baseline_finish × physical_weight',
      })
    ),
    warnings: [uniform],
  })

  traces['home.progress_gap'] = progressGapTrace('home.progress_gap', input.progressRows)
  return traces
}

/* ----------------------------------------------------------------- Estimate */

const EST_TABLE = 'project_cost_estimates'

function idx(value: IndexValue): { result: number | null; reason: string | null } {
  return { result: value.value, reason: value.value == null ? value.reason ?? 'داده کافی نیست' : null }
}

/** Traces of the «برآورد و کنترل هزینه» tab. */
export function buildEstimateTraces(input: {
  settings: CostEstimateSettings
  hasRecord: boolean
  directBasis: EvmBudgetBasis
  bac: BacModel
  targets: EstimateTargets
  actual: ActualCostModel
  evm: ManagerEvm
  progress: { plannedPercent: number | null; earnedPercent: number | null }
  schedule: { spiT: IndexValue; plannedDurationMonths: IndexValue; eacMonths: IndexValue; baselineStart: string | null; baselineFinish: string | null }
  plannedPvPoints: number[]
  ppcWeek: { start: string; end: string; planned: number; completed: number; ppc: number | null } | null
  ppcSource: 'schedule' | 'wwp'
  progressRows: ProgressCompareInput[]
}): CalcTraceMap {
  const { settings, bac, targets, actual, evm } = input
  const preview = input.hasRecord ? null : 'برآورد هنوز ذخیره نشده؛ این عدد پیش‌نمایش با مقادیر فرم است.'
  const traces: CalcTraceMap = {}

  const componentInputs = bac.components.map((c) =>
    traceInput(
      `bac-${c.key}`,
      `${c.label}${c.included ? '' : ' (جمع نمی‌شود)'} — ${c.formula}`,
      c.amount,
      'toman',
      c.key === 'direct'
        ? { table: WBS_TABLE, column: BUDGET_COLUMN[input.directBasis], note: c.source }
        : { table: EST_TABLE, column: COMPONENT_COLUMN[c.key], note: c.note ?? c.source }
    )
  )
  const included = bac.components.filter((c) => c.included && c.amount != null)
  traces['estimate.bac_total'] = makeTrace({
    metric: 'estimate.bac_total',
    label: 'BAC کل — بودجهٔ کل داخلی',
    result: bac.bacTotal > 0 ? bac.bacTotal : null,
    unit: 'toman',
    formula: 'BAC کل = هزینهٔ مستقیم WBS + بالاسری × مدت + پرسنل × مدت + خرید کارفرمایی + سایر + ذخیرهٔ ریسک',
    formulaHuman: `${included.map((c) => v(c.amount, 'toman')).join(' + ') || '0'} + ${v(bac.riskReserve, 'toman')} (ریسک) = ${v(bac.bacTotal, 'toman')}`,
    inputs: [
      ...componentInputs,
      traceInput('duration', 'مدت برنامه‌ای (ماه شمسی)', bac.durationMonths, 'months', {
        table: EST_TABLE,
        column: 'planned_start / planned_finish',
      }),
      traceInput('base', 'BAC پایه', bac.bacBase, 'toman', { table: null, note: 'جمع اجزای منظورشده' }),
      traceInput('risk', `ذخیرهٔ ریسک — ${bac.riskFormula}`, bac.riskReserve, 'toman', { table: EST_TABLE, column: 'risk_mode / risk_value' }),
    ],
    warnings: [preview],
  })

  const targetWarnings = targets.messages.map((m) => m.text)
  traces['estimate.target_profit_pct'] = makeTrace({
    metric: 'estimate.target_profit_pct',
    label: 'حاشیهٔ سود هدف (Target Profit %)',
    result: targets.marginPercent,
    unit: 'percent',
    formula: 'حاشیهٔ سود = (مبلغ قرارداد − BAC کل) ÷ مبلغ قرارداد × 100',
    formulaHuman:
      targets.marginPercent == null
        ? 'قابل محاسبه نیست: مبلغ قرارداد یا BAC کل وارد نشده'
        : `(${v(settings.contractValue, 'toman')} − ${v(bac.bacTotal, 'toman')}) ÷ ${v(settings.contractValue, 'toman')} × 100 = ${v(targets.marginPercent, 'percent')}`,
    inputs: [
      traceInput('contract', 'مبلغ قرارداد با کارفرما', settings.contractValue, 'toman', { table: EST_TABLE, column: 'contract_value' }),
      traceInput('bac_total', 'BAC کل', bac.bacTotal, 'toman', { table: null, note: 'از «BAC کل»' }),
      traceInput('profit', 'سود هدف = قرارداد − BAC کل', targets.targetProfit, 'toman', { table: null }),
    ],
    warnings: [preview, ...targetWarnings],
    critical: targets.level === 'critical',
  })

  traces['estimate.overhead_burn_rate'] = makeTrace({
    metric: 'estimate.overhead_burn_rate',
    label: 'نرخ سوختن بالاسری (تومان در روز)',
    result: targets.overheadPerDay,
    unit: 'toman_per_day',
    formula: 'نرخ سوختن بالاسری = (بالاسری ماهانه × مدت به ماه) ÷ مدت به روز',
    formulaHuman:
      targets.overheadPerDay == null
        ? settings.overheadInWbs
          ? 'بالاسری در بودجهٔ WBS منظور شده و جداگانه برآورد نمی‌شود.'
          : 'قابل محاسبه نیست: بالاسری ماهانه یا تاریخ‌های مصوب وارد نشده'
        : `${v(targets.plannedOverheadTotal, 'toman')} ÷ ${v(targets.durationDays, 'days')} = ${v(targets.overheadPerDay, 'toman_per_day')}`,
    inputs: [
      traceInput('monthly', 'بالاسری ماهانه', settings.monthlyOverhead, 'toman_per_month', { table: EST_TABLE, column: 'monthly_overhead' }),
      traceInput('months', 'مدت برنامه‌ای (ماه شمسی)', bac.durationMonths, 'months', { table: EST_TABLE, column: 'planned_start / planned_finish' }),
      traceInput('total', 'بالاسری کل برنامه‌ای', targets.plannedOverheadTotal, 'toman', { table: null }),
      traceInput('days', 'مدت برنامه‌ای (روز)', targets.durationDays, 'days', { table: EST_TABLE, column: 'planned_start / planned_finish' }),
      traceInput('burn', 'نرخ سوختن کل = BAC کل ÷ مدت (تومان در ماه)', targets.burnRateMonthly, 'toman_per_month', { table: null }),
    ],
    warnings: [preview],
  })

  /* EVM on BAC base and the live AC model */
  const overheadPlanned = bac.components.find((c) => c.key === 'overhead')
  const bacIsWbsOnly = !(overheadPlanned?.included) && !settings.overheadInWbs
  const acOverhead = actual.parts.find((p) => p.key === 'overhead')?.amount ?? 0
  const scope = warnBacScope({ bacIsWbsOnly, acOverhead })
  const acIn = traceInput('ac', 'AC — هزینهٔ واقعی تا امروز (مدل «هزینه تا این لحظه»)', actual.total, 'toman', { table: null, note: 'جمع ردیف‌های AC' })
  const acParts = actual.parts.map((p) =>
    traceInput(`ac-${p.key}`, `AC: ${p.label}`, p.amount, 'toman', {
      table: p.key === 'overhead' ? 'project_overhead_workbooks' : p.key === 'contractor' ? WBS_TABLE : 'employer_purchases',
      column: p.key === 'contractor' ? 'quantity × unit_price × percent_complete' : p.key === 'purchases' ? 'amount' : null,
      note: p.source,
    })
  )
  const excluded = actual.excluded.map((e, i) =>
    traceInput(`ac-x-${i}`, `در AC جمع نمی‌شود: ${e.label} (${faNumber(e.count)} مورد)`, e.amount, 'toman', { table: null, note: e.reason })
  )
  const bacBaseIn = traceInput('bac_base', 'BAC پایه (بدون ذخیرهٔ ریسک)', evm.bacBase, 'toman', { table: null, note: 'مبنای PV و EV' })
  const evIn = traceInput('ev', 'EV = BAC پایه × درصد کسب‌شده', evm.ev.value, 'toman', { table: null })
  const pvIn = traceInput('pv', 'PV = BAC پایه × درصد برنامه‌ای', evm.pv.value, 'toman', { table: null })
  const pctIns = [
    traceInput('planned', 'درصد برنامه‌ای تا امروز (وزنی)', input.progress.plannedPercent, 'percent', {
      table: WBS_TABLE,
      column: 'baseline_start / baseline_finish × physical_weight',
    }),
    traceInput('earned', 'درصد کسب‌شده (وزنی، تأییدشده)', input.progress.earnedPercent, 'percent', {
      table: WBS_TABLE,
      column: 'percent_complete × physical_weight',
    }),
  ]

  const cpi = idx(evm.cpi)
  traces['estimate.cpi'] = makeTrace({
    metric: 'estimate.cpi',
    label: 'CPI — شاخص عملکرد هزینه',
    result: cpi.result,
    unit: 'index',
    formula: 'CPI = EV ÷ AC',
    formulaHuman: cpi.reason ?? `${v(evm.ev.value, 'toman')} ÷ ${v(evm.ac, 'toman')} = ${v(cpi.result, 'index')}`,
    inputs: [evIn, acIn, ...acParts, bacBaseIn, ...pctIns, ...excluded],
    warnings: [scope, warnCpiLow(cpi.result)],
    critical: cpiIsCritical(cpi.result),
  })
  const cv = idx(evm.cv)
  traces['estimate.cv'] = makeTrace({
    metric: 'estimate.cv',
    label: 'CV — انحراف هزینه',
    result: cv.result,
    unit: 'toman',
    formula: 'CV = EV − AC',
    formulaHuman: cv.reason ?? `${v(evm.ev.value, 'toman')} − ${v(evm.ac, 'toman')} = ${v(cv.result, 'toman')}`,
    inputs: [evIn, acIn, ...acParts],
    warnings: [scope],
  })
  const sv = idx(evm.sv)
  traces['estimate.sv'] = makeTrace({
    metric: 'estimate.sv',
    label: 'SV — انحراف زمان‌بندی (ریالی)',
    result: sv.result,
    unit: 'toman',
    formula: 'SV = EV − PV',
    formulaHuman: sv.reason ?? `${v(evm.ev.value, 'toman')} − ${v(evm.pv.value, 'toman')} = ${v(sv.result, 'toman')}`,
    inputs: [evIn, pvIn, bacBaseIn, ...pctIns],
  })
  const eac = idx(evm.eac)
  traces['estimate.eac'] = makeTrace({
    metric: 'estimate.eac',
    label: 'EAC — برآورد هزینهٔ نهایی',
    result: eac.result,
    unit: 'toman',
    formula: 'EAC = AC + (BAC پایه − EV) ÷ CPI',
    formulaHuman:
      eac.reason ??
      `${v(evm.ac, 'toman')} + (${v(evm.bacBase, 'toman')} − ${v(evm.ev.value, 'toman')}) ÷ ${v(cpi.result, 'index')} = ${v(eac.result, 'toman')}`,
    inputs: [acIn, bacBaseIn, evIn, traceInput('cpi', 'CPI', cpi.result, 'index', { table: null, note: 'EV ÷ AC' })],
    warnings: [scope, warnEacBelowAc(eac.result, evm.ac), warnCpiLow(cpi.result)],
    critical: cpiIsCritical(cpi.result) || (eac.result != null && eac.result < evm.ac),
  })
  const etc = idx(evm.etc)
  traces['estimate.etc'] = makeTrace({
    metric: 'estimate.etc',
    label: 'ETC — هزینهٔ باقی‌مانده تا پایان',
    result: etc.result,
    unit: 'toman',
    formula: 'ETC = EAC − AC',
    formulaHuman: etc.reason ?? `${v(eac.result, 'toman')} − ${v(evm.ac, 'toman')} = ${v(etc.result, 'toman')}`,
    inputs: [traceInput('eac', 'EAC', eac.result, 'toman', { table: null }), acIn],
    warnings: [warnEacBelowAc(eac.result, evm.ac)],
  })

  const s = input.schedule
  traces['estimate.spi_t'] = makeTrace({
    metric: 'estimate.spi_t',
    label: 'SPI(t) — شاخص عملکرد زمانی (Earned Schedule)',
    result: s.spiT.value,
    unit: 'index',
    formula: 'SPI(t) = ES ÷ AT   ·   EAC(t) = PD ÷ SPI(t)',
    formulaHuman:
      s.spiT.value == null
        ? s.spiT.reason ?? 'داده کافی نیست'
        : `SPI(t) = ${v(s.spiT.value, 'index')}   ·   EAC(t) = ${v(s.plannedDurationMonths.value, 'months')} ÷ ${v(s.spiT.value, 'index')} = ${v(s.eacMonths.value, 'months')}`,
    inputs: [
      traceInput('start', 'شروع baseline', s.baselineStart, 'text', { table: WBS_TABLE, column: 'baseline_start' }),
      traceInput('finish', 'پایان baseline', s.baselineFinish, 'text', { table: WBS_TABLE, column: 'baseline_finish' }),
      traceInput('pd', 'PD — مدت برنامه (ماه 30.44 روزه)', s.plannedDurationMonths.value, 'months', { table: null }),
      traceInput('eac_t', 'EAC(t)', s.eacMonths.value, 'months', { table: null }),
      ...pctIns,
    ],
    warnings: [warnUniformPv(input.plannedPvPoints)],
  })

  traces['estimate.ppc'] = ppcTrace('estimate.ppc', input.ppcWeek, input.ppcSource)
  traces['estimate.progress_gap'] = progressGapTrace('estimate.progress_gap', input.progressRows)
  return traces
}

const COMPONENT_COLUMN: Record<string, string> = {
  overhead: 'monthly_overhead × مدت',
  personnel: 'monthly_personnel × مدت',
  purchases: 'planned_employer_purchases',
  other: 'other_fixed_costs',
}
