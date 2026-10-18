/**
 * @file features/manager/lib/load-manager-overview.ts
 * @purpose منطق دامنه — داشبورد مدیر پروژه و KPI (load-manager-overview)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on features/evm/lib/load-project-evm, features/schedule/lib/schedule-alerts-api, features/schedule/lib/float-alerts, features/attendance/lib/service, features/attendance/lib/types, shared/lib/i18n/position-labels, features/manager/lib/format, features/manager/lib/pulse-config, features/manager/lib/period-comparison, features/manager/lib/progress-curve
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProjectEvm, type ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'
import { listActiveScheduleAlerts } from '@/features/schedule/lib/schedule-alerts-api'
import type { ScheduleAlertSeverity } from '@/features/schedule/lib/float-alerts'
import { getAttendanceDashboard } from '@/features/attendance/lib/service'
import type { AttendanceDashboardSnapshot } from '@/features/attendance/lib/types'
import { POSITION_LABELS } from '@/shared/lib/i18n/position-labels'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import { MANAGER_REMINDER_PREFIX, PULSE_ROLES } from '@/features/manager/lib/pulse-config'
import { tehranDateIso } from '@/features/manager/lib/period-comparison'
import {
actualPercentOf,
buildProgressCurve,
scheduleForecast,
type ProgressRecordRow,
type ProgressSnapshotRow,
} from '@/features/manager/lib/progress-curve'
import { buildControlsSnapshot } from '@/features/project-controls/lib/controls-snapshot'
import { buildEvForecast } from '@/features/project-controls/lib/ev-forecast'
import { buildEarnedScheduleKpis } from '@/features/project-controls/lib/kpis'
import { buildCriticalFronts, type BuildCriticalFrontsInput, type CriticalFrontCauseInput } from '@/features/manager/lib/critical-fronts'
import {
buildBlockers,
buildDailyDelta,
buildUpcomingDeadlines,
type BlockerInputs,
type DailyScheduleRow,
} from '@/features/manager/lib/daily-performance'
import { isLeafTask, taskBaselineDates } from '@/features/schedule/lib/leaf-activities'
import { normalizeScheduleWeightPercent } from '@/features/schedule/lib/weighted-progress'
import type { CalcTraceMap } from '@/features/calc-trace/lib/types'
import { buildHomeTraces, latestRecordByActivity, progressRowsFromSnapshot } from '@/features/manager/lib/manager-traces'
import type {
ManagerAlert,
ManagerBlockers,
ManagerCriticalDelays,
ManagerUpcomingDeadline,
ManagerDailyDelta,
ManagerCurve,
ManagerDecisionItem,
ManagerEvmSummary,
ManagerHse,
ManagerInvoiceSummary,
ManagerOverview,
ManagerPulseKey,
ManagerPulsePerson,
ManagerPulseSource,
ManagerQuality,
ManagerResources,
SectionResult,
} from '@/features/manager/lib/overview-types'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { getOverviewReasons, getOverviewScheduleGroups } from '@/features/manager/lib/i18n/overview-alerts'

type Row = Record<string, unknown>

function isMissingRelation(message: string | undefined): boolean {
  return /does not exist|schema cache|Could not find|Invalid schema/i.test(message ?? '')
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const DAY_MS = 86_400_000
const HSE_WINDOW_DAYS = 30

let activeReasons = getOverviewReasons('fa')

async function section<T>(
  run: () => Promise<SectionResult<T>>,
  fallback: string
): Promise<SectionResult<T>> {
  try {
    return await run()
  } catch (error) {
    const message = errorMessage(error, fallback)
    if (isMissingRelation(message)) return { status: 'unavailable', reason: activeReasons.notBuilt }
    return { status: 'error', message }
  }
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function str(value: unknown): string | null {
  return value == null || value === '' ? null : String(value)
}

/* ----------------------------------------------------------- Alert copy */


function sortAlerts(alerts: ManagerAlert[]): ManagerAlert[] {
  return alerts.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'critical' ? -1 : 1
    if (a.items.length !== b.items.length) return b.items.length - a.items.length
    return (b.occurredAt ?? '9999').localeCompare(a.occurredAt ?? '9999')
  })
}

/* ------------------------------------------------------------ Positions */

const WORKER_POSITIONS = new Set(['worker', 'foreman', 'contractor', 'subcontractor'])
const NON_STAFF_POSITIONS = new Set(['visitor', 'security'])

interface MemberRow {
  userId: string
  name: string
  email: string | null
  positions: string[]
}

function positionLabel(key: string, locale: FormLocale): string {
  const entry = POSITION_LABELS[key]
  if (!entry) return key
  if (locale === 'en' || locale === 'de') return entry.en ?? entry.fa ?? key
  return entry.fa ?? key
}

/* ---------------------------------------------------------------- Loader */

export async function loadManagerOverview(
  supabase: SupabaseClient,
  service: SupabaseClient,
  projectId: string,
  today: string,
  options: { withTraces?: boolean; locale?: FormLocale } = {}
): Promise<ManagerOverview> {
  const locale = options.locale ?? 'fa'
  activeReasons = getOverviewReasons(locale)
  const SCHEDULE_GROUPS = getOverviewScheduleGroups(locale)
  const R = activeReasons
  const now = Date.now()

  const projectPromise = service
    .from('projects')
    .select('id, name, code, location, start_date, end_date')
    .eq('id', projectId)
    .maybeSingle()

  const evmSnapshotPromise = loadProjectEvm(service, projectId, { asOf: today, today, locale }).then(
    (snapshot) => ({ ok: true as const, snapshot }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error, R.evmLoadFailed) })
  )

  const decisionsPromise = section(async () => {
    const { data, error, count } = await service
      .from('workshop_packages')
      .select('id, name, location, crew, approval_status, updated_at', { count: 'exact' })
      .eq('project_id', projectId)
      .in('approval_status', ['pending_approval', 'change_requested'])
      .order('updated_at', { ascending: false })
      .limit(5)
    if (error) throw new Error(error.message)
    const items: ManagerDecisionItem[] = ((data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      kind: row.approval_status === 'change_requested' ? 'change_request' : 'package_approval',
      title: String(row.name ?? R.unnamedPackage),
      subtitle: [str(row.location), str(row.crew)].filter(Boolean).join(' · ') || null,
      updatedAt: str(row.updated_at),
    }))
    return { status: 'ok' as const, data: { items, total: count ?? items.length } }
  }, R.inboxLoadFailed)

  const scheduleAlertsPromise = listActiveScheduleAlerts(supabase, projectId).then(
    (alerts) => ({ ok: true as const, alerts }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error, R.genericError) })
  )

  const attendancePromise = getAttendanceDashboard(supabase, projectId).then(
    (snapshot) => ({ ok: true as const, snapshot }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error, R.attendanceLoadFailed) })
  )

  const inventoryPromise = service
    .from('inventory_items')
    .select('id, name, current_stock, min_stock, unit, last_updated_at')
    .eq('project_id', projectId)

  const qualityPromise = section<{ rows: Row[]; source: ManagerQuality['source'] }>(async () => {
    const engine = await service
      .schema('qc_engine')
      .from('ncr')
      .select('id, ncr_number, severity, status, created_at')
      .eq('project_id', projectId)
      .not('status', 'in', '("closed","waived")')
    if (!engine.error) return { status: 'ok', data: { rows: (engine.data ?? []) as Row[], source: 'qc_engine' } }
    if (!isMissingRelation(engine.error.message)) throw new Error(engine.error.message)
    const legacy = await service
      .from('qc_ncrs')
      .select('id, severity, status, created_at')
      .eq('project_id', projectId)
      .in('status', ['open', 'draft_by_ai'])
    if (legacy.error) throw new Error(legacy.error.message)
    return { status: 'ok', data: { rows: (legacy.data ?? []) as Row[], source: 'legacy' } }
  }, R.ncrLoadFailed)

  const hsePromise = section<ManagerHse>(async () => {
    const { data, error } = await service
      .from('ai_actions')
      .select('payload, created_at')
      .eq('project_id', projectId)
      .eq('type', 'hse_alert')
      .eq('status', 'confirmed_by_user')
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Row[]
    if (rows.length === 0) {
      return { status: 'unavailable', reason: R.hseMissing }
    }
    const windowStart = new Date(now - HSE_WINDOW_DAYS * DAY_MS).toISOString()
    const summary: ManagerHse = {
      windowDays: HSE_WINDOW_DAYS,
      critical: 0,
      warning: 0,
      info: 0,
      totalEver: rows.length,
      lastAlertAt: null,
      lastSeriousAt: null,
      daysSinceSerious: null,
    }
    for (const row of rows) {
      const at = str(row.created_at)
      const severity = String((row.payload as Row | null)?.severity ?? 'warning')
      const level = severity === 'critical' || severity === 'info' ? severity : 'warning'
      if (at && (!summary.lastAlertAt || at > summary.lastAlertAt)) summary.lastAlertAt = at
      if (level !== 'info' && at && (!summary.lastSeriousAt || at > summary.lastSeriousAt)) summary.lastSeriousAt = at
      if (at && at >= windowStart) summary[level] += 1
    }
    if (summary.lastSeriousAt) {
      summary.daysSinceSerious = Math.max(0, Math.floor((now - Date.parse(summary.lastSeriousAt)) / DAY_MS))
    }
    return { status: 'ok', data: summary }
  }, R.hseLoadFailed)

  const dailyReportPromise = service
    .from('daily_reports')
    .select('report_date, created_at, approved_by_manager')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)

  const lastTransitPromise = service
    .from('attendance_transits')
    .select('occurred_at')
    .eq('project_id', projectId)
    .order('occurred_at', { ascending: false })
    .limit(1)

  const gatesPromise = service
    .from('attendance_gates')
    .select('id, is_active')
    .eq('project_id', projectId)

  const membersPromise = service
    .from('v_project_members_with_positions')
    .select('user_id, full_name, email, contact_email, positions')
    .eq('project_id', projectId)
    .eq('is_active', true)

  const remindersPromise = service
    .from('app_notifications')
    .select('related_entity_type, created_at')
    .eq('project_id', projectId)
    .like('related_entity_type', `${MANAGER_REMINDER_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(40)

  const invoicesPromise = section<ManagerInvoiceSummary>(async () => {
    const { data, error } = await service
      .from('financial_invoices')
      .select('status, total_amount, approved_amount, paid_amount, invoice_date')
      .eq('project_id', projectId)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Row[]
    if (rows.length === 0) {
      return { status: 'unavailable', reason: R.invoicesMissing }
    }
    const summary: ManagerInvoiceSummary = {
      count: rows.length,
      totalInvoiced: 0,
      totalPaid: 0,
      pendingCount: 0,
      pendingAmount: 0,
      approvedUnpaidCount: 0,
      approvedUnpaidAmount: 0,
      lastInvoiceDate: null,
    }
    for (const row of rows) {
      const status = String(row.status ?? '')
      if (status === 'draft') continue
      const total = num(row.total_amount) ?? 0
      const approved = num(row.approved_amount) ?? 0
      const paid = num(row.paid_amount) ?? 0
      summary.totalInvoiced += total
      summary.totalPaid += paid
      if (status === 'submitted' || status === 'under_review') {
        summary.pendingCount += 1
        summary.pendingAmount += Math.max(0, total - approved)
      }
      if (status === 'approved') {
        const open = Math.max(0, (approved > 0 ? approved : total) - paid)
        if (open > 0) {
          summary.approvedUnpaidCount += 1
          summary.approvedUnpaidAmount += open
        }
      }
      const date = str(row.invoice_date)
      if (date && (!summary.lastInvoiceDate || date > summary.lastInvoiceDate)) summary.lastInvoiceDate = date
    }
    return { status: 'ok', data: summary }
  }, R.invoicesLoadFailed)

  const snapshotsPromise = service
    .from('progress_snapshots')
    .select('activity_id, snapshot_month, cumulative_percent')
    .eq('project_id', projectId)

  const progressUpdatesPromise = service
    .from('task_progress_updates')
    .select('task_id, percent_complete, progress_date, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(20000)

  const packageUpdatesPromise = service
    .from('package_progress_updates')
    .select('package_id, percent_complete, progress_date, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(20000)

  const tasksPromise = service.from('project_tasks').select('*').eq('project_id', projectId)

  const dependenciesPromise = service
    .from('task_dependencies')
    .select('predecessor_task_id, successor_task_id')
    .eq('project_id', projectId)

  const cpmRunPromise = service
    .from('schedule_calculations')
    .select('calculated_at')
    .eq('project_id', projectId)
    .order('calculated_at', { ascending: false })
    .limit(1)

  const packageLinksPromise = service
    .from('workshop_packages')
    .select('id, project_task_id, parent_package_id')
    .eq('project_id', projectId)

  const subcontractorsPromise = service.from('project_subcontractors').select('id, name').eq('project_id', projectId)

  const sitePlanPromise = section<{
    blocked: BlockerInputs['blockedWorkOrders']
    notes: BlockerInputs['constraintNotes']
  }>(async () => {
    const plan = await service
      .from('site_ops_daily_plans')
      .select('id, plan_date')
      .eq('project_id', projectId)
      .eq('plan_date', today)
      .maybeSingle()
    if (plan.error) throw new Error(plan.error.message)
    if (!plan.data) return { status: 'ok', data: { blocked: [], notes: [] } }
    const planRow = plan.data as Row
    const [orders, logs] = await Promise.all([
      service
        .from('site_ops_work_orders')
        .select('id, constraints, site_ops_operational_tasks(name, wbs)')
        .eq('daily_plan_id', String(planRow.id))
        .eq('status', 'BLOCKED'),
      service
        .from('site_ops_constraint_logs')
        .select('id, note, created_at')
        .eq('daily_plan_id', String(planRow.id))
        .is('work_order_id', null),
    ])
    if (orders.error) throw new Error(orders.error.message)
    if (logs.error) throw new Error(logs.error.message)
    return {
      status: 'ok',
      data: {
        blocked: ((orders.data ?? []) as Row[]).map((row) => {
          const task = row.site_ops_operational_tasks as Row | Row[] | null
          const op = Array.isArray(task) ? task[0] : task
          return {
            id: String(row.id),
            taskName: String(op?.name ?? R.unnamedWorkOrder),
            wbs: str(op?.wbs)?.trim() || null,
            constraints: Array.isArray(row.constraints) ? (row.constraints as unknown[]).map(String) : [],
            planDate: String(planRow.plan_date),
          }
        }),
        notes: ((logs.data ?? []) as Row[]).map((row) => ({
          id: String(row.id),
          note: String(row.note ?? ''),
          createdAt: String(row.created_at),
        })),
      },
    }
  }, R.sitePlanLoadFailed)

  const openAlertsPromise = service
    .from('alerts')
    .select('id, alert_type, severity, message, related_task_id, created_at')
    .eq('project_id', projectId)
    .eq('is_resolved', false)
    .in('severity', ['critical', 'warning'])
    .in('alert_type', ['delay_risk', 'material_purchase', 'milestone_risk', 'critical_path'])
    .order('created_at', { ascending: true })
    .limit(20)

  const [
    projectRes,
    evmRes,
    decisions,
    scheduleAlerts,
    attendanceRes,
    inventoryRes,
    quality,
    hse,
    dailyReportRes,
    lastTransitRes,
    gatesRes,
    membersRes,
    remindersRes,
    invoices,
    snapshotsRes,
    progressUpdatesRes,
    packageUpdatesRes,
    tasksRes,
    sitePlan,
    openAlertsRes,
    dependenciesRes,
    cpmRunRes,
    packageLinksRes,
    subcontractorsRes,
  ] = await Promise.all([
    projectPromise,
    evmSnapshotPromise,
    decisionsPromise,
    scheduleAlertsPromise,
    attendancePromise,
    inventoryPromise,
    qualityPromise,
    hsePromise,
    dailyReportPromise,
    lastTransitPromise,
    gatesPromise,
    membersPromise,
    remindersPromise,
    invoicesPromise,
    snapshotsPromise,
    progressUpdatesPromise,
    packageUpdatesPromise,
    tasksPromise,
    sitePlanPromise,
    openAlertsPromise,
    dependenciesPromise,
    cpmRunPromise,
    packageLinksPromise,
    subcontractorsPromise,
  ])

  /* ------------------------------------------------------------- EVM */

  let evmSnapshot: ProjectEvmSnapshot | null = null
  let evm: SectionResult<ManagerEvmSummary>
  if (evmRes.ok) {
    evmSnapshot = evmRes.snapshot
    const m = evmSnapshot.metrics
    const actualPercent = actualPercentOf(evmSnapshot.activities, (a) => a.physicalPercent)
    const forecast = scheduleForecast(evmSnapshot.activities, m.earnedPercent, today)
    evm = {
      status: 'ok',
      data: {
        asOf: m.asOf,
        spi: m.spi,
        cpi: m.cpi,
        plannedPercent: m.plannedPercent,
        earnedPercent: m.earnedPercent,
        actualPercent,
        bac: m.bac,
        pv: m.pv,
        ev: m.ev,
        evAmount: m.evAmount,
        ac: m.ac,
        sv: m.sv,
        cv: m.cv,
        activityCount: m.activityCount,
        budgetBasis: m.budgetBasis,
        progressBasis: m.progressBasis,
        criticalFloatDays: evmSnapshot.float.criticalFloatDays,
        floatConsumptionPercent: evmSnapshot.float.floatConsumptionPercent,
        scheduleVarianceDays: forecast?.varianceDays ?? null,
        scheduleForecast: forecast,
        rag: evmSnapshot.rag,
      },
    }
  } else {
    const message = 'message' in evmRes ? evmRes.message : R.genericError
    evm = isMissingRelation(message) ? { status: 'unavailable', reason: activeReasons.notBuilt } : { status: 'error', message }
  }

  /* ----------------------------------------------------------- Curve */

  let progress: SectionResult<ManagerCurve>
  const records: ProgressRecordRow[] = []
  if (!evmSnapshot || evm.status !== 'ok') {
    progress = evm.status === 'ok' ? { status: 'unavailable', reason: R.progressUnavailable } : evm
  } else {
    const snapshots: ProgressSnapshotRow[] = snapshotsRes.error
      ? []
      : ((snapshotsRes.data ?? []) as Row[]).map((row) => ({
          activityId: String(row.activity_id),
          snapshotMonth: String(row.snapshot_month).slice(0, 10),
          cumulativePercent: num(row.cumulative_percent) ?? 0,
        }))
    const pushRecord = (id: unknown, percent: unknown, date: unknown, at: unknown) => {
      const pct = num(percent)
      const created = str(at)
      const day = str(date)?.slice(0, 10) ?? (created ? tehranDateIso(Date.parse(created)) : null)
      if (id == null || pct == null || !created || !day) return
      records.push({ activityId: String(id), date: day, at: created, percent: pct })
    }
    if (!progressUpdatesRes.error) {
      for (const row of (progressUpdatesRes.data ?? []) as Row[]) pushRecord(row.task_id, row.percent_complete, row.progress_date, row.created_at)
    }
    if (!packageUpdatesRes.error) {
      for (const row of (packageUpdatesRes.data ?? []) as Row[]) pushRecord(row.package_id, row.percent_complete, row.progress_date, row.created_at)
    }
    const curve = buildProgressCurve({
      activities: evmSnapshot.activities,
      budgetBasis: evm.data.budgetBasis,
      earnedPercent: evm.data.earnedPercent,
      actualPercent: evm.data.actualPercent,
      today,
      locale,
      snapshots,
      records,
      forecast: (dates) => {
        const controls = buildControlsSnapshot({ evm: evmSnapshot!, periodUnit: 'months' })
        return buildEvForecast(controls, buildEarnedScheduleKpis(controls), dates)
      },
    })
    progress = curve
      ? { status: 'ok', data: curve }
      : {
          status: 'unavailable',
          reason: R.curveNeedsBaseline,
        }
  }

  /* --------------------------------------------------------- Members */

  const members: MemberRow[] = membersRes.error
    ? []
    : ((membersRes.data ?? []) as Row[]).map((row) => ({
        userId: String(row.user_id),
        name: String(row.full_name || row.email || R.unnamedPerson),
        email: str(row.contact_email) ?? str(row.email),
        positions: ((row.positions as Array<{ key?: string; is_active?: boolean }> | null) ?? [])
          .filter((p) => p.key && p.is_active !== false)
          .map((p) => String(p.key)),
      }))

  const membersWith = (keys: string[]): MemberRow[] => {
    for (const key of keys) {
      const found = members.filter((m) => m.positions.includes(key))
      if (found.length) return found
    }
    return []
  }

  /* -------------------------------------------------------- Site today */

  const attendance: ManagerOverview['site']['attendance'] = attendanceRes.ok
    ? {
        status: 'ok',
        data: {
          insideCount: attendanceRes.snapshot.kpis.insideCount,
          outsideCount: attendanceRes.snapshot.kpis.outsideCount,
          absentCount: attendanceRes.snapshot.kpis.absentCount,
          failedCountToday: attendanceRes.snapshot.kpis.failedCountToday,
        },
      }
    : 'message' in attendanceRes && isMissingRelation(attendanceRes.message)
      ? { status: 'unavailable', reason: activeReasons.notBuilt }
      : { status: 'error', message: 'message' in attendanceRes ? attendanceRes.message : R.genericError }

  const inventoryRows = inventoryRes.error ? [] : ((inventoryRes.data ?? []) as Row[])
  const inventory: ManagerOverview['site']['inventory'] = inventoryRes.error
    ? isMissingRelation(inventoryRes.error.message)
      ? { status: 'unavailable', reason: activeReasons.notBuilt }
      : { status: 'error', message: inventoryRes.error.message }
    : inventoryRows.length === 0
      ? { status: 'unavailable', reason: R.inventoryMissing }
      : {
          status: 'ok',
          data: {
            trackedCount: inventoryRows.length,
            lowStock: inventoryRows
              .map((row) => ({
                id: String(row.id),
                name: String(row.name ?? ''),
                current: num(row.current_stock) ?? 0,
                min: num(row.min_stock) ?? 0,
                unit: str(row.unit),
              }))
              .filter((item) => item.min > 0 && item.current <= item.min)
              .sort((a, b) => a.current / a.min - b.current / b.min),
          },
        }

  const qualitySummary: SectionResult<ManagerQuality> =
    quality.status === 'ok'
      ? {
          status: 'ok',
          data: {
            openNcrCount: quality.data.rows.length,
            criticalNcrCount: quality.data.rows.filter((r) => r.severity === 'critical').length,
            source: quality.data.source,
          },
        }
      : quality

  /* ---------------------------------------------------------- Alerts */

  const alerts: ManagerAlert[] = []

  if (scheduleAlerts.ok) {
    for (const group of SCHEDULE_GROUPS) {
      const rows = scheduleAlerts.alerts
        .filter((a) => group.severities.includes(a.severity))
        .sort((a, b) => (a.totalFloat ?? 0) - (b.totalFloat ?? 0))
      if (rows.length === 0) continue
      const seen = new Set<string>()
      const items = rows
        .filter((r) => {
          const key = r.activityId || r.id
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map((r) => ({ label: r.activityName?.trim() || R.unnamedActivity, occurredAt: r.createdAt }))
      alerts.push({
        id: `schedule-${group.severities[0]}`,
        level: group.level,
        domain: 'schedule',
        title: group.title,
        cause: group.cause,
        impact: group.impact,
        suggestion: group.suggestion,
        occurredAt: items.reduce<string | null>((m, i) => (i.occurredAt && (!m || i.occurredAt > m) ? i.occurredAt : m), null),
        eventBased: true,
        items,
      })
    }
  }

  if (evm.status === 'ok') {
    for (const reason of evm.data.rag.reasons) {
      const isCost = reason.code.startsWith('CPI')
      const isFloat = reason.code.includes('FLOAT')
      if (isFloat && scheduleAlerts.ok) continue
      alerts.push({
        id: `evm-${reason.code}`,
        level: reason.level === 'RED' ? 'critical' : 'warning',
        domain: isCost ? 'cost' : 'schedule',
        title: isCost
          ? R.costOverEarned
          : isFloat
            ? R.criticalFloatBurn
            : R.overallBehind,
        cause: reason.messageFa,
        impact: isCost ? R.costOverBudgetTrend : R.scheduleSlipTrend,
        suggestion: isCost ? R.costSuggestion : R.scheduleSuggestion,
        occurredAt: null,
        eventBased: false,
        items: [],
      })
    }
  }

  if (inventory.status === 'ok' && inventory.data.lowStock.length > 0) {
    const empty = inventory.data.lowStock.filter((i) => i.current <= 0)
    const low = inventory.data.lowStock.filter((i) => i.current > 0)
    if (empty.length) {
      alerts.push({
        id: 'stock-empty',
        level: 'critical',
        domain: 'materials',
        title: R.stockEmptyTitle,
        cause: R.stockEmptyCause,
        impact: R.stockEmptyImpact,
        suggestion: R.stockEmptySuggestion,
        occurredAt: null,
        eventBased: false,
        items: empty.map((i) => ({ label: i.name, occurredAt: null })),
      })
    }
    if (low.length) {
      alerts.push({
        id: 'stock-low',
        level: 'warning',
        domain: 'materials',
        title: R.stockLowTitle,
        cause: R.stockLowCause,
        impact: R.stockLowImpact,
        suggestion: R.stockLowSuggestion,
        occurredAt: null,
        eventBased: false,
        items: low.map((i) => ({
          label: R.stockLowItem(i.name, faNumber(i.current), faNumber(i.min)),
          occurredAt: null,
        })),
      })
    }
  }

  if (quality.status === 'ok') {
    const critical = quality.data.rows.filter((r) => r.severity === 'critical')
    if (critical.length) {
      alerts.push({
        id: 'ncr-critical',
        level: 'critical',
        domain: 'quality',
        title: R.ncrCriticalTitle,
        cause: R.ncrCriticalCause,
        impact: R.ncrCriticalImpact,
        suggestion: R.ncrCriticalSuggestion,
        occurredAt: str(critical[0].created_at),
        eventBased: true,
        items: critical.map((r) => ({
          label: str(r.ncr_number) ? `NCR ${String(r.ncr_number)}` : R.ncrUnnumbered,
          occurredAt: str(r.created_at),
        })),
      })
    }
  }

  sortAlerts(alerts)

  /* ----------------------------------------------------------- Pulse */

  const reminders = new Map<string, string>()
  if (!remindersRes.error) {
    for (const row of (remindersRes.data ?? []) as Row[]) {
      const key = String(row.related_entity_type ?? '').slice(MANAGER_REMINDER_PREFIX.length)
      if (!reminders.has(key) && row.created_at) reminders.set(key, String(row.created_at))
    }
  }

  const responsibleIds = new Set<string>()
  const pulseRoles = PULSE_ROLES
  const responsibleByKey = new Map<ManagerPulseKey, MemberRow[]>()
  for (const key of Object.keys(pulseRoles) as ManagerPulseKey[]) {
    const found = membersWith(pulseRoles[key]).slice(0, 3)
    responsibleByKey.set(key, found)
    for (const m of found) responsibleIds.add(m.userId)
  }

  const signIns = new Map<string, string | null>()
  await Promise.all(
    [...responsibleIds].map(async (id) => {
      try {
        const { data } = await service.auth.admin.getUserById(id)
        signIns.set(id, data.user?.last_sign_in_at ?? null)
      } catch {
        signIns.set(id, null)
      }
    })
  )

  const buildPulse = (input: {
    key: ManagerPulseKey
    label: string
    thresholdHours: number
    lastActivityAt: string | null
    detail: string | null
    unavailableReason?: string | null
    neverReason?: string
  }): ManagerPulseSource => {
    const people = responsibleByKey.get(input.key) ?? []
    const responsible: ManagerPulsePerson[] = people.map((m) => ({
      userId: m.userId,
      name: m.name,
      lastSignInAt: signIns.get(m.userId) ?? null,
    }))
    const roleKey = people[0]?.positions.find((p) => pulseRoles[input.key].includes(p)) ?? pulseRoles[input.key][0]
    let status: ManagerPulseSource['status']
    let reason: string | null = null
    if (input.unavailableReason) {
      status = 'unavailable'
      reason = input.unavailableReason
    } else if (!input.lastActivityAt) {
      status = 'never'
      reason = input.neverReason ?? R.neverActivity
    } else {
      const ageHours = (now - new Date(input.lastActivityAt).getTime()) / 3_600_000
      status = ageHours > input.thresholdHours ? 'stale' : 'fresh'
    }
    if (!reason && responsible.length === 0) reason = R.noMemberWithRole(positionLabel(roleKey, locale))
    return {
      key: input.key,
      label: input.label,
      roleLabel: positionLabel(roleKey, locale),
      status,
      lastActivityAt: input.lastActivityAt,
      thresholdHours: input.thresholdHours,
      detail: input.detail,
      reason,
      responsible,
      lastReminderAt: reminders.get(input.key) ?? null,
      canRemind: (status === 'stale' || status === 'never') && responsible.length > 0,
    }
  }

  const pulseSources: ManagerPulseSource[] = []
  const dailyRow = dailyReportRes.error ? null : ((dailyReportRes.data ?? [])[0] as Row | undefined)
  pulseSources.push(
    buildPulse({
      key: 'daily_report',
      label: R.pulseDailyLabel,
      thresholdHours: 30,
      lastActivityAt: str(dailyRow?.created_at),
      detail: dailyRow
        ? R.pulseDailyDetail(jalaliDate(str(dailyRow.report_date)), Boolean(dailyRow.approved_by_manager))
        : null,
      unavailableReason: dailyReportRes.error ? dailyReportRes.error.message : null,
      neverReason: R.neverDaily,
    })
  )

  const lastInventoryUpdate = inventoryRows.reduce<string | null>((m, r) => {
    const v = str(r.last_updated_at)
    return v && (!m || v > m) ? v : m
  }, null)
  pulseSources.push(
    buildPulse({
      key: 'warehouse',
      label: R.pulseWarehouseLabel,
      thresholdHours: 48,
      lastActivityAt: lastInventoryUpdate,
      detail: inventoryRows.length ? R.pulseItemCount(faNumber(inventoryRows.length)) : null,
      unavailableReason: inventory.status === 'error' ? inventory.message : null,
      neverReason: R.neverWarehouse,
    })
  )

  pulseSources.push(
    buildPulse({
      key: 'hse',
      label: R.pulseHseLabel,
      thresholdHours: 24,
      lastActivityAt: null,
      detail: null,
      unavailableReason: R.hseDemo,
    })
  )

  const activeGates = gatesRes.error ? 0 : ((gatesRes.data ?? []) as Row[]).filter((g) => g.is_active !== false).length
  const lastTransit = lastTransitRes.error ? null : str(((lastTransitRes.data ?? [])[0] as Row | undefined)?.occurred_at)
  pulseSources.push(
    buildPulse({
      key: 'gate',
      label: R.pulseGateLabel,
      thresholdHours: 24,
      lastActivityAt: lastTransit,
      detail: gatesRes.error
        ? null
        : activeGates
          ? R.pulseGatesActive(faNumber(activeGates))
          : R.pulseNoGates,
      unavailableReason: lastTransitRes.error ? lastTransitRes.error.message : null,
      neverReason: R.neverGate,
    })
  )

  /* ------------------------------------------------------- Resources */

  let resources: SectionResult<ManagerResources>
  if (!attendanceRes.ok) {
    resources = attendance.status === 'ok' ? { status: 'error', message: R.genericError } : attendance
  } else {
    const snap: AttendanceDashboardSnapshot = attendanceRes.snapshot
    const present = [...snap.inside, ...snap.outsideToday]
    const positionsById = new Map(members.map((m) => [m.userId, m.positions]))
    let workers = 0
    let technical = 0
    let other = 0
    for (const person of present) {
      const keys = positionsById.get(person.userId) ?? []
      if (keys.some((k) => WORKER_POSITIONS.has(k))) workers += 1
      else if (keys.some((k) => !NON_STAFF_POSITIONS.has(k))) technical += 1
      else other += 1
    }
    resources = {
      status: 'ok',
      data: { presentToday: present.length, insideNow: snap.kpis.insideCount, workers, technical, other },
    }
  }

  /* ----------------------------------------------- Daily performance */

  const allTaskRows = tasksRes.error ? [] : ((tasksRes.data ?? []) as Row[])
  const dailyScheduleRows: DailyScheduleRow[] = allTaskRows
    .filter((row) => isLeafTask(row, allTaskRows, []))
    .map((row) => {
      const baseline = taskBaselineDates(row)
      return {
        id: String(row.id),
        weight: normalizeScheduleWeightPercent(num(row.physical_weight) ?? num(row.schedule_weight)),
        percent: num(row.physical_percent_complete) ?? num(row.percent_complete) ?? 0,
        baselineStart: baseline.start,
        baselineFinish: baseline.finish,
        currentStart: str(row.start_current)?.slice(0, 10) ?? baseline.start,
        currentFinish: str(row.finish_current)?.slice(0, 10) ?? baseline.finish,
      }
    })

  let daily: SectionResult<ManagerDailyDelta>
  if (progressUpdatesRes.error) {
    daily = isMissingRelation(progressUpdatesRes.error.message)
      ? { status: 'unavailable', reason: activeReasons.notBuilt }
      : { status: 'error', message: progressUpdatesRes.error.message }
  } else if (tasksRes.error) {
    daily = isMissingRelation(tasksRes.error.message)
      ? { status: 'unavailable', reason: activeReasons.notBuilt }
      : { status: 'error', message: tasksRes.error.message }
  } else if (!dailyScheduleRows.some((row) => row.weight > 0)) {
    daily = { status: 'unavailable', reason: R.physicalWeightMissing }
  } else {
    daily = {
      status: 'ok',
      data: buildDailyDelta({
        rows: dailyScheduleRows,
        today,
        nowMs: now,
        updates: ((progressUpdatesRes.data ?? []) as Row[])
          .filter((row) => row.task_id && row.created_at)
          .map((row) => ({
            taskId: String(row.task_id),
            percent: num(row.percent_complete) ?? 0,
            createdAt: String(row.created_at),
          })),
        lastDailyReport: dailyRow?.report_date
          ? { date: String(dailyRow.report_date), approved: Boolean(dailyRow.approved_by_manager) }
          : null,
      }),
    }
  }

  const taskRows = tasksRes.error ? [] : ((tasksRes.data ?? []) as Row[])
  const scheduleTaskRows = taskRows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? R.unnamedActivity),
    wbs: str(row.wbs_code),
    isCritical: row.is_critical === true,
    isSummary: row.is_summary === true,
    totalFloatDays: num(row.total_float_days),
    baselineFinish: str(row.baseline_finish),
    currentFinish: str(row.finish_current) ?? str(row.finish_planned),
    actualFinish: str(row.actual_finish),
    percent: num(row.physical_percent_complete) ?? num(row.percent_complete) ?? 0,
  }))
  let delays: SectionResult<ManagerCriticalDelays>
  if (tasksRes.error) {
    delays = isMissingRelation(tasksRes.error.message)
      ? { status: 'unavailable', reason: activeReasons.notBuilt }
      : { status: 'error', message: tasksRes.error.message }
  } else if (!taskRows.some((row) => row.baseline_finish)) {
    delays = {
      status: 'unavailable',
      reason: R.baselineMissing,
    }
  } else {
    delays = {
      status: 'ok',
      data: buildCriticalFronts(
        criticalFrontsInput({
          projectId,
          today,
          locale,
          taskRows,
          evmActivities: evmSnapshot?.activities ?? null,
          packageLinks: packageLinksRes.error ? null : ((packageLinksRes.data ?? []) as Row[]),
          subcontractors: subcontractorsRes.error ? [] : ((subcontractorsRes.data ?? []) as Row[]),
          dependencies: dependenciesRes.error ? null : ((dependenciesRes.data ?? []) as Row[]),
          cpmCalculatedAt: cpmRunRes.error ? null : str(((cpmRunRes.data ?? []) as Row[])[0]?.calculated_at),
          alerts: openAlertsRes.error ? null : ((openAlertsRes.data ?? []) as Row[]),
          blockedWorkOrders: sitePlan.status === 'ok' ? sitePlan.data.blocked : null,
        })
      ),
    }
  }
  const upcoming: SectionResult<ManagerUpcomingDeadline[]> = tasksRes.error
    ? isMissingRelation(tasksRes.error.message)
      ? { status: 'unavailable', reason: activeReasons.notBuilt }
      : { status: 'error', message: tasksRes.error.message }
    : { status: 'ok', data: buildUpcomingDeadlines(scheduleTaskRows, today) }

  const ownerNames = (keys: string[]): string | null => {
    const found = membersWith(keys)
    return found.length ? found.slice(0, 2).map((m) => m.name).join(R.listSep) : null
  }
  const taskNameById = new Map(taskRows.map((row) => [String(row.id), String(row.name ?? '')]))
  const checkedSources: string[] = []
  const blockerErrors: string[] = []
  if (sitePlan.status === 'ok') checkedSources.push(R.sourceSitePlan)
  else if (sitePlan.status === 'error') blockerErrors.push(sitePlan.message)
  if (inventory.status !== 'error') checkedSources.push(R.sourceInventory)
  else blockerErrors.push(inventory.message)
  if (quality.status === 'ok') checkedSources.push(R.sourceOpenNcrs)
  else if (quality.status === 'error') blockerErrors.push(quality.message)
  if (!openAlertsRes.error) checkedSources.push(R.sourcePlanningAlerts)
  else if (!isMissingRelation(openAlertsRes.error.message)) blockerErrors.push(openAlertsRes.error.message)

  const blockers: SectionResult<ManagerBlockers> =
    checkedSources.length === 0
      ? blockerErrors.length
        ? { status: 'error', message: blockerErrors[0] }
        : { status: 'unavailable', reason: activeReasons.notBuilt }
      : {
          status: 'ok',
          data: {
            checkedSources,
            items: buildBlockers({
              locale,
              blockedWorkOrders: sitePlan.status === 'ok' ? sitePlan.data.blocked : [],
              constraintNotes: sitePlan.status === 'ok' ? sitePlan.data.notes : [],
              stock: inventoryRows.map((row) => ({
                id: String(row.id),
                name: String(row.name ?? ''),
                current: num(row.current_stock) ?? 0,
                min: num(row.min_stock) ?? 0,
                unit: str(row.unit),
                updatedAt: str(row.last_updated_at),
              })),
              criticalNcrs:
                quality.status === 'ok'
                  ? quality.data.rows
                      .filter((r) => r.severity === 'critical')
                      .map((r) => ({
                        id: String(r.id),
                        label: str(r.ncr_number) ? `NCR ${String(r.ncr_number)}` : R.ncrUnnumbered,
                        createdAt: str(r.created_at),
                      }))
                  : [],
              openAlerts: openAlertsRes.error
                ? []
                : ((openAlertsRes.data ?? []) as Row[]).map((row) => ({
                    id: String(row.id),
                    type: String(row.alert_type ?? ''),
                    severity: String(row.severity ?? ''),
                    message: String(row.message ?? ''),
                    taskName: row.related_task_id ? taskNameById.get(String(row.related_task_id)) || null : null,
                    createdAt: String(row.created_at),
                  })),
              owners: {
                materials: ownerNames(['storekeeper', 'procurement_officer']),
                quality: ownerNames(['qa_qc_inspector']),
                site: ownerNames(['site_supervisor', 'site_manager']),
              },
            }),
          },
        }

  const project = projectRes.data as Row | null

  let traces: CalcTraceMap | undefined
  if (options.withTraces && evmSnapshot && evm.status === 'ok') {
    const latest = latestRecordByActivity(records)
    traces = buildHomeTraces({
      evm: evm.data,
      snapshot: evmSnapshot,
      curve: progress.status === 'ok' ? progress.data : null,
      progressRows: progressRowsFromSnapshot(evmSnapshot, (id) => {
        const r = latest.get(id)
        return r ? { percent: r.percent, date: r.date } : null
      }),
    })
  }

  return {
    ...(traces ? { traces } : {}),
    project: project
      ? {
          id: String(project.id),
          name: String(project.name ?? ''),
          code: str(project.code),
          location: str(project.location),
          startDate: str(project.start_date),
          endDate: str(project.end_date),
        }
      : null,
    generatedAt: new Date().toISOString(),
    evm,
    decisions,
    alerts:
      scheduleAlerts.ok || evm.status === 'ok'
        ? { status: 'ok', data: alerts }
        : { status: 'error', message: 'message' in scheduleAlerts ? scheduleAlerts.message : R.genericError },
    site: { date: today, attendance, inventory, quality: qualitySummary, hse },
    pulse: { status: 'ok', data: pulseSources },
    resources,
    invoices,
    progress,
    daily,
    blockers,
    delays,
    upcoming,
  }
}

const ALERT_CAUSE_KIND: Record<string, CriticalFrontCauseInput['kind']> = {
  material_purchase: 'material',
  delay_risk: 'schedule',
  milestone_risk: 'schedule',
  critical_path: 'schedule',
}

/** Maps the raw rows of the overview queries onto the critical-fronts builder input. */
function criticalFrontsInput(input: {
  projectId: string
  today: string
  locale: FormLocale
  taskRows: Row[]
  evmActivities: ProjectEvmSnapshot['activities'] | null
  packageLinks: Row[] | null
  subcontractors: Row[]
  dependencies: Row[] | null
  cpmCalculatedAt: string | null
  alerts: Row[] | null
  blockedWorkOrders: BlockerInputs['blockedWorkOrders'] | null
}): BuildCriticalFrontsInput {
  const packagesById = new Map((input.packageLinks ?? []).map((p) => [String(p.id), p]))
  const rootTaskOf = (packageId: string): string | null => {
    const seen = new Set<string>()
    let current = packagesById.get(packageId)
    while (current && !seen.has(String(current.id))) {
      seen.add(String(current.id))
      if (current.project_task_id) return String(current.project_task_id)
      current = current.parent_package_id ? packagesById.get(String(current.parent_package_id)) : undefined
    }
    return null
  }
  const rollup = new Map<string, { weight: number; earned: number; count: number; sum: number }>()
  for (const activity of input.evmActivities ?? []) {
    if (activity.kind !== 'package') continue
    const taskId = rootTaskOf(activity.id)
    if (!taskId) continue
    const agg = rollup.get(taskId) ?? { weight: 0, earned: 0, count: 0, sum: 0 }
    agg.weight += activity.weight
    agg.earned += activity.weight * activity.physicalPercent
    agg.count += 1
    agg.sum += activity.physicalPercent
    rollup.set(taskId, agg)
  }

  const contractorName = new Map(input.subcontractors.map((s) => [String(s.id), String(s.name ?? '')]))
  const tasks = input.taskRows.map((row) => {
    const id = String(row.id)
    const baseline = taskBaselineDates(row)
    const agg = rollup.get(id)
    const own = num(row.physical_percent_complete) ?? num(row.percent_complete) ?? 0
    const contractorId = str(row.resolved_subcontractor_id) ?? str(row.subcontractor_id)
    return {
      id,
      name: String(row.name ?? activeReasons.unnamedActivity),
      wbs: str(row.wbs_code)?.trim() || null,
      isSummary: row.is_summary === true,
      isCritical: row.is_critical === true,
      totalFloatDays: num(row.total_float_days),
      baselineStart: baseline.start,
      baselineFinish: baseline.finish,
      currentFinish: str(row.finish_current)?.slice(0, 10) ?? str(row.finish_planned)?.slice(0, 10) ?? null,
      actualFinish: str(row.actual_finish),
      percent: agg ? (agg.weight > 0 ? agg.earned / agg.weight : agg.sum / agg.count) : own,
      percentFromPackages: Boolean(agg),
      contractor: contractorId ? contractorName.get(contractorId) || null : null,
    }
  })

  const causes: CriticalFrontCauseInput[] = []
  const causeSources: string[] = []
  if (input.alerts) {
    causeSources.push(activeReasons.openPlanningAlerts)
    for (const row of input.alerts) {
      if (!row.related_task_id) continue
      causes.push({
        taskId: String(row.related_task_id),
        kind: ALERT_CAUSE_KIND[String(row.alert_type ?? '')] ?? 'schedule',
        source: 'alert',
        ref: `alert:${String(row.id)}`,
        label_fa: String(row.message ?? activeReasons.openPlanningAlert),
        severity: row.severity === 'critical' ? 'critical' : 'warning',
        since: str(row.created_at),
      })
    }
  }
  if (input.blockedWorkOrders) {
    causeSources.push(activeReasons.stoppedWorkOrders)
    const taskIdByWbs = new Map(tasks.filter((t) => t.wbs).map((t) => [t.wbs!, t.id]))
    const listSep = activeReasons.listSep
    for (const wo of input.blockedWorkOrders) {
      const taskId = wo.wbs ? taskIdByWbs.get(wo.wbs) : undefined
      if (!taskId) continue
      causes.push({
        taskId,
        kind: 'site',
        source: 'work_order',
        ref: `work_order:${wo.id}`,
        label_fa: activeReasons.stoppedWoLabel(wo.constraints.join(listSep)),
        severity: 'critical',
        since: wo.planDate,
      })
    }
  }

  return {
    projectId: input.projectId,
    today: input.today,
    locale: input.locale,
    tasks,
    dependencies: input.dependencies
      ? input.dependencies
          .filter((d) => d.predecessor_task_id && d.successor_task_id)
          .map((d) => ({ predecessorId: String(d.predecessor_task_id), successorId: String(d.successor_task_id) }))
      : null,
    cpmCalculatedAt: input.cpmCalculatedAt,
    causes,
    causeSources,
  }
}
