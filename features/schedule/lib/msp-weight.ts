/** Stable FieldID for round-trip MSP export/import of activity weight (وزن / Number4). */
export const MSP_SCHEDULE_WEIGHT_FIELD_ID = '188743770'
export const MSP_SCHEDULE_WEIGHT_FIELD_NAME = 'وزن'

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

function numValue(value: unknown, fallback = NaN): number {
  const parsed = Number(textValue(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

const WEIGHT_NAME_EXACT =
  /^(وزن|weight|weighting|schedule\s*weight|percent\s*weight|وزن\s*دهی|وزن‌دهی|وزن دهی)$/i

function isWeightFieldName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (WEIGHT_NAME_EXACT.test(trimmed)) return true
  if (/percent|پیشرفت|progress|complete/i.test(trimmed)) return false
  // Avoid matching labels like «وزن فعالیت» when the real weight column is «وزن» (Number4).
  return false
}

function boolValue(value: unknown): boolean {
  const v = textValue(value).toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** Map MSP FieldID → weight field from project-level ExtendedAttribute definitions. */
export function resolveWeightFieldIds(project: Record<string, unknown>): Set<string> {
  const ids = new Set<string>()
  const rawDefs = asArray(
    (project.ExtendedAttributes as { ExtendedAttribute?: unknown } | undefined)?.ExtendedAttribute ??
      project.ExtendedAttributes
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
    if (labels.some((label) => isWeightFieldName(label))) {
      ids.add(fieldId)
    }
  }

  return ids
}

/**
 * When field definitions are missing, infer weight FieldID from numeric ExtendedAttributes
 * whose values sum to ~100 across leaf tasks.
 */
export function inferWeightFieldIdFromRawTasks(rawTasks: unknown[]): Set<string> {
  const ids = new Set<string>()
  const sums = new Map<string, { sum: number; count: number }>()

  for (const raw of rawTasks) {
    const task = raw as Record<string, unknown>
    if (boolValue(task.Summary)) continue

    for (const eaRaw of asArray(task.ExtendedAttribute)) {
      const ea = eaRaw as Record<string, unknown>
      const fieldId = textValue(ea.FieldID)
      const v = numValue(ea.Value)
      if (!fieldId || !Number.isFinite(v) || v < 0) continue
      const cur = sums.get(fieldId) ?? { sum: 0, count: 0 }
      cur.sum += v
      cur.count += 1
      sums.set(fieldId, cur)
    }
  }

  let bestId: string | null = null
  let bestCount = 0
  for (const [fieldId, { sum, count }] of sums) {
    if (count < 3) continue
    if (sum < 50 || sum > 200) continue
    if (count > bestCount) {
      bestId = fieldId
      bestCount = count
    }
  }

  if (bestId) ids.add(bestId)
  return ids
}

export function extractTaskScheduleWeight(
  task: Record<string, unknown>,
  weightFieldIds: Set<string>
): number | null {
  for (const raw of asArray(task.ExtendedAttribute)) {
    const ea = raw as Record<string, unknown>
    const fieldName = textValue(ea.FieldName)
    const fieldId = textValue(ea.FieldID)

    if (fieldName && isWeightFieldName(fieldName)) {
      const v = numValue(ea.Value)
      if (Number.isFinite(v)) return v
    }

    if (fieldId && weightFieldIds.has(fieldId)) {
      const v = numValue(ea.Value)
      if (Number.isFinite(v)) return v
    }
  }

  if (task.Weight != null && textValue(task.Weight)) {
    const v = numValue(task.Weight)
    if (Number.isFinite(v)) return v
  }

  return null
}
