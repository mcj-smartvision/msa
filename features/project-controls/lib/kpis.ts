import type { ControlsSnapshot, ExplainedKpi, ExplainedMetric, KpiStatus } from '@/shared/types/project-controls'
import { DEFAULT_RAG_THRESHOLDS } from '@/features/evm/lib/rag-status'
import { computeEarnedSchedule } from '@/features/project-controls/lib/earned-schedule'
import { buildExplainedMetric, statusFromRag } from '@/features/project-controls/lib/explained-metric'
import { computePpc, computeTcpi, PPC_FORMULA, TCPI_FORMULA } from '@/features/project-controls/lib/tcpi-ppc'

export type EarnedScheduleKpiKey = 'at' | 'es' | 'spi_t' | 'sv_t' | 'eac_t' | 'delay_forecast'

const ES_TITLES: Record<EarnedScheduleKpiKey, { title: string; formula: string }> = {
  at: { title: 'زمان واقعی سپری‌شده (AT)', formula: 'AT = (statusDate − projectStartDate) ÷ daysPerUnit' },
  es: { title: 'زمان کسب‌شده (ES)', formula: 'ES = C + I ;  I = (EV − PV_C) ÷ (PV_C+1 − PV_C) ;  PV_C ≤ EV < PV_C+1' },
  spi_t: { title: 'شاخص عملکرد زمانی مبتنی بر زمان (SPI(t))', formula: 'SPI(t) = ES ÷ AT' },
  sv_t: { title: 'انحراف زمانی مبتنی بر زمان (SV(t))', formula: 'SV(t) = ES − AT' },
  eac_t: { title: 'مدت پیش‌بینی‌شدهٔ تکمیل (EAC(t))', formula: 'EAC(t) = PD ÷ SPI(t)' },
  delay_forecast: { title: 'تأخیر پیش‌بینی‌شده (روز تقویمی)', formula: 'Delay = (EAC(t) − PD) × daysPerUnit' },
}

function fromEngineMetric(metric: ExplainedMetric) {
  return {
    value: metric.value,
    substitution: metric.substitution,
    interpretation_fa: metric.interpretation_fa,
    status: statusFromRag(metric.rag),
    assumptions: metric.assumptions,
    debug: metric.debug,
  }
}

function earnedScheduleKpi(snapshot: ControlsSnapshot, key: EarnedScheduleKpiKey): ExplainedKpi {
  const { title, formula } = ES_TITLES[key]
  return buildExplainedMetric({
    key,
    title_fa: title,
    unit: key === 'spi_t' ? 'ضریب' : key === 'delay_forecast' ? 'روز' : { days: 'روز', weeks: 'هفته', months: 'ماه' }[snapshot.periodUnit],
    formula,
    asOf: snapshot.asOf,
    inputs: {
      projectStart: snapshot.projectStart,
      ev: snapshot.ev,
      pvCurve: snapshot.pvCurve,
      plannedDuration: snapshot.plannedDuration,
      actualTime: snapshot.actualTime,
    },
    inputLabels: {
      projectStart: 'شروع مبنا',
      ev: 'ارزش کسب‌شده (EV)',
      pvCurve: 'منحنی PV مبنا',
      plannedDuration: 'مدت برنامه (PD)',
      actualTime: 'زمان واقعی (AT)',
    },
    compute: (v) => {
      const result = computeEarnedSchedule({
        projectStartDate: v.projectStart,
        statusDate: snapshot.asOf,
        currentEV: v.ev,
        baselinePVCurve: v.pvCurve,
        plannedDurationPeriods: v.plannedDuration,
        periodUnit: snapshot.periodUnit,
      })
      return fromEngineMetric(result.metrics[key])
    },
  })
}

export function buildEarnedScheduleKpis(snapshot: ControlsSnapshot): Record<EarnedScheduleKpiKey, ExplainedKpi> {
  const keys: EarnedScheduleKpiKey[] = ['at', 'es', 'spi_t', 'sv_t', 'eac_t', 'delay_forecast']
  return Object.fromEntries(keys.map((key) => [key, earnedScheduleKpi(snapshot, key)])) as Record<EarnedScheduleKpiKey, ExplainedKpi>
}

export function buildTcpiKpi(snapshot: ControlsSnapshot): ExplainedKpi {
  return buildExplainedMetric({
    key: 'tcpi_bac',
    code: 'KPI-04',
    title_fa: 'شاخص عملکرد لازم برای تکمیل در سقف بودجه (TCPI-BAC)',
    unit: 'ضریب',
    formula: TCPI_FORMULA,
    asOf: snapshot.asOf,
    inputs: { bac: snapshot.bac, ev: snapshot.evCost, ac: snapshot.ac },
    inputLabels: { bac: 'بودجهٔ مبنا (BAC)', ev: 'ارزش کسب‌شدهٔ ریالی (EV)', ac: 'هزینهٔ واقعی (AC)' },
    compute: (v) => {
      const metric = computeTcpi(v)
      return {
        value: metric.value,
        substitution: metric.substitution,
        interpretation_fa: metric.interpretation_fa,
        status: statusFromRag(metric.rag),
        actionable_decision_fa: metric.actionable_decision_fa,
        invalid_reason_fa: metric.debug?.case === 'invalid_input' ? metric.interpretation_fa : undefined,
        debug: metric.debug,
      }
    },
  })
}

export function buildPpcKpi(snapshot: ControlsSnapshot): ExplainedKpi {
  return buildExplainedMetric({
    key: 'ppc',
    code: 'KPI-05',
    title_fa: 'درصد تحقق برنامهٔ هفتگی (PPC)',
    unit: 'درصد',
    formula: PPC_FORMULA,
    asOf: snapshot.asOf,
    inputs: { weeklyPlan: snapshot.weeklyPlan },
    inputLabels: { weeklyPlan: 'برنامهٔ هفتگی متعهد' },
    compute: (v) => {
      const metric = computePpc(v.weeklyPlan.planned, v.weeklyPlan.completed)
      return {
        value: metric.value,
        substitution: metric.substitution,
        interpretation_fa: metric.interpretation_fa,
        status: statusFromRag(metric.rag),
        actionable_decision_fa: metric.actionable_decision_fa,
        debug: { ...metric.debug, weekStart: v.weeklyPlan.weekStart, weekEnd: v.weeklyPlan.weekEnd },
      }
    },
  })
}

export type EvmKpiKey = 'pv' | 'ev' | 'spi' | 'cpi'

const pct = (x: number) => `${x.toFixed(2)}٪`

/** Index colour on the project's SPI/CPI thresholds (≥ onTrack green, < critical red). */
function indexStatus(value: number): KpiStatus {
  if (value >= DEFAULT_RAG_THRESHOLDS.onTrack) return 'green'
  if (value >= DEFAULT_RAG_THRESHOLDS.critical) return 'yellow'
  return 'red'
}

const faInt = (x: number) => Math.round(x).toLocaleString('fa-IR')
const faIndex = (x: number) => x.toLocaleString('fa-IR', { maximumFractionDigits: 2 })
const THRESHOLDS_FA = `آستانه‌ها: سبز از ${faIndex(DEFAULT_RAG_THRESHOLDS.onTrack)} به بالا، زرد تا ${faIndex(DEFAULT_RAG_THRESHOLDS.critical)}، قرمز کمتر از ${faIndex(DEFAULT_RAG_THRESHOLDS.critical)}`

const BASIS_FA: Record<ControlsSnapshot['progressBasis'], string> = {
  schedule_weight: 'مبنا: وزن زمان‌بندی (MSP) نرمال‌شده',
  budget: 'مبنا: بودجه (هیچ فعالیتی وزن زمان‌بندی ندارد)',
}

export function buildEvmKpis(snapshot: ControlsSnapshot): Record<EvmKpiKey, ExplainedKpi> {
  const basis = BASIS_FA[snapshot.progressBasis]
  const pv = buildExplainedMetric({
    key: 'pv',
    title_fa: 'ارزش برنامه‌ای (PV٪)',
    unit: 'درصد',
    formula: 'PV٪ = Σ(wᵢ × Planned٪ᵢ) ÷ Σwᵢ',
    asOf: snapshot.asOf,
    inputs: { pv: snapshot.pv },
    inputLabels: { pv: 'پیشرفت برنامه طبق baseline' },
    compute: (v) => ({
      value: Math.round(v.pv * 100) / 100,
      substitution: `PV٪ = ${pct(v.pv)} تا ${snapshot.asOf}`,
      interpretation_fa: `طبق baseline منجمد، تا تاریخ وضعیت باید ${pct(v.pv)} پروژه انجام می‌شد.`,
      status: 'gray',
      assumptions: [basis],
    }),
  })
  const ev = buildExplainedMetric({
    key: 'ev',
    title_fa: 'ارزش کسب‌شده (EV٪)',
    unit: 'درصد',
    formula: 'EV٪ = Σ(wᵢ × Physical٪ᵢ) ÷ Σwᵢ',
    asOf: snapshot.asOf,
    inputs: { ev: snapshot.ev },
    inputLabels: { ev: 'پیشرفت فیزیکی تأییدشده' },
    compute: (v) => ({
      value: Math.round(v.ev * 100) / 100,
      substitution: `EV٪ = ${pct(v.ev)}`,
      interpretation_fa: `طبق پیشرفت فیزیکی تأییدشده، ${pct(v.ev)} پروژه انجام شده است (همان پیشرفت تجمعی).`,
      status: 'gray',
      assumptions: [basis],
    }),
  })
  const spi = buildExplainedMetric({
    key: 'spi',
    title_fa: 'شاخص عملکرد زمانی (SPI)',
    unit: 'ضریب',
    formula: 'SPI = EV٪ ÷ PV٪',
    asOf: snapshot.asOf,
    inputs: { ev: snapshot.ev, pv: snapshot.pv },
    inputLabels: { ev: 'ارزش کسب‌شده (EV٪)', pv: 'ارزش برنامه‌ای (PV٪)' },
    compute: (v) => {
      if (!(v.pv > 0)) {
        return { value: null, substitution: `SPI = ${pct(v.ev)} ÷ ${pct(v.pv)}`, interpretation_fa: '', status: 'gray', invalid_reason_fa: 'تا تاریخ وضعیت هنوز کاری طبق برنامه شروع نشده (PV٪ = ۰)' }
      }
      const value = v.ev / v.pv
      return {
        value: Math.round(value * 1000) / 1000,
        substitution: `SPI = ${pct(v.ev)} ÷ ${pct(v.pv)} = ${value.toFixed(3)}`,
        interpretation_fa:
          value >= 1
            ? 'پروژه هم‌پای برنامه یا جلوتر از آن است.'
            : `به ازای هر ۱۰۰ واحد کار برنامه‌ریزی‌شده، ${faInt(value * 100)} واحد انجام شده است.`,
        status: indexStatus(value),
        assumptions: [basis, THRESHOLDS_FA],
      }
    },
  })
  const cpi = buildExplainedMetric({
    key: 'cpi',
    title_fa: 'شاخص عملکرد هزینه (CPI)',
    unit: 'ضریب',
    formula: 'CPI = EV_cost ÷ AC ;  EV_cost = Σ(Budgetᵢ × Physical٪ᵢ)',
    asOf: snapshot.asOf,
    inputs: { evCost: snapshot.evCost, ac: snapshot.ac },
    inputLabels: { evCost: 'ارزش کسب‌شدهٔ ریالی', ac: 'هزینهٔ واقعی (AC)' },
    compute: (v) => {
      const value = v.evCost / v.ac
      return {
        value: Math.round(value * 1000) / 1000,
        substitution: `CPI = ${Math.round(v.evCost).toLocaleString('en-US')} ÷ ${Math.round(v.ac).toLocaleString('en-US')} = ${value.toFixed(3)}`,
        interpretation_fa:
          value >= 1
            ? 'به ازای هر واحد هزینه، دست‌کم یک واحد ارزش کسب شده است.'
            : `به ازای هر ۱۰۰ واحد هزینه، ${faInt(value * 100)} واحد ارزش کسب شده؛ هزینه بیش از بودجه است.`,
        status: indexStatus(value),
        assumptions: [THRESHOLDS_FA],
      }
    },
  })
  return { pv, ev, spi, cpi }
}

export const SPI_DIVERGENCE_WARNING_FA = 'SPI سنتی ممکن است در اواخر پروژه گمراه‌کننده باشد؛ SPI(t) مبنای کنترل زمان است.'
/** SPI within this distance of 1 counts as "near 1". */
export const SPI_NEAR_ONE_TOLERANCE = 1 - DEFAULT_RAG_THRESHOLDS.onTrack
export const SPI_T_CONTROL_THRESHOLD = 0.9

/**
 * Money/percent SPI drifts back toward 1 as a late project nears completion while SPI(t) keeps
 * showing the delay. Warn when SPI looks near 1 (|SPI − 1| ≤ 0.05) but SPI(t) is below 0.9.
 */
export function spiDivergenceWarning(spi: ExplainedKpi, spiT: ExplainedKpi): string | null {
  if (spi.value == null || spiT.value == null) return null
  const nearOne = Math.abs(spi.value - 1) <= SPI_NEAR_ONE_TOLERANCE + 1e-9
  return nearOne && spiT.value < SPI_T_CONTROL_THRESHOLD ? SPI_DIVERGENCE_WARNING_FA : null
}

export function buildAllKpis(snapshot: ControlsSnapshot) {
  return {
    ...buildEvmKpis(snapshot),
    ...buildEarnedScheduleKpis(snapshot),
    tcpi_bac: buildTcpiKpi(snapshot),
    ppc: buildPpcKpi(snapshot),
  }
}
