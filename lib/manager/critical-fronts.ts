import { plannedPercentInWindow } from '@/lib/schedule/planned-progress'
import type {
  CriticalFrontAction,
  CriticalFrontActionKind,
  CriticalFrontCause,
  CriticalFrontCpm,
  ManagerCriticalDelay,
  ManagerCriticalDelays,
} from '@/lib/manager/overview-types'

const DAY_MS = 86_400_000

function dateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY_MS)
}

const fa = (value: number, digits = 0) =>
  value.toLocaleString('fa-IR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** A CPM activity of `project_tasks` (summary rows are not scheduled by CPM). */
export interface CriticalFrontTask {
  id: string
  name: string
  wbs: string | null
  isSummary: boolean
  isCritical: boolean
  totalFloatDays: number | null
  baselineStart: string | null
  baselineFinish: string | null
  /** Current schedule finish (finish_current, else finish_planned). */
  currentFinish: string | null
  actualFinish: string | null
  /** Approved physical percent; already rolled up from workshop packages when the task has them. */
  percent: number
  /** True when `percent` is the weighted roll-up of the task's workshop packages. */
  percentFromPackages: boolean
  contractor: string | null
}

export interface CriticalFrontDependency {
  predecessorId: string
  successorId: string
}

/** A recorded reason linked to one task. */
export interface CriticalFrontCauseInput extends CriticalFrontCause {
  taskId: string
}

export interface BuildCriticalFrontsInput {
  projectId: string
  today: string
  tasks: CriticalFrontTask[]
  /** null when `task_dependencies` could not be read (table missing). */
  dependencies: CriticalFrontDependency[] | null
  /** Latest `schedule_calculations.calculated_at`; null when CPM never ran or the table is missing. */
  cpmCalculatedAt: string | null
  causes: CriticalFrontCauseInput[]
  /** Sources searched for causes, so «علتی ثبت نشده» says what was checked. */
  causeSources: string[]
  limit?: number
}

/** Planned − actual gap (percentage points) above which adding a crew is the first suggestion. */
export const CREW_GAP_THRESHOLD = 10
/** Delay (days) above which a contractor review is recommended. */
export const CONTRACTOR_REVIEW_DELAY_DAYS = 14
/** Days given to the owner of a suggested directive. */
export const ACTION_DUE_DAYS = 2

function resolveCpm(input: BuildCriticalFrontsInput, scheduled: CriticalFrontTask[]): CriticalFrontCpm {
  const deps = input.dependencies
  const withFloat = scheduled.filter((t) => t.totalFloatDays != null).length
  const missing: { key: string; label_fa: string; detail_fa: string }[] = []
  if (deps == null) {
    missing.push({
      key: 'task_dependencies_table',
      label_fa: 'جدول روابط پیش‌نیازی',
      detail_fa: 'جدول task_dependencies در دیتابیس خوانده نشد؛ بدون آن شبکهٔ CPM ساخته نمی‌شود.',
    })
  } else if (deps.length === 0) {
    missing.push({
      key: 'dependencies',
      label_fa: 'روابط پیش‌نیازی فعالیت‌ها',
      detail_fa: 'هیچ رابطهٔ پیش‌نیازی (FS/SS/FF/SF) برای فعالیت‌ها ثبت نشده؛ آن‌ها را در برنامهٔ زمان‌بندی (یا فایل MSP) وارد کنید.',
    })
  }
  if (withFloat === 0) {
    missing.push({
      key: 'cpm_run',
      label_fa: 'اجرای محاسبهٔ CPM',
      detail_fa: 'Total Float هیچ فعالیتی محاسبه نشده؛ پس از ثبت روابط، محاسبهٔ CPM برنامه را اجرا کنید.',
    })
  }
  if (missing.length) {
    return {
      status: 'data_missing',
      reason_fa: 'برنامهٔ CPM کامل نیست؛ مسیر بحرانی و Total Float قابل تعیین نیست و فهرست فقط بر اساس تأخیر نسبت به baseline است.',
      missing,
    }
  }
  const linked = new Set<string>()
  for (const d of deps!) {
    linked.add(d.predecessorId)
    linked.add(d.successorId)
  }
  return {
    status: 'ok',
    calculatedAt: input.cpmCalculatedAt,
    dependencyCount: deps!.length,
    activityCount: scheduled.length,
    unlinkedCount: scheduled.filter((t) => !linked.has(t.id)).length,
  }
}

function buildActions(input: {
  projectId: string
  today: string
  task: CriticalFrontTask
  delayDays: number
  plannedPercent: number
  causes: CriticalFrontCause[]
  predecessors: string[]
  successors: string[]
  cpmOk: boolean
  forecastFinish: string
}): CriticalFrontAction[] {
  const { task, delayDays, plannedPercent, causes, predecessors, successors, cpmOk } = input
  const gap = plannedPercent - task.percent
  const remaining = Math.max(0, 100 - task.percent)
  const materialCause = causes.find((c) => c.kind === 'material')
  const due = addDays(input.today, ACTION_DUE_DAYS)

  const payloadOf = (action: CriticalFrontActionKind, ownerRole: CriticalFrontAction['owner_role'], params: Record<string, unknown>) => ({
    schema: 'directive.draft/v1' as const,
    source: 'manager.critical_fronts' as const,
    projectId: input.projectId,
    action,
    task: { id: task.id, name: task.name, wbs: task.wbs },
    owner_role: ownerRole,
    due_date: due,
    evidence: {
      asOf: input.today,
      delayDays,
      totalFloatDays: task.totalFloatDays,
      plannedPercent: Math.round(plannedPercent * 10) / 10,
      actualPercent: Math.round(task.percent * 10) / 10,
      baselineFinish: task.baselineFinish,
      forecastFinish: input.forecastFinish,
      causes: causes.map((c) => ({ kind: c.kind, source: c.source, ref: c.ref })),
    },
    params,
  })

  const actions: CriticalFrontAction[] = [
    {
      kind: 'add_crew',
      label_fa: 'افزایش اکیپ',
      recommended: gap >= CREW_GAP_THRESHOLD,
      rationale_fa:
        gap > 0
          ? `پیشرفت ${fa(task.percent)}٪ در برابر برنامهٔ ${fa(plannedPercent)}٪ (${fa(gap)} واحد درصد عقب)؛ ${fa(remaining)}٪ کار باقی است.`
          : `پیشرفت از برنامه عقب نیست، اما ${fa(delayDays)} روز تأخیر نسبت به پایان مبنا دارد؛ ${fa(remaining)}٪ کار باقی است.`,
      owner_role: 'SiteManager',
      payload: payloadOf('add_crew', 'SiteManager', { remainingPercent: remaining, progressGap: Math.round(gap * 10) / 10 }),
    },
    {
      kind: 'resequence',
      label_fa: 'تغییر توالی',
      recommended: cpmOk && successors.length > 0,
      rationale_fa: cpmOk
        ? successors.length
          ? `${fa(successors.length)} فعالیت پس‌نیاز منتظر این فعالیت‌اند؛ هم‌پوشانی (fast-track) یا شکستن فعالیت بررسی شود.`
          : 'پس‌نیازی در شبکه ندارد؛ تغییر توالی اثر مستقیمی بر مسیر بحرانی ندارد.'
        : 'روابط پیش‌نیازی ثبت نشده؛ اثر تغییر توالی بر مسیر بحرانی قابل سنجش نیست (پیش‌نویس با این هشدار ساخته می‌شود).',
      owner_role: 'Planner',
      payload: payloadOf('resequence', 'Planner', {
        predecessorIds: predecessors,
        successorIds: successors,
        networkAvailable: cpmOk,
      }),
    },
    {
      kind: 'material_supply',
      label_fa: 'تأمین مصالح',
      recommended: Boolean(materialCause),
      rationale_fa: materialCause
        ? `علت ثبت‌شده: ${materialCause.label_fa}`
        : 'مانع مصالحی برای این فعالیت ثبت نشده؛ آمادگی مصالح باقی‌ماندهٔ کار بررسی شود.',
      owner_role: 'Procurement',
      payload: payloadOf('material_supply', 'Procurement', { linkedCause: materialCause?.ref ?? null }),
    },
    {
      kind: 'contractor_review',
      label_fa: 'بررسی پیمانکار',
      recommended: Boolean(task.contractor) && delayDays >= CONTRACTOR_REVIEW_DELAY_DAYS,
      rationale_fa: task.contractor
        ? `پیمانکار «${task.contractor}»؛ ${fa(delayDays)} روز تأخیر — ظرفیت، منابع و تعهدات قراردادی بررسی شود.`
        : 'پیمانکاری به این فعالیت تخصیص داده نشده؛ ابتدا مسئول اجرا مشخص شود.',
      owner_role: 'PM',
      payload: payloadOf('contractor_review', 'PM', { contractor: task.contractor }),
    },
  ]
  return actions.sort((a, b) => Number(b.recommended) - Number(a.recommended))
}

/**
 * Unfinished activities that slip past their frozen baseline finish. With a CPM network only
 * critical / zero- or negative-float activities are listed and Total Float is shown; without it
 * every delayed activity is listed by baseline delay and the missing CPM inputs are reported.
 */
export function buildCriticalFronts(input: BuildCriticalFrontsInput): ManagerCriticalDelays {
  const { today } = input
  const scheduled = input.tasks.filter((t) => !t.isSummary)
  const cpm = resolveCpm(input, scheduled)
  const cpmOk = cpm.status === 'ok'

  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const d of input.dependencies ?? []) {
    preds.set(d.successorId, [...(preds.get(d.successorId) ?? []), d.predecessorId])
    succs.set(d.predecessorId, [...(succs.get(d.predecessorId) ?? []), d.successorId])
  }
  const causesOf = new Map<string, CriticalFrontCause[]>()
  for (const { taskId, ...cause } of input.causes) causesOf.set(taskId, [...(causesOf.get(taskId) ?? []), cause])

  const items: ManagerCriticalDelay[] = []
  for (const task of scheduled) {
    if (task.actualFinish || task.percent >= 100) continue
    const baseline = dateOnly(task.baselineFinish)
    if (!baseline) continue
    const onPath = task.isCritical || (task.totalFloatDays != null && task.totalFloatDays <= 0)
    if (cpmOk && !onPath) continue
    const current = dateOnly(task.currentFinish) ?? baseline
    const overdue = current < today
    const forecast = overdue ? today : current
    const delayDays = dayDiff(forecast, baseline)
    if (delayDays <= 0) continue
    const plannedPercent = plannedPercentInWindow({ start: task.baselineStart, finish: baseline }, today)
    const causes = causesOf.get(task.id) ?? []
    const predecessors = preds.get(task.id) ?? []
    const successors = succs.get(task.id) ?? []
    items.push({
      id: task.id,
      name: task.name,
      wbs: task.wbs,
      delayDays,
      totalFloatDays: cpmOk ? task.totalFloatDays : null,
      importance: !cpmOk
        ? 'baseline_delay'
        : task.totalFloatDays != null && task.totalFloatDays < 0
          ? 'negative_float'
          : task.isCritical
            ? 'critical'
            : 'zero_float',
      percent: task.percent,
      percentFromPackages: task.percentFromPackages,
      plannedPercent,
      baselineFinish: baseline,
      forecastFinish: forecast,
      overdue,
      contractor: task.contractor,
      predecessorCount: predecessors.length,
      successorCount: successors.length,
      causes,
      actions: buildActions({
        projectId: input.projectId,
        today,
        task,
        delayDays,
        plannedPercent,
        causes,
        predecessors,
        successors,
        cpmOk,
        forecastFinish: forecast,
      }),
    })
  }
  const rank = (i: ManagerCriticalDelay) => (i.totalFloatDays != null && i.totalFloatDays < 0 ? i.totalFloatDays : 0)
  items.sort((a, b) => rank(a) - rank(b) || b.delayDays - a.delayDays || a.percent - b.percent)
  return {
    items: items.slice(0, input.limit ?? 5),
    total: items.length,
    mode: cpmOk ? 'cpm' : 'baseline',
    cpm,
    causeSources: input.causeSources,
  }
}
