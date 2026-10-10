import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProjectEvm } from '@/features/evm/lib/load-project-evm'
import { buildLiveWorkshopCostModel } from '@/features/finance/lib/live-workshop-cost'
import { loadLiveCostInputs } from '@/features/finance/lib/load-live-cost-inputs'
import { buildControlsSnapshot } from '@/features/project-controls/lib/controls-snapshot'
import { DAYS_PER_UNIT } from '@/features/project-controls/lib/earned-schedule'
import { buildEarnedScheduleKpis } from '@/features/project-controls/lib/kpis'
import { fetchProgressHistory } from '@/features/schedule/lib/progress-history'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { getLatestProgressForActivity } from '@/features/supervisor/lib/daily-report-activities'
import { jalaliDate } from './format'
import { loadScheduleCommitments } from './load-schedule-commitments'
import { loadWeeklyCommitments } from './load-weekly-commitments'
import type { WeeklyCommitmentsResult } from './weekly-commitments'
import {
  ESTIMATE_CURRENCY,
  EMPTY_ESTIMATE,
  buildBac,
  buildEstimateAlerts,
  computeManagerEvm,
  estimateFromRow,
  estimateIssues,
  estimateStatus,
  estimateTargets,
  plannedDurationDays,
  sumUnique,
  wbsDirectCost,
  type ActualCostModel,
  type BacModel,
  type CostEstimateRecord,
  type CostEstimateSettings,
  type EstimateAlert,
  type EstimateIssue,
  type EstimateStatus,
  type EstimateTargets,
  type IndexValue,
  type ManagerEvm,
  type PpcSignal,
  type ProgressCompareRow,
  type WbsBudgetRow,
  type WbsDirectCost,
} from './cost-estimate'
import { buildEstimateTraces, progressRowsFromSnapshot } from './manager-traces'
import type { CalcTraceMap } from '@/features/calc-trace/lib/types'

export interface ScheduleForecast {
  spiT: IndexValue
  /** Planned duration (PD) of the baseline curve, in months. */
  plannedDurationMonths: IndexValue
  /** EAC(t) = PD ÷ SPI(t), in months. */
  eacMonths: IndexValue
  delayDays: IndexValue
  baselineStart: string | null
  baselineFinish: string | null
  forecastFinish: string | null
  basis: string
}

export interface CostEstimateOverview {
  projectId: string
  today: string
  currency: string
  canEdit: boolean
  /** Migration 106 has not been run yet. */
  tableMissing: boolean
  project: { name: string; startDate: string | null; endDate: string | null }
  record: CostEstimateRecord | null
  /** The saved settings, or empty ones with the project dates suggested. */
  settings: CostEstimateSettings
  status: EstimateStatus
  issues: EstimateIssue[]
  direct: WbsDirectCost
  bac: BacModel
  /** Target profit, margin and burn rate of the estimate. */
  targets: EstimateTargets
  durationDays: number | null
  actual: ActualCostModel
  progress: { plannedPercent: number | null; earnedPercent: number | null }
  evm: ManagerEvm
  schedule: ScheduleForecast
  ppc: PpcSignal | null
  alerts: EstimateAlert[]
  /** Calculation ledger; present only for system admins. */
  traces?: CalcTraceMap
}

type Row = Record<string, unknown>

function isMissingRelation(message: string | undefined): boolean {
  return /does not exist|schema cache|Could not find/i.test(message ?? '')
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

/** Baseline PV curve as cumulative percent of its final value. */
function pvPercents(points: { cumulativePV: number }[]): number[] {
  const total = points.at(-1)?.cumulativePV ?? 0
  return total > 0 ? points.map((p) => (p.cumulativePV / total) * 100) : []
}

function ppcSignal(result: WeeklyCommitmentsResult | null): PpcSignal | null {
  if (!result || result.status !== 'ok') return null
  const week = result.data.weeks.filter((w) => !w.live).at(-1)
  if (!week || week.ppc == null) return null
  const missed = Math.max(0, week.planned - week.completed)
  return {
    ppc: week.ppc,
    weekLabel: `هفتهٔ ${jalaliDate(week.start)} تا ${jalaliDate(week.end)}`,
    missed,
    // Weekly work plans cannot close with a missed commitment that has no reason (DB constraint).
    missedWithoutReason: result.data.source === 'schedule' ? missed : 0,
    source: result.data.source,
  }
}

async function loadPpc(supabase: SupabaseClient, service: SupabaseClient, projectId: string): Promise<WeeklyCommitmentsResult | null> {
  try {
    const wwp = await loadWeeklyCommitments(service, projectId)
    if (wwp.status === 'ok') return wwp
  } catch {
    /* weekly work plans optional */
  }
  try {
    return await loadScheduleCommitments(supabase, service, projectId)
  } catch {
    return null
  }
}

/** `service` must be a service-role client; the caller has already checked manager access. */
export async function loadCostEstimateOverview(
  supabase: SupabaseClient,
  service: SupabaseClient,
  projectId: string,
  today: string,
  canEdit: boolean,
  withTraces = false
): Promise<CostEstimateOverview> {
  const [estimateRes, projectRes, inputs, snapshot, entries, ppcResult] = await Promise.all([
    service.from('project_cost_estimates').select('*').eq('project_id', projectId).maybeSingle(),
    service.from('projects').select('name, start_date, end_date').eq('id', projectId).maybeSingle(),
    loadLiveCostInputs(service, projectId, today),
    loadProjectEvm(service, projectId, { asOf: today, today }),
    fetchProgressHistory(service, projectId).catch(() => []),
    loadPpc(supabase, service, projectId),
  ])
  const ppc = ppcSignal(ppcResult)

  let tableMissing = false
  if (estimateRes.error) {
    if (!isMissingRelation(estimateRes.error.message)) throw new Error(estimateRes.error.message)
    tableMissing = true
  }
  const record = estimateRes.data ? estimateFromRow(estimateRes.data as Row) : null
  const project = {
    name: String(projectRes.data?.name ?? ''),
    startDate: toIsoDateOnly((projectRes.data?.start_date as string | null) ?? null),
    endDate: toIsoDateOnly((projectRes.data?.end_date as string | null) ?? null),
  }
  const settings: CostEstimateSettings = record
    ? record
    : { ...EMPTY_ESTIMATE, plannedStart: project.startDate, plannedFinish: project.endDate }

  /* WBS direct cost */
  const rows: WbsBudgetRow[] = inputs.evm.activities
    .map((a) => ({
      id: a.id,
      kind: a.kind,
      wbs: a.wbs,
      name: a.name,
      quantity: a.quantity,
      unitPrice: a.unitPrice,
      budget: a.budget,
      weight: a.weight,
    }))
    .sort((a, b) => compareWbs(a.wbs, b.wbs))
  const direct = wbsDirectCost(inputs.evm.basis, rows)
  const bac = buildBac(settings, direct)
  const issues = estimateIssues(settings, direct, bac)
  const status = estimateStatus(record, issues)

  /* AC — the same model as «هزینه تا این لحظه» */
  const live = buildLiveWorkshopCostModel({
    overheadMonths: inputs.months,
    activities: inputs.leafActivities,
    purchases: inputs.purchases.map((p) => ({ date: p.purchaseDate, amount: p.amount })),
    todayIso: today,
  })
  const purchases = sumUnique(
    inputs.purchases.filter((p) => (toIsoDateOnly(p.purchaseDate) ?? '') <= today).map((p) => ({ id: p.id, amount: p.amount }))
  )
  const bySource = (source: 'expense' | 'vendor_bill') => snapshot.costs.filter((c) => c.source === source)
  const expenses = bySource('expense')
  const bills = bySource('vendor_bill')
  const actual: ActualCostModel = {
    total: live.overhead + live.contractor + purchases.total,
    parts: [
      { key: 'overhead', label: 'بالاسری کارگاه', amount: live.overhead, source: 'ماه‌های بسته + برآورد ماه جاری (جدول بالاسری)' },
      { key: 'contractor', label: 'کارکرد پیمانکاران', amount: live.contractor, source: 'مقدار × قیمت واحد × پیشرفت فیزیکی' },
      { key: 'purchases', label: 'خرید کارفرمایی', amount: purchases.total, source: `${purchases.count} خرید تا امروز (هر خرید یک بار)` },
    ],
    excluded: [
      {
        label: 'اسناد هزینهٔ حسابداری',
        amount: expenses.reduce((s, c) => s + c.amount, 0),
        count: expenses.length,
        reason: 'با بالاسری و کارکرد پیمانکار هم‌پوشانی دارد؛ برای جلوگیری از دوباره‌شماری در AC جمع نمی‌شود',
      },
      {
        label: 'صورت‌حساب تأمین‌کنندگان',
        amount: bills.reduce((s, c) => s + c.amount, 0),
        count: bills.length,
        reason: 'ممکن است همان پرداخت به پیمانکار یا خرید باشد؛ در AC جمع نمی‌شود',
      },
    ],
  }

  /* EVM */
  const m = snapshot.metrics
  const hasProgress = m.activityCount > 0
  const evm = computeManagerEvm({
    bacBase: record ? bac.bacBase : null,
    bacTotal: record ? bac.bacTotal : null,
    contractValue: settings.contractValue,
    plannedPercent: hasProgress ? m.plannedPercent : null,
    earnedPercent: hasProgress ? m.earnedPercent : null,
    ac: actual.total,
  })

  /* Earned Schedule (existing engine, monthly periods) */
  const controls = buildControlsSnapshot({ evm: snapshot, periodUnit: 'months' })
  const es = buildEarnedScheduleKpis(controls)
  const kpi = (k: { value: number | null; reason_fa?: string }): IndexValue =>
    k.value == null ? { value: null, reason: k.reason_fa ?? 'داده کافی نیست' } : { value: k.value }
  const eacMonths = kpi(es.eac_t)
  const delay = kpi(es.delay_forecast)
  const baselineStart = controls.projectStart.value
  const schedule: ScheduleForecast = {
    spiT: kpi(es.spi_t),
    plannedDurationMonths:
      controls.plannedDuration.value == null
        ? { value: null, reason: controls.plannedDuration.reason_fa ?? 'داده کافی نیست' }
        : { value: controls.plannedDuration.value },
    eacMonths,
    delayDays: delay,
    baselineStart,
    baselineFinish: controls.baselineFinish.value,
    forecastFinish:
      baselineStart && eacMonths.value != null ? addDays(baselineStart, eacMonths.value * DAYS_PER_UNIT.months) : null,
    basis:
      'PD از منحنی PV مبنا (کمترین شروع تا بیشترین پایان baseline فعالیت‌ها، به ماه 30.44 روزه)؛ ES با درون‌یابی EV روی همان منحنی؛ SPI(t) = ES ÷ AT؛ EAC(t) = PD ÷ SPI(t).',
  }

  /* Manager vs supervisor progress */
  const progress: ProgressCompareRow[] = snapshot.activities
    .filter((a) => a.weight > 0)
    .map((a) => {
      const latest = getLatestProgressForActivity(a.id, entries)
      return {
        id: a.id,
        name: a.name,
        wbs: a.wbs,
        stored: a.physicalPercent,
        supervisor: latest ? latest.percentComplete : null,
        supervisorDate: latest ? latest.reportDate : null,
        plannedPercent: a.plannedPercent,
        started: Boolean(a.baselineStart && a.baselineStart <= today),
      }
    })

  const alerts = buildEstimateAlerts({
    status,
    issues,
    evm,
    monthlyOverhead: settings.overheadInWbs ? null : settings.monthlyOverhead,
    delayDays: delay.value,
    progress,
    direct,
    ppc,
  })

  const targets = estimateTargets(settings, bac)
  const progressPercents = {
    plannedPercent: hasProgress ? m.plannedPercent : null,
    earnedPercent: hasProgress ? m.earnedPercent : null,
  }

  let traces: CalcTraceMap | undefined
  if (withTraces) {
    const ppcData = ppcResult?.status === 'ok' ? ppcResult.data : null
    traces = buildEstimateTraces({
      settings,
      hasRecord: record != null,
      directBasis: direct.basis,
      bac,
      targets,
      actual,
      evm,
      progress: progressPercents,
      schedule,
      plannedPvPoints: pvPercents(controls.pvCurve.value ?? []),
      ppcWeek: ppcData?.weeks.filter((w) => !w.live).at(-1) ?? null,
      ppcSource: ppcData?.source ?? 'schedule',
      progressRows: progressRowsFromSnapshot(snapshot, (id) => {
        const latest = getLatestProgressForActivity(id, entries)
        return latest ? { percent: latest.percentComplete, date: latest.reportDate } : null
      }),
    })
  }

  return {
    projectId,
    today,
    currency: ESTIMATE_CURRENCY,
    canEdit: canEdit && !tableMissing,
    tableMissing,
    project,
    record,
    settings,
    status,
    issues,
    direct,
    bac,
    targets,
    durationDays: plannedDurationDays(settings.plannedStart, settings.plannedFinish),
    actual,
    progress: progressPercents,
    evm,
    schedule,
    ppc,
    alerts,
    ...(traces ? { traces } : {}),
  }
}
