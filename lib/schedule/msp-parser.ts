import { XMLParser } from 'fast-xml-parser'
import type { MspParsedDependency, MspParsedTask } from '@/lib/schedule/msp-import'
import {
  resolveWeightFieldIds,
  inferWeightFieldIdFromRawTasks,
  extractTaskScheduleWeight,
} from '@/lib/schedule/msp-weight'

/** MSP PredecessorLink Type: 0=FF, 1=FS, 2=SF, 3=SS */
const MSP_LINK_TYPES: Record<number, MspParsedDependency['relation_type']> = {
  0: 'FF',
  1: 'FS',
  2: 'SF',
  3: 'SS',
}

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

function parseLag(raw: unknown): number {
  const tenths = numValue(raw, 0)
  return Math.round(tenths / 10)
}

/**
 * Parse Microsoft Project XML export into tasks + dependencies.
 * Supports MSP 2003/2007/2010+ XML (Save As → XML).
 */
export function parseMspXml(xmlContent: string): {
  tasks: MspParsedTask[]
  dependencies: MspParsedDependency[]
} {
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
  let weightFieldIds = resolveWeightFieldIds(project)
  if (weightFieldIds.size === 0) {
    weightFieldIds = inferWeightFieldIdFromRawTasks(rawTasks)
  }

  for (const raw of rawTasks) {
    const task = raw as Record<string, unknown>
    const uid = numValue(task.UID, -1)
    if (uid <= 0) continue

    const name = textValue(task.Name)
    if (!name) continue

    const isSummary = boolValue(task.Summary)
    const wbs = textValue(task.OutlineNumber) || textValue(task.WBS) || null

    tasks.push({
      msp_uid: uid,
      wbs_code: wbs || null,
      name,
      start_planned: isoOrNull(task.Start),
      finish_planned: isoOrNull(task.Finish),
      percent_complete: Math.min(100, Math.max(0, numValue(task.PercentComplete, 0))),
      is_critical: boolValue(task.Critical),
      is_summary: isSummary,
      schedule_weight: extractTaskScheduleWeight(task, weightFieldIds),
    })

    if (isSummary) continue

    const links = asArray(task.PredecessorLink)
    for (const link of links) {
      const l = link as Record<string, unknown>
      const predecessorUid = numValue(l.PredecessorUID, 0)
      if (predecessorUid <= 0) continue

      dependencies.push({
        predecessor_uid: predecessorUid,
        successor_uid: uid,
        relation_type: mapLinkType(l.Type ?? l.LinkType),
        lag_duration: parseLag(l.LinkLag ?? l.Lag),
      })
    }
  }

  if (tasks.length === 0) {
    throw new Error('No tasks found in XML — export tasks from Microsoft Project as XML')
  }

  return { tasks, dependencies }
}
