import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProjectEvm, type ProjectEvmSnapshot } from '@/lib/evm/load-project-evm'
import { listActiveScheduleAlerts } from '@/lib/schedule/schedule-alerts-api'
import type { ScheduleAlertSeverity } from '@/lib/schedule/float-alerts'
import { getAttendanceDashboard } from '@/lib/attendance/service'
import type { AttendanceDashboardSnapshot } from '@/lib/attendance/types'
import { POSITION_LABELS } from '@/lib/i18n/position-labels'
import { faNumber, jalaliDate } from '@/lib/manager/format'
import { MANAGER_REMINDER_PREFIX, PULSE_ROLES } from '@/lib/manager/pulse-config'
import {
  actualPercentOf,
  buildProgressCurve,
  scheduleVarianceDays,
  type ProgressSnapshotRow,
} from '@/lib/manager/progress-curve'
import {
  buildBlockers,
  buildCriticalDelays,
  buildDailyDelta,
  type BlockerInputs,
  type DailyScheduleRow,
} from '@/lib/manager/daily-performance'
import { isLeafTask, taskBaselineDates } from '@/lib/schedule/leaf-activities'
import { normalizeScheduleWeightPercent } from '@/lib/schedule/weighted-progress'
import type {
  ManagerAlert,
  ManagerBlockers,
  ManagerCriticalDelays,
  ManagerDailyDelta,
  ManagerCurve,
  ManagerDecisionItem,
  ManagerEvmSummary,
  ManagerInvoiceSummary,
  ManagerOverview,
  ManagerPulseKey,
  ManagerPulsePerson,
  ManagerPulseSource,
  ManagerQuality,
  ManagerResources,
  SectionResult,
} from '@/lib/manager/overview-types'

type Row = Record<string, unknown>

function isMissingRelation(message: string | undefined): boolean {
  return /does not exist|schema cache|Could not find|Invalid schema/i.test(message ?? '')
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const NOT_BUILT = 'جدول‌های این بخش هنوز در پایگاه داده ساخته نشده‌اند.'

async function section<T>(
  run: () => Promise<SectionResult<T>>,
  fallback: string
): Promise<SectionResult<T>> {
  try {
    return await run()
  } catch (error) {
    const message = errorMessage(error, fallback)
    if (isMissingRelation(message)) return { status: 'unavailable', reason: NOT_BUILT }
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

const SCHEDULE_GROUPS: Array<{
  severities: ScheduleAlertSeverity[]
  level: ManagerAlert['level']
  title: string
  cause: string
  impact: string
  suggestion: string
}> = [
  {
    severities: ['negative'],
    level: 'critical',
    title: 'شناوری منفی روی مسیر بحرانی',
    cause: 'فعالیت‌هایی که شناوری آن‌ها منفی شده است.',
    impact: 'تاریخ پایان پروژه با روند فعلی عقب می‌افتد.',
    suggestion: 'برنامهٔ جبرانی (شیفت اضافه یا نیروی بیشتر) برای این فعالیت‌ها تصویب و با سرپرست کارگاه هماهنگ کنید.',
  },
  {
    severities: ['urgent', 'critical'],
    level: 'warning',
    title: 'فعالیت‌های بحرانی با پیشرفت کند',
    cause: 'فعالیت‌های مسیر بحرانی که نرخ پیشرفتشان از برنامه پایین‌تر است.',
    impact: 'هر روز تأخیر این فعالیت‌ها مستقیماً پایان پروژه را عقب می‌اندازد.',
    suggestion: 'علت کندی (نیرو، مصالح یا جبههٔ کاری) را از سرپرست کارگاه بپرسید و منابع را جابه‌جا کنید.',
  },
  {
    severities: ['near_critical', 'fast_consumption'],
    level: 'warning',
    title: 'فعالیت‌های نزدیک به مسیر بحرانی',
    cause: 'شناوری این فعالیت‌ها کم است یا سریع‌تر از حد مجاز مصرف می‌شود.',
    impact: 'با چند روز تأخیر دیگر روی مسیر بحرانی قرار می‌گیرند.',
    suggestion: 'پیش از ورود به مسیر بحرانی، توالی و منابع این فعالیت‌ها را بازبینی کنید.',
  },
]

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

function positionLabel(key: string): string {
  return POSITION_LABELS[key]?.fa ?? key
}

/* ---------------------------------------------------------------- Loader */

export async function loadManagerOverview(
  supabase: SupabaseClient,
  service: SupabaseClient,
  projectId: string,
  today: string
): Promise<ManagerOverview> {
  const now = Date.now()

  const projectPromise = service
    .from('projects')
    .select('id, name, code, location, start_date, end_date')
    .eq('id', projectId)
    .maybeSingle()

  const evmSnapshotPromise = loadProjectEvm(service, projectId, { asOf: today, today }).then(
    (snapshot) => ({ ok: true as const, snapshot }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error, 'بارگذاری شاخص‌های EVM ناموفق بود') })
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
      title: String(row.name ?? 'بستهٔ کاری بدون نام'),
      subtitle: [str(row.location), str(row.crew)].filter(Boolean).join(' · ') || null,
      updatedAt: str(row.updated_at),
    }))
    return { status: 'ok' as const, data: { items, total: count ?? items.length } }
  }, 'بارگذاری کارتابل ناموفق بود')

  const scheduleAlertsPromise = listActiveScheduleAlerts(supabase, projectId).then(
    (alerts) => ({ ok: true as const, alerts }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error, 'خطا') })
  )

  const attendancePromise = getAttendanceDashboard(supabase, projectId).then(
    (snapshot) => ({ ok: true as const, snapshot }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error, 'بارگذاری تردد امروز ناموفق بود') })
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
  }, 'بارگذاری NCR ناموفق بود')

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
      return { status: 'unavailable', reason: 'هنوز صورت‌وضعیتی برای کارفرما در این پروژه ثبت نشده است.' }
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
  }, 'بارگذاری صورت‌وضعیت‌ها ناموفق بود')

  const snapshotsPromise = service
    .from('progress_snapshots')
    .select('activity_id, snapshot_month, cumulative_percent')
    .eq('project_id', projectId)

  const progressUpdatesPromise = service
    .from('task_progress_updates')
    .select('task_id, percent_complete, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(20000)

  const tasksPromise = service.from('project_tasks').select('*').eq('project_id', projectId)

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
        .select('id, constraints, site_ops_operational_tasks(name)')
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
          const name = Array.isArray(task) ? task[0]?.name : task?.name
          return {
            id: String(row.id),
            taskName: String(name ?? 'دستور کار بدون نام'),
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
  }, 'بارگذاری برنامهٔ روزانهٔ کارگاه ناموفق بود')

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
    dailyReportRes,
    lastTransitRes,
    gatesRes,
    membersRes,
    remindersRes,
    invoices,
    snapshotsRes,
    progressUpdatesRes,
    tasksRes,
    sitePlan,
    openAlertsRes,
  ] = await Promise.all([
    projectPromise,
    evmSnapshotPromise,
    decisionsPromise,
    scheduleAlertsPromise,
    attendancePromise,
    inventoryPromise,
    qualityPromise,
    dailyReportPromise,
    lastTransitPromise,
    gatesPromise,
    membersPromise,
    remindersPromise,
    invoicesPromise,
    snapshotsPromise,
    progressUpdatesPromise,
    tasksPromise,
    sitePlanPromise,
    openAlertsPromise,
  ])

  /* ------------------------------------------------------------- EVM */

  let evmSnapshot: ProjectEvmSnapshot | null = null
  let evm: SectionResult<ManagerEvmSummary>
  if (evmRes.ok) {
    evmSnapshot = evmRes.snapshot
    const m = evmSnapshot.metrics
    const actualPercent = actualPercentOf(evmSnapshot.activities, (a) => a.physicalPercent)
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
        ac: m.ac,
        sv: m.sv,
        cv: m.cv,
        activityCount: m.activityCount,
        budgetBasis: m.budgetBasis,
        criticalFloatDays: evmSnapshot.float.criticalFloatDays,
        floatConsumptionPercent: evmSnapshot.float.floatConsumptionPercent,
        scheduleVarianceDays: scheduleVarianceDays(evmSnapshot.activities, m.bac, m.earnedPercent, today),
        rag: evmSnapshot.rag,
      },
    }
  } else {
    const message = 'message' in evmRes ? evmRes.message : 'خطا'
    evm = isMissingRelation(message) ? { status: 'unavailable', reason: NOT_BUILT } : { status: 'error', message }
  }

  /* ----------------------------------------------------------- Curve */

  let progress: SectionResult<ManagerCurve>
  if (!evmSnapshot || evm.status !== 'ok') {
    progress = evm.status === 'ok' ? { status: 'unavailable', reason: 'شاخص‌های EVM در دسترس نیست.' } : evm
  } else {
    const snapshots: ProgressSnapshotRow[] = snapshotsRes.error
      ? []
      : ((snapshotsRes.data ?? []) as Row[]).map((row) => ({
          activityId: String(row.activity_id),
          snapshotMonth: String(row.snapshot_month).slice(0, 10),
          cumulativePercent: num(row.cumulative_percent) ?? 0,
        }))
    const curve = buildProgressCurve({
      activities: evmSnapshot.activities,
      bac: evm.data.bac,
      budgetBasis: evm.data.budgetBasis,
      earnedPercent: evm.data.earnedPercent,
      actualPercent: evm.data.actualPercent,
      today,
      snapshots,
    })
    progress = curve
      ? { status: 'ok', data: curve }
      : {
          status: 'unavailable',
          reason: 'برای رسم منحنی، فعالیت‌ها باید تاریخ baseline و بودجه (یا وزن) داشته باشند.',
        }
  }

  /* --------------------------------------------------------- Members */

  const members: MemberRow[] = membersRes.error
    ? []
    : ((membersRes.data ?? []) as Row[]).map((row) => ({
        userId: String(row.user_id),
        name: String(row.full_name || row.email || 'بدون نام'),
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
      ? { status: 'unavailable', reason: NOT_BUILT }
      : { status: 'error', message: 'message' in attendanceRes ? attendanceRes.message : 'خطا' }

  const inventoryRows = inventoryRes.error ? [] : ((inventoryRes.data ?? []) as Row[])
  const inventory: ManagerOverview['site']['inventory'] = inventoryRes.error
    ? isMissingRelation(inventoryRes.error.message)
      ? { status: 'unavailable', reason: NOT_BUILT }
      : { status: 'error', message: inventoryRes.error.message }
    : inventoryRows.length === 0
      ? { status: 'unavailable', reason: 'هنوز کالایی در انبار این پروژه ثبت نشده است.' }
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
        .map((r) => ({ label: r.activityName?.trim() || 'فعالیت بدون نام', occurredAt: r.createdAt }))
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
          ? 'هزینهٔ واقعی بیشتر از ارزش کار انجام‌شده'
          : isFloat
            ? 'مصرف شناوری مسیر بحرانی'
            : 'عقب‌ماندگی کلی پروژه از برنامه',
        cause: reason.messageFa,
        impact: isCost
          ? 'با این روند، هزینهٔ تمام‌شدهٔ پروژه از بودجه عبور می‌کند.'
          : 'با این روند، پروژه دیرتر از تاریخ قراردادی تمام می‌شود.',
        suggestion: isCost
          ? 'اسناد هزینه را با پیشرفت تأییدشده تطبیق دهید و هزینه‌های بدون پیشرفت متناظر را بررسی کنید.'
          : 'فعالیت‌های عقب‌افتاده را اولویت‌بندی و برنامهٔ جبرانی را تصویب کنید.',
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
        title: 'موجودی مصالح تمام شده است',
        cause: 'موجودی انبار برای این اقلام به صفر رسیده است.',
        impact: 'فعالیت‌های وابسته به این مصالح متوقف می‌شوند.',
        suggestion: 'سفارش فوری خرید یا انتقال از انبار دیگر را با تدارکات پیگیری کنید.',
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
        title: 'مصالح زیر حداقل موجودی',
        cause: 'موجودی این اقلام به حداقل مجاز رسیده است.',
        impact: 'در صورت تأخیر در خرید، فعالیت‌های وابسته کند می‌شوند.',
        suggestion: 'سفارش خرید را پیش از تمام‌شدن موجودی ثبت کنید.',
        occurredAt: null,
        eventBased: false,
        items: low.map((i) => ({ label: `${i.name} (${faNumber(i.current)} از ${faNumber(i.min)})`, occurredAt: null })),
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
        title: 'عدم انطباق بحرانی باز',
        cause: 'NCR با شدت بحرانی بسته نشده است.',
        impact: 'ادامهٔ کار در محدودهٔ NCR ریسک کیفی و دوباره‌کاری دارد.',
        suggestion: 'کار در محدودهٔ NCR را تا اقدام اصلاحی و بازرسی مجدد متوقف کنید.',
        occurredAt: str(critical[0].created_at),
        eventBased: true,
        items: critical.map((r) => ({
          label: str(r.ncr_number) ? `NCR ${String(r.ncr_number)}` : 'NCR بدون شماره',
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
      reason = input.neverReason ?? 'هنوز فعالیتی ثبت نشده است.'
    } else {
      const ageHours = (now - new Date(input.lastActivityAt).getTime()) / 3_600_000
      status = ageHours > input.thresholdHours ? 'stale' : 'fresh'
    }
    if (!reason && responsible.length === 0) reason = `هیچ عضوی با سمت «${positionLabel(roleKey)}» در این پروژه ثبت نشده است.`
    return {
      key: input.key,
      label: input.label,
      roleLabel: positionLabel(roleKey),
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
      label: 'گزارش روزانهٔ سرپرست',
      thresholdHours: 30,
      lastActivityAt: str(dailyRow?.created_at),
      detail: dailyRow
        ? `گزارش ${jalaliDate(str(dailyRow.report_date))}${dailyRow.approved_by_manager ? ' · تأییدشده' : ' · منتظر تأیید'}`
        : null,
      unavailableReason: dailyReportRes.error ? dailyReportRes.error.message : null,
      neverReason: 'هنوز گزارش روزانه‌ای برای این پروژه ثبت نشده است.',
    })
  )

  const lastInventoryUpdate = inventoryRows.reduce<string | null>((m, r) => {
    const v = str(r.last_updated_at)
    return v && (!m || v > m) ? v : m
  }, null)
  pulseSources.push(
    buildPulse({
      key: 'warehouse',
      label: 'موجودی انبار مرکزی',
      thresholdHours: 48,
      lastActivityAt: lastInventoryUpdate,
      detail: inventoryRows.length ? `${faNumber(inventoryRows.length)} قلم کالا` : null,
      unavailableReason: inventory.status === 'error' ? inventory.message : null,
      neverReason: 'هنوز کالایی در انبار ثبت نشده است.',
    })
  )

  pulseSources.push(
    buildPulse({
      key: 'hse',
      label: 'چک‌لیست ایمنی HSE',
      thresholdHours: 24,
      lastActivityAt: null,
      detail: null,
      unavailableReason: 'ماژول HSE هنوز به دادهٔ واقعی متصل نشده است؛ صفحهٔ ایمنی فعلاً دادهٔ نمایشی دارد.',
    })
  )

  const activeGates = gatesRes.error ? 0 : ((gatesRes.data ?? []) as Row[]).filter((g) => g.is_active !== false).length
  const lastTransit = lastTransitRes.error ? null : str(((lastTransitRes.data ?? [])[0] as Row | undefined)?.occurred_at)
  pulseSources.push(
    buildPulse({
      key: 'gate',
      label: 'گیت حراست و حضور و غیاب',
      thresholdHours: 24,
      lastActivityAt: lastTransit,
      detail: gatesRes.error ? null : activeGates ? `${faNumber(activeGates)} گیت فعال` : 'گیتی تعریف نشده',
      unavailableReason: lastTransitRes.error ? lastTransitRes.error.message : null,
      neverReason: 'هنوز ترددی از گیت ثبت نشده است.',
    })
  )

  /* ------------------------------------------------------- Resources */

  let resources: SectionResult<ManagerResources>
  if (!attendanceRes.ok) {
    resources = attendance.status === 'ok' ? { status: 'error', message: 'خطا' } : attendance
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
      ? { status: 'unavailable', reason: NOT_BUILT }
      : { status: 'error', message: progressUpdatesRes.error.message }
  } else if (tasksRes.error) {
    daily = isMissingRelation(tasksRes.error.message)
      ? { status: 'unavailable', reason: NOT_BUILT }
      : { status: 'error', message: tasksRes.error.message }
  } else if (!dailyScheduleRows.some((row) => row.weight > 0)) {
    daily = { status: 'unavailable', reason: 'وزن فیزیکی فعالیت‌های برنامه تعریف نشده است.' }
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
  let delays: SectionResult<ManagerCriticalDelays>
  if (tasksRes.error) {
    delays = isMissingRelation(tasksRes.error.message)
      ? { status: 'unavailable', reason: NOT_BUILT }
      : { status: 'error', message: tasksRes.error.message }
  } else if (!taskRows.some((row) => row.baseline_finish)) {
    delays = {
      status: 'unavailable',
      reason: 'برنامهٔ مبنا (baseline) برای فعالیت‌ها ثبت نشده است؛ تأخیر نسبت به برنامه قابل محاسبه نیست.',
    }
  } else {
    delays = {
      status: 'ok',
      data: buildCriticalDelays(
        taskRows.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? 'فعالیت بدون نام'),
          wbs: str(row.wbs_code),
          isCritical: row.is_critical === true,
          isSummary: row.is_summary === true,
          totalFloatDays: num(row.total_float_days),
          baselineFinish: str(row.baseline_finish),
          currentFinish: str(row.finish_current) ?? str(row.finish_planned),
          actualFinish: str(row.actual_finish),
          percent: num(row.physical_percent_complete) ?? num(row.percent_complete) ?? 0,
        })),
        today
      ),
    }
  }

  const ownerNames = (keys: string[]): string | null => {
    const found = membersWith(keys)
    return found.length ? found.slice(0, 2).map((m) => m.name).join('، ') : null
  }
  const taskNameById = new Map(taskRows.map((row) => [String(row.id), String(row.name ?? '')]))
  const checkedSources: string[] = []
  const blockerErrors: string[] = []
  if (sitePlan.status === 'ok') checkedSources.push('برنامهٔ روزانهٔ کارگاه')
  else if (sitePlan.status === 'error') blockerErrors.push(sitePlan.message)
  if (inventory.status !== 'error') checkedSources.push('موجودی انبار')
  else blockerErrors.push(inventory.message)
  if (quality.status === 'ok') checkedSources.push('NCRهای باز')
  else if (quality.status === 'error') blockerErrors.push(quality.message)
  if (!openAlertsRes.error) checkedSources.push('هشدارهای برنامه‌ریزی')
  else if (!isMissingRelation(openAlertsRes.error.message)) blockerErrors.push(openAlertsRes.error.message)

  const blockers: SectionResult<ManagerBlockers> =
    checkedSources.length === 0
      ? blockerErrors.length
        ? { status: 'error', message: blockerErrors[0] }
        : { status: 'unavailable', reason: NOT_BUILT }
      : {
          status: 'ok',
          data: {
            checkedSources,
            items: buildBlockers({
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
                        label: str(r.ncr_number) ? `NCR ${String(r.ncr_number)}` : 'NCR بدون شماره',
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

  return {
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
        : { status: 'error', message: 'message' in scheduleAlerts ? scheduleAlerts.message : 'خطا' },
    site: { date: today, attendance, inventory, quality: qualitySummary },
    pulse: { status: 'ok', data: pulseSources },
    resources,
    invoices,
    progress,
    daily,
    blockers,
    delays,
  }
}
