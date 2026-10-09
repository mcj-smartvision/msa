import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProjectEvm } from '@/features/evm/lib/load-project-evm'
import { createServiceClient } from '@/shared/lib/supabase/service'
import {
buildPeriodComparison,
buildPeriodWindows,
tehranDateIso,
type ActivityHistory,
type IssueEvent,
type SourceState,
type TransitRow,
} from '@/features/manager/lib/period-comparison'
import type { ComparisonCause, ManagerPeriod, PeriodComparison } from '@/features/manager/lib/overview-types'

type Row = Record<string, unknown>

function isMissingRelation(message: string | undefined): boolean {
  return /does not exist|schema cache|Could not find|Invalid schema/i.test(message ?? '')
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function str(value: unknown): string | null {
  return value == null || value === '' ? null : String(value)
}

function one(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null
  return (value as Row | null) ?? null
}

const ROW_LIMIT = 20000

const DAILY_ISSUE_LABELS: Record<string, string> = {
  material: 'مصالح',
  manpower: 'نیروی انسانی',
  equipment: 'تجهیزات',
  permit: 'مجوز',
  other: 'سایر',
}

export interface PeriodComparisonOptions {
  service?: SupabaseClient
  now?: Date
}

/**
 * Current period against the previous one at the same elapsed time, for one project. All
 * aggregation runs here on the server; the dashboard only renders the result.
 */
export async function getPeriodComparison(
  projectId: string,
  period: ManagerPeriod,
  options: PeriodComparisonOptions = {}
): Promise<PeriodComparison> {
  const service = options.service ?? createServiceClient()
  const nowMs = (options.now ?? new Date()).getTime()
  const nowIso = new Date(nowMs).toISOString()
  const today = tehranDateIso(nowMs)
  const windows = buildPeriodWindows(period, nowMs)
  const sinceIso = new Date(windows.previous.start).toISOString()
  const sinceDate = tehranDateIso(windows.previous.start)

  const [
    evm,
    taskUpdates,
    packageUpdates,
    transits,
    transitCount,
    engineNcr,
    legacyNcr,
    hse,
    workshopEntries,
    plans,
    constraintLogs,
    reportActivities,
  ] = await Promise.all([
    loadProjectEvm(service, projectId, { asOf: today, today }),
    service
      .from('task_progress_updates')
      .select('task_id, percent_complete, created_at')
      .eq('project_id', projectId)
      .lte('created_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(ROW_LIMIT),
    service
      .from('package_progress_updates')
      .select('package_id, percent_complete, created_at')
      .eq('project_id', projectId)
      .lte('created_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(ROW_LIMIT),
    service
      .from('attendance_transits')
      .select('user_id, person_name, occurred_at')
      .eq('project_id', projectId)
      .eq('direction', 'IN')
      .eq('identification_status', 'success')
      .gte('occurred_at', sinceIso)
      .lte('occurred_at', nowIso)
      .limit(ROW_LIMIT),
    service.from('attendance_transits').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    service
      .schema('qc_engine')
      .from('ncr')
      .select('id, created_at')
      .eq('project_id', projectId)
      .gte('created_at', sinceIso),
    service.from('qc_ncrs').select('id, created_at').eq('project_id', projectId).gte('created_at', sinceIso),
    service
      .from('ai_actions')
      .select('id, payload, created_at')
      .eq('project_id', projectId)
      .eq('type', 'hse_alert')
      .eq('status', 'confirmed_by_user')
      .gte('created_at', sinceIso),
    service
      .from('workshop_actual_entries')
      .select('id, status, note, recorded_at, workshop_daily_assignments!inner(project_id, workshop_packages(name))')
      .eq('workshop_daily_assignments.project_id', projectId)
      .in('status', ['blocked', 'partial'])
      .gte('recorded_at', sinceIso),
    service.from('site_ops_daily_plans').select('id, plan_date').eq('project_id', projectId).gte('plan_date', sinceDate),
    service
      .from('site_ops_constraint_logs')
      .select('id, note, work_order_id, created_at')
      .eq('project_id', projectId)
      .gte('created_at', sinceIso),
    service
      .from('daily_report_activities')
      .select('id, issues, created_at, schedule_activity_id, daily_reports!inner(project_id)')
      .eq('daily_reports.project_id', projectId)
      .gte('created_at', sinceIso),
  ])

  const warnings: string[] = []

  /* -------------------------------------------------------- Progress */

  let progressSource: SourceState = { available: true, reason: '' }
  if (taskUpdates.error) {
    progressSource = { available: false, reason: `تاریخچهٔ پیشرفت خوانده نشد: ${taskUpdates.error.message}` }
  }
  const historyOf = new Map<string, { at: number; percent: number }[]>()
  const pushHistory = (id: unknown, percent: unknown, at: unknown) => {
    const key = str(id)
    const t = str(at) ? Date.parse(String(at)) : NaN
    const pct = num(percent)
    if (!key || !Number.isFinite(t) || pct == null) return
    const list = historyOf.get(key) ?? []
    list.push({ at: t, percent: pct })
    historyOf.set(key, list)
  }
  for (const row of (taskUpdates.data ?? []) as Row[]) pushHistory(row.task_id, row.percent_complete, row.created_at)
  if (packageUpdates.error) {
    if (!isMissingRelation(packageUpdates.error.message)) throw new Error(packageUpdates.error.message)
    warnings.push('جدول تاریخچهٔ پیشرفت بسته‌ها (migration 99) هنوز اجرا نشده است.')
  }
  for (const row of (packageUpdates.data ?? []) as Row[]) {
    pushHistory(row.package_id, row.percent_complete, row.created_at)
  }
  for (const list of historyOf.values()) list.sort((a, b) => a.at - b.at)

  const activities: ActivityHistory[] = evm.activities.map((a) => ({
    id: a.id,
    name: a.name || 'فعالیت بدون نام',
    kind: a.kind,
    weight: a.weight,
    budget: a.budget,
    baselineStart: a.baselineStart,
    baselineFinish: a.baselineFinish,
    currentPercent: a.physicalPercent,
    history: historyOf.get(a.id) ?? [],
  }))

  const incompletePackages = activities.filter(
    (a) => a.kind === 'package' && (a.weight > 0 || a.budget > 0) && (a.history[0]?.at ?? Infinity) > windows.previous.start
  )
  if (incompletePackages.length > 0) {
    warnings.push(
      `تاریخچهٔ بسته‌های کاری ناقص است: برای ${incompletePackages.length.toLocaleString('fa-IR-u-nu-latn')} بستهٔ کاری، نقاط پیش از اولین ثبت با درصد فعلی حساب شده‌اند.`
    )
  }

  /* ------------------------------------------------------ Attendance */

  let transitRows: TransitRow[] | null = null
  if (!transits.error && !transitCount.error) {
    transitRows =
      (transitCount.count ?? 0) === 0
        ? []
        : ((transits.data ?? []) as Row[])
            .map((row) => ({
              person: str(row.user_id) ?? `name:${str(row.person_name) ?? ''}`,
              at: Date.parse(String(row.occurred_at)),
            }))
            .filter((row) => Number.isFinite(row.at) && row.person !== 'name:')
  } else if (transits.error && !isMissingRelation(transits.error.message)) {
    throw new Error(transits.error.message)
  }

  /* ---------------------------------------------------------- Issues */

  const events: IssueEvent[] = []
  const checked: string[] = []
  const causes: ComparisonCause[] = []
  const pushEvent = (type: IssueEvent['type'], at: unknown) => {
    const t = str(at) ? Date.parse(String(at)) : NaN
    if (Number.isFinite(t)) events.push({ at: t, type })
  }

  const ncr = !engineNcr.error ? engineNcr : legacyNcr
  if (!ncr.error) {
    checked.push('NCR')
    for (const row of (ncr.data ?? []) as Row[]) pushEvent('ncr', row.created_at)
  } else if (!isMissingRelation(ncr.error.message)) {
    throw new Error(ncr.error.message)
  }

  if (!hse.error) {
    checked.push('هشدار HSE سرپرست')
    for (const row of (hse.data ?? []) as Row[]) {
      if (String(one(row.payload)?.severity ?? 'warning') === 'info') continue
      pushEvent('safety', row.created_at)
    }
  } else if (!isMissingRelation(hse.error.message)) {
    throw new Error(hse.error.message)
  }

  if (!workshopEntries.error) {
    checked.push('توقف بسته‌های کاری')
    for (const row of (workshopEntries.data ?? []) as Row[]) {
      const blocked = row.status === 'blocked'
      if (blocked) pushEvent('stoppage', row.recorded_at)
      const note = str(row.note)
      if (!note && !blocked) continue
      const pkg = one(one(row.workshop_daily_assignments)?.workshop_packages)
      causes.push({
        id: `workshop-${String(row.id)}`,
        source: 'workshop',
        category: blocked ? 'توقف بستهٔ کاری' : 'اجرای ناقص بستهٔ کاری',
        text: note ?? 'علت ثبت نشده',
        activity: str(pkg?.name),
        at: String(row.recorded_at),
      })
    }
  } else if (!isMissingRelation(workshopEntries.error.message)) {
    throw new Error(workshopEntries.error.message)
  }

  if (!plans.error) {
    const planIds = ((plans.data ?? []) as Row[]).map((row) => String(row.id))
    if (planIds.length > 0) {
      const orders = await service
        .from('site_ops_work_orders')
        .select('id, constraints, created_at, site_ops_operational_tasks(name)')
        .in('daily_plan_id', planIds)
        .eq('status', 'BLOCKED')
      if (orders.error && !isMissingRelation(orders.error.message)) throw new Error(orders.error.message)
      for (const row of (orders.data ?? []) as Row[]) {
        pushEvent('stoppage', row.created_at)
        const constraints = Array.isArray(row.constraints) ? (row.constraints as unknown[]).map(String) : []
        causes.push({
          id: `wo-${String(row.id)}`,
          source: 'site_plan',
          category: 'دستور کار متوقف',
          text: constraints.length ? constraints.join('، ') : 'علت ثبت نشده',
          activity: str(one(row.site_ops_operational_tasks)?.name),
          at: String(row.created_at),
        })
      }
    }
    checked.push('برنامهٔ روزانهٔ کارگاه')
  } else if (!isMissingRelation(plans.error.message)) {
    throw new Error(plans.error.message)
  }

  if (!constraintLogs.error) {
    for (const row of (constraintLogs.data ?? []) as Row[]) {
      if (!row.work_order_id) pushEvent('stoppage', row.created_at)
      causes.push({
        id: `constraint-${String(row.id)}`,
        source: 'site_plan',
        category: 'محدودیت کارگاه',
        text: String(row.note ?? ''),
        activity: null,
        at: String(row.created_at),
      })
    }
  } else if (!isMissingRelation(constraintLogs.error.message)) {
    throw new Error(constraintLogs.error.message)
  }

  const nameById = new Map(activities.map((a) => [a.id, a.name]))
  let causesAvailable = !workshopEntries.error || !constraintLogs.error || !plans.error
  if (!reportActivities.error) {
    causesAvailable = true
    for (const row of (reportActivities.data ?? []) as Row[]) {
      const issues = Array.isArray(row.issues) ? (row.issues as Row[]) : []
      issues.forEach((issue, index) => {
        const text = str(issue.description)
        if (!text) return
        causes.push({
          id: `report-${String(row.id)}-${index}`,
          source: 'daily_report',
          category: DAILY_ISSUE_LABELS[String(issue.type)] ?? 'سایر',
          text,
          activity: nameById.get(String(row.schedule_activity_id)) ?? null,
          at: String(row.created_at),
        })
      })
    }
  } else if (!isMissingRelation(reportActivities.error.message)) {
    throw new Error(reportActivities.error.message)
  }
  causes.sort((a, b) => b.at.localeCompare(a.at))

  return buildPeriodComparison({
    projectId,
    period,
    nowMs,
    activities,
    progressSource,
    transits: transitRows,
    issues: checked.length ? { events, checked } : null,
    causes: causesAvailable ? causes : null,
    warnings,
  })
}
