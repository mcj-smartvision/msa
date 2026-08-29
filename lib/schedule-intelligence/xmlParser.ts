import { XMLParser } from 'fast-xml-parser'
import type {
  NormalizedSchedule,
  RelationType,
  ScheduleDependency,
  ScheduleTask,
  ScheduleWarning,
} from '@/types/schedule-intelligence'
import { isoOrNull } from '@/lib/schedule-intelligence/dateUtils'
import { durationDaysFromMinutes, parseIsoDurationMinutes, parseMspLagMinutes } from '@/lib/schedule-intelligence/durationUtils'
import { DEFAULT_SCHEDULE_CONFIG } from '@/lib/schedule-intelligence/config'

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function textValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object' && value !== null && '#text' in value) {
    return String((value as { '#text': unknown })['#text'] ?? '').trim()
  }
  return String(value).trim()
}

function numValue(value: unknown, fallback = 0): number {
  const parsed = Number(textValue(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function boolValue(value: unknown): boolean {
  const v = textValue(value).toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** MSP standard: 0=FF, 1=FS, 2=SF, 3=SS. Alternate doc mapping 1=FS,2=SS,3=FF,4=SF also supported. */
const MSP_LINK_TYPES: Record<number, RelationType> = {
  0: 'FF',
  1: 'FS',
  2: 'SF',
  3: 'SS',
  4: 'SF',
}

function mapLinkType(raw: unknown, warnings: ScheduleWarning[]): RelationType {
  const text = textValue(raw).toUpperCase()
  if (text === 'FS' || text === 'SS' || text === 'FF' || text === 'SF') return text
  const num = numValue(raw, 1)
  const mapped = MSP_LINK_TYPES[num]
  if (!mapped) {
    warnings.push({
      code: 'UNKNOWN_LINK_TYPE',
      severity: 'warning',
      message: `نوع رابطه ناشناخته (${num}) — FS به‌عنوان پیش‌فرض استفاده شد`,
      details: String(raw),
    })
    return 'FS'
  }
  return mapped
}

export interface XmlParseResult {
  schedule: NormalizedSchedule
  invalidRecords: ScheduleWarning[]
}

export function parseMicrosoftProjectXml(
  xmlContent: string,
  sourceFileName?: string
): XmlParseResult {
  const warnings: ScheduleWarning[] = []
  const invalidRecords: ScheduleWarning[] = []

  if (!xmlContent.trim()) {
    throw new Error('فایل XML خالی است')
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
    parseTagValue: false,
  })

  let doc: unknown
  try {
    doc = parser.parse(xmlContent)
  } catch {
    throw new Error('XML نامعتبر — از Microsoft Project به‌صورت XML ذخیره کنید')
  }

  const project = (doc as { Project?: Record<string, unknown> })?.Project
  if (!project) {
    throw new Error('فایل MSP XML معتبر نیست (ریشه Project وجود ندارد)')
  }

  const minutesPerDay = numValue(project.MinutesPerDay, DEFAULT_SCHEDULE_CONFIG.minutesPerDay) || 480
  const minutesPerWeek = numValue(project.MinutesPerWeek, DEFAULT_SCHEDULE_CONFIG.minutesPerWeek)
  const daysPerMonth = numValue(project.DaysPerMonth, DEFAULT_SCHEDULE_CONFIG.daysPerMonth)

  let rawTasks = asArray(
    (project.Tasks as { Task?: unknown } | undefined)?.Task ??
      (project.Tasks as unknown) ??
      project.Task
  )
  if (rawTasks.length === 1 && typeof rawTasks[0] === 'object' && rawTasks[0] !== null) {
    const nested = (rawTasks[0] as { Task?: unknown }).Task
    if (nested) rawTasks = asArray(nested)
  }

  const uidSet = new Set<string>()
  const tasks: ScheduleTask[] = []
  const dependencies: ScheduleDependency[] = []
  const rawByUid = new Map<string, Record<string, unknown>>()

  for (const raw of rawTasks) {
    const task = raw as Record<string, unknown>
    const uidNum = numValue(task.UID, -1)
    if (uidNum <= 0) {
      invalidRecords.push({
        code: 'MISSING_UID',
        severity: 'error',
        message: 'فعالیت بدون UID معتبر',
        details: JSON.stringify(task).slice(0, 200),
      })
      continue
    }

    const uid = String(uidNum)
    if (uidSet.has(uid)) {
      warnings.push({
        code: 'DUPLICATE_UID',
        severity: 'error',
        message: `UID تکراری: ${uid}`,
        taskUid: uid,
      })
      continue
    }
    uidSet.add(uid)
    rawByUid.set(uid, task)

    const name = textValue(task.Name)
    if (!name) {
      warnings.push({
        code: 'MISSING_NAME',
        severity: 'warning',
        message: 'فعالیت بدون نام',
        taskUid: uid,
      })
    }

    const isSummary = boolValue(task.Summary)
    const durationMinutes = parseIsoDurationMinutes(task.Duration, minutesPerDay, daysPerMonth)
    const remainingRaw = task.RemainingDuration
    const remainingDurationMinutes =
      remainingRaw != null && textValue(remainingRaw)
        ? parseIsoDurationMinutes(remainingRaw, minutesPerDay, daysPerMonth)
        : null
    const actualDurationMinutes =
      task.ActualDuration != null && textValue(task.ActualDuration)
        ? parseIsoDurationMinutes(task.ActualDuration, minutesPerDay, daysPerMonth)
        : null

    const percentComplete = Math.min(100, Math.max(0, numValue(task.PercentComplete, 0)))
    const criticalRaw = task.Critical
    const isCriticalFromSource =
      criticalRaw != null && textValue(criticalRaw) !== '' ? boolValue(criticalRaw) : null

    const scheduleTask: ScheduleTask = {
      uid,
      id: numValue(task.ID, 0) > 0 ? numValue(task.ID) : null,
      name: name || `فعالیت ${uid}`,
      wbs: textValue(task.WBS) || null,
      outlineNumber: textValue(task.OutlineNumber) || null,
      outlineLevel: numValue(task.OutlineLevel, 0) > 0 ? numValue(task.OutlineLevel) : null,
      parentUid: null,
      isSummary,
      start: isoOrNull(task.Start),
      finish: isoOrNull(task.Finish),
      durationMinutes,
      durationDays: durationDaysFromMinutes(durationMinutes, minutesPerDay),
      percentComplete,
      isCriticalFromSource,
      calendarUid: textValue(task.CalendarUID) || null,
      actualStart: isoOrNull(task.ActualStart),
      actualFinish: isoOrNull(task.ActualFinish ?? task.Actualor),
      actualDurationMinutes,
      remainingDurationMinutes,
      constraintType: numValue(task.ConstraintType, 0),
      constraintDate: isoOrNull(task.ConstraintDate),
      notes: textValue(task.Notes) || null,
      predecessors: [],
      successors: [],
      earlyStartMinutes: null,
      earlyFinishMinutes: null,
      lateStartMinutes: null,
      lateFinishMinutes: null,
      totalFloatMinutes: null,
      freeFloatMinutes: null,
      calculatedCritical: false,
      nearCritical: false,
      status: 'unknown',
      calculatedRemainingMinutes: null,
      daysUntilStartCalendar: null,
      daysUntilStartWorking: null,
      startTimingLabel: null,
      riskScore: null,
      riskLevel: null,
      riskReasons: [],
      bottleneckScore: null,
      indegree: 0,
      outdegree: 0,
      downstreamReach: 0,
      sourceData: { ...task },
    }

    tasks.push(scheduleTask)

    const links = asArray(task.PredecessorLink)
    for (const link of links) {
      const l = link as Record<string, unknown>
      const predUid = String(numValue(l.PredecessorUID, 0))
      if (!predUid || predUid === '0') continue
      if (predUid === uid) {
        warnings.push({
          code: 'SELF_DEPENDENCY',
          severity: 'error',
          message: 'وابستگی به خود',
          taskUid: uid,
          taskName: scheduleTask.name,
        })
        continue
      }
      const dep: ScheduleDependency = {
        predecessorUid: predUid,
        successorUid: uid,
        type: mapLinkType(l.Type ?? l.LinkType, warnings),
        lagMinutes: parseMspLagMinutes(l.LinkLag ?? l.Lag, minutesPerDay),
        rawType: numValue(l.Type ?? l.LinkType, 1),
      }
      if (dep.lagMinutes < 0) {
        warnings.push({
          code: 'NEGATIVE_LAG',
          severity: 'warning',
          message: 'Lag منفی',
          taskUid: uid,
          taskName: scheduleTask.name,
        })
      }
      dependencies.push(dep)
    }
  }

  // Parent UID from outline
  const byOutline = new Map<string, ScheduleTask>()
  for (const t of tasks) {
    if (t.outlineNumber) byOutline.set(t.outlineNumber, t)
  }
  for (const t of tasks) {
    if (!t.outlineNumber) continue
    const parts = t.outlineNumber.split('.')
    if (parts.length > 1) {
      const parentOutline = parts.slice(0, -1).join('.')
      const parent = byOutline.get(parentOutline)
      if (parent) t.parentUid = parent.uid
    }
  }

  // Wire predecessor/successor on tasks
  const taskMap = new Map(tasks.map((t) => [t.uid, t]))
  for (const dep of dependencies) {
    if (!taskMap.has(dep.predecessorUid)) {
      warnings.push({
        code: 'ORPHAN_PREDECESSOR',
        severity: 'error',
        message: `پیش‌نیاز ناشناخته UID=${dep.predecessorUid}`,
        taskUid: dep.successorUid,
      })
      continue
    }
    if (!taskMap.has(dep.successorUid)) continue
    const succ = taskMap.get(dep.successorUid)!
    const pred = taskMap.get(dep.predecessorUid)!
    succ.predecessors.push(dep)
    pred.successors.push(dep)
  }

  const schedule: NormalizedSchedule = {
    projectName: textValue(project.Name) || null,
    projectStart: isoOrNull(project.StartDate),
    projectFinish: isoOrNull(project.FinishDate),
    sourceFileName: sourceFileName ?? null,
    minutesPerDay,
    minutesPerWeek,
    daysPerMonth,
    tasks,
    dependencies,
    calendars: asArray(project.Calendars),
    warnings,
    metadata: {
      scheduleFromStart: textValue(project.ScheduleFromStart),
      calendarUid: textValue(project.CalendarUID),
    },
  }

  if (!schedule.projectStart || !schedule.projectFinish) {
    warnings.push({
      code: 'MISSING_PROJECT_DATES',
      severity: 'warning',
      message: 'تاریخ شروع یا پایان پروژه در XML موجود نیست',
    })
  }

  if (tasks.length === 0) {
    throw new Error('هیچ فعالیتی در XML پیدا نشد')
  }

  return { schedule, invalidRecords }
}
