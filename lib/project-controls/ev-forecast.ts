import type { ControlsSnapshot, ExplainedKpi, PVCurvePoint } from '@/types/project-controls'
import type { EarnedScheduleKpiKey } from '@/lib/project-controls/kpis'

const DAY_MS = 86_400_000

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** Linear PV between the baseline curve points, the interpolation ES itself is solved on. */
export function pvAtPeriod(curve: PVCurvePoint[], t: number): number {
  if (curve.length === 0) return 0
  if (t <= curve[0]!.periodIndex) return curve[0]!.cumulativePV
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!
    const b = curve[i]!
    if (t <= b.periodIndex) return a.cumulativePV + ((b.cumulativePV - a.cumulativePV) * (t - a.periodIndex)) / (b.periodIndex - a.periodIndex)
  }
  return curve[curve.length - 1]!.cumulativePV
}

export interface EvForecastPoint {
  date: string
  /** Forecast EV, percent of project. */
  earned: number
}

export type EvForecast =
  | {
      status: 'ok'
      /** Status date; the first point equals today's EV. */
      asOf: string
      baselineFinish: string
      /** Baseline finish + DelayDays — the date the forecast EV reaches 100%. */
      finishDate: string
      delayDays: number
      spiT: number
      eacT: number
      plannedDuration: number
      earnedSchedule: number
      periodUnit: ControlsSnapshot['periodUnit']
      daysPerUnit: number
      points: EvForecastPoint[]
    }
  | { status: 'unavailable'; reason_fa: string }

const unavailable = (reason_fa: string): EvForecast => ({ status: 'unavailable', reason_fa })

/**
 * EV forecast if the rest of the work keeps today's time efficiency: earned schedule advances
 * SPI(t) periods per elapsed period, so EV(d) = PV_baseline(ES + Δt(d) × SPI(t)), and the project
 * completes at baseline finish + DelayDays (= start + EAC(t)). Values come only from the snapshot
 * and its KPIs; `dates` chooses where the forecast is sampled (today and the finish are always added).
 */
export function buildEvForecast(
  snapshot: ControlsSnapshot,
  kpis: Pick<Record<EarnedScheduleKpiKey, ExplainedKpi>, 'spi_t' | 'eac_t' | 'delay_forecast'>,
  dates: string[] = []
): EvForecast {
  for (const key of ['spi_t', 'eac_t', 'delay_forecast'] as const) {
    const kpi = kpis[key]
    if (kpi.value == null) return unavailable(`${kpi.title_fa}: ${kpi.reason_fa ?? kpi.interpretation_fa}`)
  }
  const curve = snapshot.pvCurve.value
  const pd = snapshot.plannedDuration.value
  const es = snapshot.earnedSchedule.value
  const at = snapshot.actualTime.value
  const ev = snapshot.ev.value
  const finish = snapshot.baselineFinish.value
  if (!curve || curve.length < 2 || pd == null || es == null || at == null || ev == null || !finish) {
    return unavailable('منحنی PV مبنا یا زمان کسب‌شده در دسترس نیست')
  }
  if (ev >= 99.95) return unavailable('پروژه به‌طور کامل کسب شده؛ پیش‌بینی لازم نیست')
  const spiT = es / at
  if (!(spiT > 0)) return unavailable('SPI(t) صفر است (هنوز کاری کسب نشده)؛ با سرعت صفر تاریخ پایانی قابل پیش‌بینی نیست')

  const dpu = snapshot.daysPerUnit
  const eacT = pd / spiT
  const delayDays = Math.round((eacT - pd) * dpu)
  const finishDate = addDays(finish, delayDays)
  const asOf = snapshot.asOf
  const bac = curve[curve.length - 1]!.cumulativePV

  const sample = Array.from(new Set([asOf, ...dates.filter((d) => d > asOf && d < finishDate), finishDate])).sort()
  const points = sample.map((date) => {
    if (date === finishDate) return { date, earned: bac }
    const esAt = Math.min(pd, es + (daysBetween(asOf, date) / dpu) * spiT)
    return { date, earned: date === asOf ? ev : pvAtPeriod(curve, esAt) }
  })

  return {
    status: 'ok',
    asOf,
    baselineFinish: finish,
    finishDate,
    delayDays,
    spiT,
    eacT,
    plannedDuration: pd,
    earnedSchedule: es,
    periodUnit: snapshot.periodUnit,
    daysPerUnit: dpu,
    points,
  }
}
