/**
 * MSP XML import parser (بخش ۲).
 *
 * Uses fast-xml-parser (structured XML library) — not hand-edited XML strings.
 * .MPP binary: convert via Project «Save As → XML» (MPXJ bridge can plug in later).
 */

import { XMLParser } from 'fast-xml-parser'
import type {
  MspParseResult,
  MspParsedAssignment,
  MspParsedCalendar,
  MspParsedDependency,
  MspParsedResource,
  MspParsedSegment,
  MspParsedTask,
} from '@/lib/schedule/msp-import'
import {
  resolveWeightFieldIds,
  inferWeightFieldIdFromRawTasks,
  extractTaskScheduleWeight,
} from '@/lib/schedule/msp-weight'
import { calculateCpm } from '@/lib/schedule/cpm-calculate'
import { addDaysIso, toIsoDateOnly } from '@/lib/schedule/dates'

/** MSP PredecessorLink Type: 0=FF, 1=FS, 2=SF, 3=SS */
const MSP_LINK_TYPES: Record<number, MspParsedDependency['relation_type']> = {
  0: 'FF',
  1: 'FS',
  2: 'SF',
  3: 'SS',
}

const CONSTRAINT_TYPES: Record<number, string> = {
  0: 'ASAP',
  1: 'ALAP',
  2: 'MSO',
  3: 'MFO',
  4: 'SNET',
  5: 'SNLT',
  6: 'FNET',
  7: 'FNLT',
}

/** Common MSP FieldIDs */
const FIELD_TEXT1 = '188743731'
const FIELD_TEXT2 = '188743732'
const FIELD_NUMBER1 = '188743767'

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

function isoOrNull(value: unknown): string | null {
  const v = textValue(value)
  if (!v || v === 'NA') return null
  const date = new Date(v)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function mapLinkType(raw: unknown): MspParsedDependency['relation_type'] {
  const text = textValue(raw).toUpperCase()
  if (text === 'FS' || text === 'SS' || text === 'FF' || text === 'SF') return text
  const num = numValue(raw, 1)
  return MSP_LINK_TYPES[num] ?? 'FS'
}

/** LinkLag in MSP is often tenths of a minute → minutes. */
function parseLagMinutes(raw: unknown): number {
  const tenths = numValue(raw, 0)
  return Math.round(tenths / 10)
}

/**
 * Detect percentage lag (MSP LagFormat / % in value).
 * Common LagFormat values for elapsed/% vary by version — also accept '%' text.
 */
function isPercentLag(link: Record<string, unknown>): boolean {
  const lagText = textValue(link.LinkLag ?? link.Lag)
  if (lagText.includes('%')) return true
  const fmt = textValue(link.LagFormat ?? link.Format).toLowerCase()
  if (fmt.includes('percent') || fmt.includes('%')) return true
  const fmtNum = numValue(link.LagFormat, NaN)
  // MSP: 19/39 often used for percent-of-duration style formats in some exports
  if (fmtNum === 19 || fmtNum === 39 || fmtNum === 44) return true
  return false
}

/** ISO-8601 duration (PT40H0M0S / P5D) → working days (8h). */
function parseDurationDays(raw: unknown): number | null {
  const v = textValue(raw)
  if (!v) return null
  if (v === 'PT0S' || v === 'PT0H0M0S' || v === 'P0D') return 0
  const dayMatch = v.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i)
  if (!dayMatch) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const days = Number(dayMatch[1] || 0)
  const hours = Number(dayMatch[2] || 0)
  const mins = Number(dayMatch[3] || 0)
  return Math.round((days + hours / 8 + mins / 480) * 1000) / 1000
}

function mapConstraintType(raw: unknown): string | null {
  const text = textValue(raw).toUpperCase()
  if (
    text === 'ASAP' ||
    text === 'ALAP' ||
    text === 'SNET' ||
    text === 'SNLT' ||
    text === 'FNET' ||
    text === 'FNLT' ||
    text === 'MSO' ||
    text === 'MFO'
  ) {
    return text
  }
  const n = numValue(raw, NaN)
  if (!Number.isFinite(n)) return null
  return CONSTRAINT_TYPES[n] ?? null
}

function eaMap(task: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>()
  for (const raw of asArray(task.ExtendedAttribute)) {
    const ea = raw as Record<string, unknown>
    const fieldId = textValue(ea.FieldID)
    const fieldName = textValue(ea.FieldName).toLowerCase()
    const value = textValue(ea.Value)
    if (fieldId) map.set(fieldId, value)
    if (fieldName) map.set(`name:${fieldName}`, value)
  }
  return map
}

function resolveNamedFieldIds(project: Record<string, unknown>): {
  text1: Set<string>
  text2: Set<string>
  number1: Set<string>
} {
  const text1 = new Set<string>([FIELD_TEXT1])
  const text2 = new Set<string>([FIELD_TEXT2])
  const number1 = new Set<string>([FIELD_NUMBER1])

  const rawDefs = asArray(
    (project.ExtendedAttributes as { ExtendedAttribute?: unknown } | undefined)
      ?.ExtendedAttribute ?? project.ExtendedAttributes
  )
  for (const raw of rawDefs) {
    const def = raw as Record<string, unknown>
    const fieldId = textValue(def.FieldID)
    if (!fieldId) continue
    const labels = [
      textValue(def.FieldName),
      textValue(def.Alias),
      textValue(def.PhoneticAlias),
    ]
      .join(' ')
      .toLowerCase()
    if (/^text1$|text 1|متن\s*۱|متن1/.test(labels) || labels === 'text1') text1.add(fieldId)
    if (/^text2$|text 2|متن\s*۲|متن2/.test(labels) || labels === 'text2') text2.add(fieldId)
    if (/^number1$|number 1|عدد\s*۱|عدد1|physical\s*weight/.test(labels)) number1.add(fieldId)
  }
  return { text1, text2, number1 }
}

function pickEa(
  map: Map<string, string>,
  ids: Set<string>,
  nameKeys: string[]
): string | null {
  for (const id of ids) {
    const v = map.get(id)
    if (v) return v
  }
  for (const k of nameKeys) {
    const v = map.get(`name:${k}`)
    if (v) return v
  }
  return null
}

function buildParentMap(tasks: MspParsedTask[]): void {
  const byWbs = new Map<string, MspParsedTask>()
  for (const t of tasks) {
    if (t.wbs_code?.trim()) byWbs.set(t.wbs_code.trim(), t)
  }
  for (const t of tasks) {
    const wbs = t.wbs_code?.trim()
    if (!wbs || !wbs.includes('.')) {
      t.parent_msp_uid = null
      continue
    }
    const parentWbs = wbs.slice(0, wbs.lastIndexOf('.'))
    t.parent_msp_uid = byWbs.get(parentWbs)?.msp_uid ?? null
  }
}

/**
 * Some MSP XML templates omit <Start>/<Finish> even though Project UI shows dates
 * (dates are calculated live from Duration + predecessors). Fill gaps from
 * Project.StartDate + a forward CPM pass so Import still gets planned dates.
 */
function fillMissingPlannedDates(
  tasks: MspParsedTask[],
  dependencies: MspParsedDependency[],
  projectStartRaw: unknown
): void {
  const needsFill = tasks.some((t) => !t.start_planned || !t.finish_planned)
  if (!needsFill) return

  const epoch = toIsoDateOnly(isoOrNull(projectStartRaw) ?? null)
  if (!epoch) return

  const leafs = tasks.filter((t) => !t.is_summary)
  const cpm = calculateCpm(
    leafs.map((t) => ({
      id: String(t.msp_uid),
      durationDays: Math.max(0, Number(t.duration_days) || 0),
      isSummary: false,
    })),
    dependencies
      .filter((d) => !d.lag_is_percentage)
      .map((d) => ({
        predecessorId: String(d.predecessor_uid),
        successorId: String(d.successor_uid),
        type: d.relation_type,
        lagDays: d.lag_days ?? (d.lag_duration || 0) / 480,
      }))
  )

  if (cpm.success) {
    const byId = new Map(cpm.activities.map((a) => [a.id, a]))
    for (const t of leafs) {
      const a = byId.get(String(t.msp_uid))
      if (!a) continue
      const dur = Math.max(0, Number(t.duration_days) || 0)
      if (!t.start_planned) {
        t.start_planned = `${addDaysIso(epoch, a.earlyStart)}T08:00:00.000Z`
      }
      if (!t.finish_planned) {
        const finishOffset = dur <= 0 ? a.earlyStart : Math.max(a.earlyStart, a.earlyFinish - 1)
        t.finish_planned = `${addDaysIso(epoch, finishOffset)}T17:00:00.000Z`
      }
    }
  } else {
    // Sequential fallback if graph has a cycle
    let cursor = 0
    for (const t of leafs) {
      const dur = Math.max(0, Number(t.duration_days) || 0)
      if (!t.start_planned) {
        t.start_planned = `${addDaysIso(epoch, cursor)}T08:00:00.000Z`
      }
      if (!t.finish_planned) {
        const finishOffset = dur <= 0 ? cursor : cursor + dur - 1
        t.finish_planned = `${addDaysIso(epoch, Math.max(0, finishOffset))}T17:00:00.000Z`
      }
      cursor += Math.max(1, dur)
    }
  }

  // Roll summary dates from direct children (WBS)
  const byWbs = new Map<string, MspParsedTask>()
  for (const t of tasks) {
    if (t.wbs_code?.trim()) byWbs.set(t.wbs_code.trim(), t)
  }
  const summaries = tasks
    .filter((t) => t.is_summary && t.wbs_code)
    .sort((a, b) => (b.wbs_code?.length ?? 0) - (a.wbs_code?.length ?? 0))
  for (const parent of summaries) {
    const pw = parent.wbs_code!.trim()
    const children = tasks.filter(
      (c) =>
        c.msp_uid !== parent.msp_uid &&
        c.wbs_code &&
        c.wbs_code.startsWith(pw + '.') &&
        c.wbs_code.slice(pw.length + 1).indexOf('.') === -1
    )
    if (children.length === 0) continue
    const starts = children.map((c) => c.start_planned).filter(Boolean) as string[]
    const finishes = children.map((c) => c.finish_planned).filter(Boolean) as string[]
    if (!parent.start_planned && starts.length) {
      parent.start_planned = starts.sort()[0]
    }
    if (!parent.finish_planned && finishes.length) {
      parent.finish_planned = finishes.sort().at(-1) ?? null
    }
    // Summary duration = sum of direct children (MSP often stores 0)
    const childDurSum = children.reduce((s, c) => {
      const d = Number(c.duration_days)
      return s + (Number.isFinite(d) && d > 0 ? d : 0)
    }, 0)
    if (childDurSum > 0 && !(Number(parent.duration_days) > 0)) {
      parent.duration_days = Math.round(childDurSum * 1000) / 1000
    }
  }
}

/**
 * Parse Microsoft Project XML export into tasks, deps, resources, calendars, segments.
 */
export function parseMspXml(xmlContent: string): MspParseResult {
  if (!xmlContent.trim()) {
    throw new Error('XML file is empty')
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
    throw new Error('Invalid XML file — export from Microsoft Project as XML')
  }

  const project = (doc as { Project?: Record<string, unknown> })?.Project
  if (!project) {
    throw new Error('Not a valid MSP XML file (missing Project root)')
  }

  let rawTasks = asArray(
    (project.Tasks as { Task?: unknown } | undefined)?.Task ??
      (project.Tasks as unknown) ??
      project.Task
  )

  if (rawTasks.length === 1 && typeof rawTasks[0] === 'object' && rawTasks[0] !== null) {
    const nested = (rawTasks[0] as { Task?: unknown }).Task
    if (nested) rawTasks = asArray(nested)
  }

  const tasks: MspParsedTask[] = []
  const dependencies: MspParsedDependency[] = []
  const segments: MspParsedSegment[] = []
  let weightFieldIds = resolveWeightFieldIds(project)
  if (weightFieldIds.size === 0) {
    weightFieldIds = inferWeightFieldIdFromRawTasks(rawTasks)
  }
  const namedFields = resolveNamedFieldIds(project)

  for (const raw of rawTasks) {
    const task = raw as Record<string, unknown>
    const uid = numValue(task.UID, -1)
    if (uid <= 0) continue

    const name = textValue(task.Name)
    if (!name) continue

    const isSummary = boolValue(task.Summary)
    const outlineNumber = textValue(task.OutlineNumber) || null
    const wbs = outlineNumber || textValue(task.WBS) || null
    const durationDays = parseDurationDays(task.Duration)
    const remainingDays = parseDurationDays(task.RemainingDuration)
    const isMilestone =
      boolValue(task.Milestone) || (durationDays != null && durationDays === 0 && !isSummary)
    const eas = eaMap(task)
    const scheduleWeight = extractTaskScheduleWeight(task, weightFieldIds)
    const number1Raw = pickEa(eas, namedFields.number1, ['number1', 'number 1'])
    const physicalWeight =
      number1Raw != null && Number.isFinite(Number(number1Raw))
        ? Number(number1Raw)
        : scheduleWeight
    const obs = pickEa(eas, namedFields.text1, ['text1', 'text 1', 'obs'])
    const cbs = pickEa(eas, namedFields.text2, ['text2', 'text 2', 'cbs'])

    const physicalPct = Math.min(
      100,
      Math.max(0, numValue(task.PhysicalPercentComplete, numValue(task.PercentComplete, 0)))
    )
    const percentComplete = Math.min(100, Math.max(0, numValue(task.PercentComplete, 0)))

    const isManual =
      boolValue(task.ManuallyScheduled) ||
      textValue(task.TaskMode).toUpperCase() === 'MANUALLY_SCHEDULED' ||
      numValue(task.TaskMode, 0) === 1

    const isRecurring =
      boolValue(task.IsRecurring) ||
      boolValue(task.Recurring) ||
      boolValue(task.RecurringMaster)

    // Timephased / split segments
    const timephased = asArray(
      (task.TimephasedData as { TimephasedData?: unknown } | undefined)?.TimephasedData ??
        task.TimephasedData
    )
    const splits = asArray(task.Splits ?? (task as { Split?: unknown }).Split)
    let hasSplit = false
    let segOrder = 0
    for (const s of [...splits, ...timephased]) {
      const seg = s as Record<string, unknown>
      const start = isoOrNull(seg.Start ?? seg.SegmentStart ?? seg.Begin)
      const finish = isoOrNull(seg.Finish ?? seg.SegmentFinish ?? seg.End)
      if (!start || !finish) continue
      hasSplit = true
      segments.push({
        task_uid: uid,
        segment_start: start,
        segment_finish: finish,
        sort_order: segOrder++,
      })
    }
    if (boolValue(task.Split) || numValue(task.SplitCount, 0) > 1) hasSplit = true

    const baselineDuration = parseDurationDays(task.BaselineDuration)
    const baselineWork = parseDurationDays(task.BaselineWork)
    const workHours = (() => {
      const d = parseDurationDays(task.Work)
      return d != null ? d * 8 : null
    })()

    tasks.push({
      msp_uid: uid,
      external_id: String(uid),
      wbs_code: wbs || null,
      outline_number: outlineNumber,
      outline_level: (() => {
        const n = numValue(task.OutlineLevel, NaN)
        return Number.isFinite(n) ? n : outlineNumber ? outlineNumber.split('.').length : null
      })(),
      name,
      start_planned: isoOrNull(task.Start),
      finish_planned: isoOrNull(task.Finish),
      percent_complete: percentComplete,
      physical_percent_complete: physicalPct,
      is_critical: boolValue(task.Critical),
      is_summary: isSummary,
      is_milestone: isMilestone,
      schedule_weight: scheduleWeight,
      physical_weight: physicalWeight,
      duration_days: durationDays,
      remaining_duration_days: remainingDays,
      obs_code: obs,
      cbs_code: cbs,
      constraint_type: mapConstraintType(task.ConstraintType),
      constraint_date: isoOrNull(task.ConstraintDate),
      deadline: isoOrNull(task.Deadline),
      baseline_start: isoOrNull(task.BaselineStart),
      baseline_finish: isoOrNull(task.BaselineFinish),
      baseline_duration_days: baselineDuration,
      baseline_cost: (() => {
        const n = numValue(task.BaselineCost, NaN)
        return Number.isFinite(n) ? n : null
      })(),
      baseline_work_hours: baselineWork != null ? baselineWork * 8 : null,
      actual_start: isoOrNull(task.ActualStart),
      actual_finish: isoOrNull(task.ActualFinish),
      work_hours: workHours,
      cost: (() => {
        const n = numValue(task.Cost, NaN)
        return Number.isFinite(n) ? n : null
      })(),
      fixed_cost: (() => {
        const n = numValue(task.FixedCost, NaN)
        return Number.isFinite(n) ? n : null
      })(),
      notes: textValue(task.Notes) || null,
      flag: boolValue(task.Flag1 ?? task.Flag),
      priority: (() => {
        const n = numValue(task.Priority, NaN)
        return Number.isFinite(n) ? n : null
      })(),
      is_manual_scheduled: isManual,
      has_split: hasSplit,
      is_recurring_master: isRecurring,
    })

    if (isSummary) continue

    const links = asArray(task.PredecessorLink)
    for (const link of links) {
      const l = link as Record<string, unknown>
      const predecessorUid = numValue(l.PredecessorUID, 0)
      if (predecessorUid <= 0) continue
      const lagMinutes = parseLagMinutes(l.LinkLag ?? l.Lag)
      const percent = isPercentLag(l)
      dependencies.push({
        predecessor_uid: predecessorUid,
        successor_uid: uid,
        relation_type: mapLinkType(l.Type ?? l.LinkType),
        lag_duration: lagMinutes,
        lag_days: Math.round((lagMinutes / 480) * 10000) / 10000,
        lag_is_percentage: percent,
      })
    }
  }

  if (tasks.length === 0) {
    throw new Error('No tasks found in XML — export tasks from Microsoft Project as XML')
  }

  buildParentMap(tasks)

  // Resources
  const resources: MspParsedResource[] = []
  let unnamedResourceCount = 0
  let rawResources = asArray(
    (project.Resources as { Resource?: unknown } | undefined)?.Resource ?? project.Resources
  )
  if (rawResources.length === 1 && typeof rawResources[0] === 'object' && rawResources[0]) {
    const nested = (rawResources[0] as { Resource?: unknown }).Resource
    if (nested) rawResources = asArray(nested)
  }
  for (const raw of rawResources) {
    const r = raw as Record<string, unknown>
    const uid = numValue(r.UID, -1)
    if (uid < 0) continue
    let name = textValue(r.Name)
    let wasUnnamed = false
    if (!name) {
      wasUnnamed = true
      unnamedResourceCount++
      name = `منبع بدون‌نام #${uid}`
    }
    const typeRaw = textValue(r.Type).toLowerCase()
    const typeNum = numValue(r.Type, 1)
    let type: MspParsedResource['type'] = 'work'
    if (typeRaw.includes('material') || typeNum === 0) type = 'material'
    else if (typeRaw.includes('cost') || typeNum === 2) type = 'cost'

    resources.push({
      msp_uid: uid,
      name,
      type,
      standard_rate: (() => {
        const n = numValue(r.StandardRate, NaN)
        return Number.isFinite(n) ? n : null
      })(),
      unit_of_measure: textValue(r.MaterialLabel) || null,
      wasUnnamed,
    })
  }

  // Assignments
  const assignments: MspParsedAssignment[] = []
  let rawAssignments = asArray(
    (project.Assignments as { Assignment?: unknown } | undefined)?.Assignment ??
      project.Assignments
  )
  if (rawAssignments.length === 1 && typeof rawAssignments[0] === 'object' && rawAssignments[0]) {
    const nested = (rawAssignments[0] as { Assignment?: unknown }).Assignment
    if (nested) rawAssignments = asArray(nested)
  }
  for (const raw of rawAssignments) {
    const a = raw as Record<string, unknown>
    const taskUid = numValue(a.TaskUID, 0)
    const resourceUid = numValue(a.ResourceUID, -1)
    if (taskUid <= 0 || resourceUid < 0) continue
    const units = numValue(a.Units, NaN)
    const workDays = parseDurationDays(a.Work)
    assignments.push({
      task_uid: taskUid,
      resource_uid: resourceUid,
      units_percent: Number.isFinite(units) ? units * (units <= 1.5 ? 100 : 1) : null,
      work_hours: workDays != null ? workDays * 8 : null,
      cost: (() => {
        const n = numValue(a.Cost, NaN)
        return Number.isFinite(n) ? n : null
      })(),
    })
  }

  // Calendars (best-effort)
  const calendars: MspParsedCalendar[] = []
  let rawCalendars = asArray(
    (project.Calendars as { Calendar?: unknown } | undefined)?.Calendar ?? project.Calendars
  )
  if (rawCalendars.length === 1 && typeof rawCalendars[0] === 'object' && rawCalendars[0]) {
    const nested = (rawCalendars[0] as { Calendar?: unknown }).Calendar
    if (nested) rawCalendars = asArray(nested)
  }
  const defaultDays = {
    saturday: true,
    sunday: true,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: false,
  }
  for (const raw of rawCalendars) {
    const c = raw as Record<string, unknown>
    const uid = numValue(c.UID, -1)
    const name = textValue(c.Name) || `تقویم ${uid}`
    if (uid < 0 && !name) continue
    calendars.push({
      msp_uid: uid >= 0 ? uid : calendars.length,
      name,
      working_days: { ...defaultDays },
      daily_shifts: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      exceptions: [],
      minutes_per_day: 480,
      is_default: boolValue(c.IsBaseCalendar) || calendars.length === 0,
    })
  }
  if (calendars.length === 0) {
    calendars.push({
      msp_uid: 1,
      name: 'تقویم پیش‌فرض پروژه',
      working_days: defaultDays,
      daily_shifts: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      exceptions: [],
      minutes_per_day: 480,
      is_default: true,
    })
  }

  fillMissingPlannedDates(tasks, dependencies, project.StartDate)

  return {
    tasks,
    dependencies,
    resources,
    assignments,
    segments,
    calendars,
    unnamedResourceCount,
  }
}
