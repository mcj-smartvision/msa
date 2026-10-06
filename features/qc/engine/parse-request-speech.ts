import { isQcActivityType, matchQcActivity, QC_ACTIVITY_FA, QC_ACTIVITY_META, QC_ACTIVITY_RULES, QC_ACTIVITY_TYPES, type QcActivityType } from '@/features/qc/engine/activity-types'

export type QcSpeechItem = {
  topic: string | null
  floor: string | null
  activityType: QcActivityType | null
  code: string | null
  elementType: string | null
  discipline: string | null
  gridX: string | null
  gridY: string | null
  gridFrom: string | null
  gridTo: string | null
}

export type ParsedQcRequestSpeech = QcSpeechItem & {
  transcript: string
  summary: string
  items: QcSpeechItem[]
}

const ELEMENT_RULES: { value: string; pattern: RegExp }[] = [
  { value: 'ستون', pattern: /ستون|column/i },
  { value: 'تیر', pattern: /تیر(?!چه)|beam/i },
  { value: 'دیوار', pattern: /دیوار|wall/i },
  { value: 'سقف', pattern: /سقف|slab|roof slab/i },
  { value: 'فونداسیون', pattern: /فونداسیون|پی|foundation/i },
  { value: 'راه پله', pattern: /راه.?پله|staircase/i },
]

const DISCIPLINE_RULES: { value: string; pattern: RegExp }[] = [
  { value: 'سازه', pattern: /سازه|structur/i },
  { value: 'معماری', pattern: /معمار|architect/i },
  { value: 'برق', pattern: /برق|electr/i },
  { value: 'مکانیک', pattern: /مکانیک|تاسیسات|تأسیسات|mechanical|hvac/i },
]

const FA_FLOOR_WORDS: { value: string; pattern: RegExp }[] = [
  { value: 'همکف', pattern: /همکف|طبقه\s*صفر|ground/i },
  { value: 'بام', pattern: /بام|خرپشته/i },
  { value: 'منفی یک', pattern: /منفی\s*یک|زیرزمین(?:\s*اول)?|طبقه\s*-1/i },
  { value: 'منفی دو', pattern: /منفی\s*دو|زیرزمین\s*دوم|طبقه\s*-2/i },
  { value: 'دهم', pattern: /طبقه\s*(دهم|ده|10)/i },
  { value: 'اول', pattern: /طبقه\s*(اول|یکم|یک|1)(?!\d)/i },
  { value: 'دوم', pattern: /طبقه\s*(دوم|دو|2)(?!\d)/i },
  { value: 'سوم', pattern: /طبقه\s*(سوم|سه|3)(?!\d)/i },
  { value: 'چهارم', pattern: /طبقه\s*(چهارم|چهار|4)(?!\d)/i },
  { value: 'پنجم', pattern: /طبقه\s*(پنجم|پنج|5)(?!\d)/i },
  { value: 'ششم', pattern: /طبقه\s*(ششم|شش|6)(?!\d)/i },
  { value: 'هفتم', pattern: /طبقه\s*(هفتم|هفت|7)(?!\d)/i },
  { value: 'هشتم', pattern: /طبقه\s*(هشتم|هشت|8)(?!\d)/i },
  { value: 'نهم', pattern: /طبقه\s*(نهم|نه|9)(?!\d)/i },
]

const FLOOR_TOKEN =
  '(?:همکف|بام|خرپشته|منفی\\s*(?:یک|دو|1|2)|زیرزمین(?:\\s*(?:اول|دوم))?|دهم|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|یکم|ده|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|10|-?\\d+)'

const FILLER =
  /سلام|خسته نباشید|لطفاً?|خواهشاً?|می‌خوام|ميخوام|میخوام|بفرست|ثبت کن(?:ید)?|درخواست(?:\s*بازرسی)?|برای من|اینکه|این که|کنترل کیفیت/gi

/** Future work mentioned only as deadline/context — not a separate inspection. */
const PREP_BEFORE_WORK =
  /قبل\s+از\s+بتن|پیش\s+از\s+بتن|تا\s+تاریخ\s+بتن|قبل\s+تاریخ\s+بتن|قبل\s+از\s+تاریخ\s+بتن|before\s+concrete/i

const EXPLICIT_MULTI =
  /(?:^|\s)(?:همچنین|به علاوه|و همچنین|مورد بعدی|درخواست\s+دیگر|یک\s+درخواست\s+دیگر|موضوع\s+دیگر)/i

const NUMBERED_ITEM = /(?:^|\n)\s*\d+[).\-]\s+/

export function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
}

function firstMatch(text: string, rules: { value: string; pattern: RegExp }[]) {
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.value
  }
  return null
}

function parseFloor(text: string) {
  const labeled = text.match(/طبقه\s*[:.]?\s*(همکف|بام|منفی\s*\d+|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|-?\d+)/i)
  if (labeled?.[1]) {
    const value = labeled[1].replace(/\s+/g, ' ').trim()
    return firstMatch(`طبقه ${value}`, FA_FLOOR_WORDS) || value
  }
  return firstMatch(text, FA_FLOOR_WORDS)
}

function normalizeFloorToken(token: string) {
  const value = token.replace(/\s+/g, ' ').trim()
  return firstMatch(`طبقه ${value}`, FA_FLOOR_WORDS) || value
}

const FA_FLOOR_ORDER = ['منفی دو', 'منفی یک', 'همکف', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم', 'بام']

function expandFloorSpan(from: string, to: string) {
  const start = FA_FLOOR_ORDER.indexOf(from)
  const end = FA_FLOOR_ORDER.indexOf(to)
  if (start >= 0 && end >= 0) {
    const [a, b] = start <= end ? [start, end] : [end, start]
    return FA_FLOOR_ORDER.slice(a, b + 1)
  }
  return [...new Set([from, to].filter(Boolean))]
}

function parseAllFloors(text: string): string[] {
  const floors: string[] = []
  const push = (floor: string) => {
    if (floor && floor.length > 1 && !floors.includes(floor)) floors.push(floor)
  }
  const re = new RegExp(
    `طبقه\\s*[:.]?\\s*(${FLOOR_TOKEN}(?:\\s*(?:،|,|تا|\\s+و\\s+)\\s*(?:طبقه\\s*)?${FLOOR_TOKEN})*)`,
    'gi'
  )
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const group = match[1].replace(/\s*طبقه\s*/g, ' ')
    if (/\sتا\s/.test(group) && !/(?:،|,|\sو\s)/.test(group)) {
      const [from, to] = group.split(/\s*تا\s*/).map(normalizeFloorToken)
      if (from && to) expandFloorSpan(from, to).forEach(push)
      else if (from) push(from)
      continue
    }
    for (const part of group.split(/\s*(?:،|,|\s+و\s+)\s*/)) {
      push(normalizeFloorToken(part))
    }
  }
  if (floors.length) return floors
  const one = parseFloor(text)
  return one ? [one] : []
}

function parseCode(text: string) {
  const labeled = text.match(/(?:کد|مورد|آیتم)\s*[:.\s]*([A-Za-z]{1,4}\d{0,3}[-/]?[A-Za-z0-9]{1,8})/i)
  if (labeled?.[1]) return labeled[1].toUpperCase()
  const standard = text.match(/\b([A-Z]{1,3}\d{0,2}[-/][A-Z0-9]{1,8})\b/i)
  if (standard?.[1]) return standard[1].toUpperCase()
  const elementCode = text.match(/(?:ستون|تیر|دیوار)\s*([A-Za-z]\d{1,3}(?:[-/][A-Za-z0-9]{1,6})?)/i)
  if (elementCode?.[1]) return elementCode[1].toUpperCase()
  return null
}

function parseGrid(text: string) {
  const range = text.match(/محور\s*([A-Za-z0-9]+)\s*تا\s*([A-Za-z0-9]+)/i)
  if (range) {
    return {
      gridFrom: range[1].toUpperCase(),
      gridTo: range[2].toUpperCase(),
      gridX: range[1].toUpperCase(),
      gridY: range[2].toUpperCase(),
    }
  }
  const pair = text.match(/محور\s*([A-Za-z])\s*(?:و|,|\/)?\s*(\d+)/i)
  if (pair) {
    return { gridX: pair[1].toUpperCase(), gridY: pair[2], gridFrom: null, gridTo: null }
  }
  const single = text.match(/محور\s*([A-Za-z0-9]+)/i)
  if (single) {
    return { gridX: single[1].toUpperCase(), gridY: null, gridFrom: null, gridTo: null }
  }
  return { gridX: null, gridY: null, gridFrom: null, gridTo: null }
}

function parseTopic(text: string, activityTopic: string | null) {
  const labeled = text.match(/موضوع\s*[:.]?\s*(.+?)(?:\s+طبقه|\s+محور|$)/i)
  if (labeled?.[1]) {
    const value = labeled[1].replace(FILLER, ' ').replace(/\s+/g, ' ').trim()
    if (value) return value
  }
  if (/اتصالات?/.test(text) && /تیر/.test(text) && /ستون/.test(text)) {
    return 'بررسی اتصالات تیر به ستون'
  }
  if (/جوش/.test(text) && /اتصالات?/.test(text)) return 'بررسی جوش اتصالات'
  if (/اتصالات?/.test(text)) return 'بررسی اتصالات'
  const cleaned = text
    .replace(FILLER, ' ')
    .replace(/طبقه\s*[:.]?\s*\S+(?:\s*(?:و|،|,|تا)\s*(?:طبقه\s*)?\S+)*/gi, ' ')
    .replace(/محور\s+\S+(?:\s+تا\s+\S+)?/gi, ' ')
    .replace(/(?:نوع فعالیت|activity(?:\s*type)?)\s*[:：]?\s*\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned && cleaned.length <= 90 && cleaned !== activityTopic) return cleaned
  if (activityTopic) return activityTopic
  return cleaned || null
}

function emptyItem(): QcSpeechItem {
  return {
    topic: null,
    floor: null,
    activityType: null,
    code: null,
    elementType: null,
    discipline: null,
    gridX: null,
    gridY: null,
    gridFrom: null,
    gridTo: null,
  }
}

function itemHasContent(item: QcSpeechItem) {
  return Boolean(
    item.topic ||
      item.floor ||
      item.activityType ||
      item.code ||
      item.elementType ||
      item.discipline ||
      item.gridX ||
      item.gridY ||
      item.gridFrom ||
      item.gridTo
  )
}

function uniqueJoin(values: (string | null | undefined)[], separator: string) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].join(separator) || null
}

function parseActivityType(text: string): QcActivityType | null {
  const labeled = text.match(/(?:نوع فعالیت|activity(?:\s*type)?)\s*[:：]\s*(.+)/i)
  if (labeled?.[1]) {
    const value = labeled[1].trim()
    if (isQcActivityType(value)) return value
    const fromFa = QC_ACTIVITY_RULES.find((rule) => rule.topic === value || rule.pattern.test(value))
    if (fromFa) return fromFa.key
  }
  return matchQcActivity(text)
}

function parseOneItem(text: string): QcSpeechItem {
  const activityType = parseActivityType(text)
  const activityTopic = activityType ? QC_ACTIVITY_FA[activityType] : null
  const grid = parseGrid(text)
  return {
    topic: parseTopic(text, activityTopic),
    floor: parseFloor(text),
    activityType,
    code: parseCode(text),
    elementType: firstMatch(text, ELEMENT_RULES),
    discipline: firstMatch(text, DISCIPLINE_RULES),
    gridX: grid.gridX,
    gridY: grid.gridY,
    gridFrom: grid.gridFrom,
    gridTo: grid.gridTo,
  }
}

function activityKeywordAt(text: string, index: number): QcActivityType | null {
  const slice = text.slice(index)
  for (const key of QC_ACTIVITY_TYPES) {
    const pattern = QC_ACTIVITY_META[key].pattern
    pattern.lastIndex = 0
    const match = pattern.exec(slice)
    if (match && match.index === 0) return key
  }
  return null
}

function isContextualFutureWork(text: string, index: number, activity: QcActivityType | null): boolean {
  if (!activity) return false
  if (activity !== 'concrete_pour' && activity !== 'formwork') return false
  const window = text.slice(Math.max(0, index - 55), Math.min(text.length, index + 30))
  return PREP_BEFORE_WORK.test(window) || /قبل\s+از/.test(text.slice(Math.max(0, index - 25), index))
}

function splitByActivityKeywords(text: string): string[] {
  if (!EXPLICIT_MULTI.test(text) && !NUMBERED_ITEM.test(text)) {
    const primary = parseActivityType(text)
    if (primary && PREP_BEFORE_WORK.test(text)) {
      return [text]
    }
  }

  const alt = QC_ACTIVITY_RULES.map((rule) => rule.pattern.source).join('|')
  const re = new RegExp(`(?:${alt})`, 'gi')
  const hits: number[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const last = hits[hits.length - 1]
    if (last != null && match.index - last < 3) continue
    const activity = activityKeywordAt(text, match.index)
    if (isContextualFutureWork(text, match.index, activity)) continue
    hits.push(match.index)
  }
  if (hits.length < 2) return [text]
  const parts: string[] = []
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i]
    const end = i + 1 < hits.length ? hits[i + 1] : text.length
    const prefix = i === 0 ? text.slice(0, start).trim() : ''
    const chunk = `${prefix} ${text.slice(start, end)}`.trim()
    if (chunk) parts.push(chunk)
  }
  return parts.length ? parts : [text]
}

function splitTranscript(text: string): string[] {
  const numbered = text
    .split(/(?:^|\n)\s*\d+[).\-]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (numbered.length > 1) return numbered

  const byAlso = text
    .split(/\s*(?:همچنین|به علاوه|و همچنین|مورد بعدی)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
  if (byAlso.length > 1) return byAlso

  const byActivity = splitByActivityKeywords(text)
  if (byActivity.length > 1) return byActivity

  return [text]
}

function expandByFloors(item: QcSpeechItem, text: string): QcSpeechItem[] {
  const labeledFloors = item.floor ? parseAllFloors(`طبقه ${item.floor}`) : []
  const floors = labeledFloors.length > 1 ? labeledFloors : parseAllFloors(text)
  if (floors.length <= 1) return [{ ...item, floor: floors[0] ?? item.floor }]
  return floors.map((floor) => ({ ...item, floor }))
}

/** Merge items that describe one inspection (e.g. rebar check before concrete pour). */
export function consolidateInspectionItems(items: QcSpeechItem[], transcript: string): QcSpeechItem[] {
  const filled = items.filter(itemHasContent)
  if (filled.length <= 1) return filled

  const text = transcript.trim()
  const prepBeforeConcrete = PREP_BEFORE_WORK.test(text)

  if (prepBeforeConcrete) {
    const primaryTypes = new Set(['rebar', 'formwork', 'welding', 'steel_erection', 'bolting'])
    const primary = filled.find((item) => item.activityType && primaryTypes.has(item.activityType))
    const hasConcreteOnly = filled.some((item) => item.activityType === 'concrete_pour')
    if (primary && hasConcreteOnly) {
      const floors = [...new Set(filled.map((item) => item.floor).filter(Boolean))]
      if (floors.length <= 1) {
        const merged: QcSpeechItem = { ...primary }
        merged.topic = preferTopic(
          primary.topic,
          filled
            .filter((item) => item.activityType !== 'concrete_pour')
            .map((item) => item.topic)
            .join('؛ ')
        )
        merged.floor = merged.floor || floors[0] || null
        for (const item of filled) {
          if (item.elementType && !merged.elementType) merged.elementType = item.elementType
          if (item.discipline && !merged.discipline) merged.discipline = item.discipline
        }
        return [merged]
      }
    }
  }

  if (!EXPLICIT_MULTI.test(text) && !NUMBERED_ITEM.test(text)) {
    const floors = [...new Set(filled.map((item) => item.floor).filter(Boolean))]
    const activities = [...new Set(filled.map((item) => item.activityType).filter(Boolean))]
    if (floors.length <= 1 && activities.length > 1 && prepBeforeConcrete) {
      const primary = filled.find((item) => item.activityType === 'rebar') ?? filled[0]
      return [mergeItem(primary, filled.find((item) => item !== primary) ?? emptyItem())]
    }
  }

  return filled
}

export function formatSpeechSummary(parsed: Partial<QcSpeechItem> & { items?: QcSpeechItem[] }) {
  const items = (parsed.items?.length ? parsed.items : [parsed as QcSpeechItem]).filter(itemHasContent)
  if (!items.length) return ''
  return items
    .map((item, index) => {
      const lines: string[] = []
      if (item.topic) lines.push(`موضوع: ${item.topic}`)
      if (item.floor) lines.push(`طبقه: ${item.floor}`)
      if (item.elementType) lines.push(`عنصر: ${item.elementType}`)
      if (item.discipline) lines.push(`رشته: ${item.discipline}`)
      if (item.activityType) lines.push(`نوع فعالیت: ${QC_ACTIVITY_FA[item.activityType]}`)
      if (item.code) lines.push(`مورد: ${item.code}`)
      if (item.gridFrom && item.gridTo) lines.push(`محور: ${item.gridFrom} تا ${item.gridTo}`)
      else {
        if (item.gridX) lines.push(`محور افقی: ${item.gridX}`)
        if (item.gridY) lines.push(`محور عمودی: ${item.gridY}`)
      }
      if (!lines.length) return ''
      if (items.length === 1) return lines.join('\n')
      return `${index + 1}) ${lines.join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')
}

export function parsedFromItems(items: QcSpeechItem[], transcript: string): ParsedQcRequestSpeech {
  const consolidated = consolidateInspectionItems(items, transcript)
  const filled = consolidated.filter(itemHasContent)
  const first = filled[0] ?? emptyItem()
  const rangeItem = filled.find((item) => item.gridFrom && item.gridTo)
  const parsed: ParsedQcRequestSpeech = {
    transcript,
    summary: '',
    items: filled.length ? filled : [],
    activityType: filled.find((item) => item.activityType)?.activityType ?? null,
    topic: uniqueJoin(filled.map((item) => item.topic), '؛ '),
    floor: uniqueJoin(filled.map((item) => item.floor), '، '),
    code: uniqueJoin(filled.map((item) => item.code), '، '),
    elementType: uniqueJoin(filled.map((item) => item.elementType), '، '),
    discipline: uniqueJoin(filled.map((item) => item.discipline), '، '),
    gridX: rangeItem?.gridX ?? filled.find((item) => item.gridX)?.gridX ?? first.gridX,
    gridY: rangeItem?.gridY ?? filled.find((item) => item.gridY)?.gridY ?? first.gridY,
    gridFrom: rangeItem?.gridFrom ?? first.gridFrom,
    gridTo: rangeItem?.gridTo ?? first.gridTo,
  }
  parsed.summary = formatSpeechSummary(parsed)
  return parsed
}

function readLabeledValue(block: string, labels: string[]) {
  const alt = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const re = new RegExp(`(?:^|\\n)\\s*(?:${alt})\\s*[:：]\\s*(.+)`, 'i')
  const match = block.match(re)
  return match?.[1]?.trim() || null
}

function parseLabeledBlock(block: string): QcSpeechItem {
  const topic = readLabeledValue(block, ['موضوع', 'topic'])
  const floor = readLabeledValue(block, ['طبقه', 'floor'])
  const elementType = readLabeledValue(block, ['عنصر', 'element'])
  const discipline = readLabeledValue(block, ['رشته', 'discipline'])
  const code = readLabeledValue(block, ['مورد', 'کد', 'code', 'item'])
  const activityRaw = readLabeledValue(block, ['نوع فعالیت', 'activity type', 'activity'])
  const gridX = readLabeledValue(block, ['محور افقی', 'grid x'])
  const gridY = readLabeledValue(block, ['محور عمودی', 'grid y'])
  const axis = readLabeledValue(block, ['محور'])
  let gridFrom: string | null = null
  let gridTo: string | null = null
  let nextGridX = gridX
  let nextGridY = gridY
  if (axis) {
    const range = axis.match(/([A-Za-z0-9]+)\s*تا\s*([A-Za-z0-9]+)/i)
    if (range) {
      gridFrom = range[1].toUpperCase()
      gridTo = range[2].toUpperCase()
      nextGridX = nextGridX || gridFrom
      nextGridY = nextGridY || gridTo
    }
  }
  const activityType = activityRaw
    ? isQcActivityType(activityRaw)
      ? activityRaw
      : QC_ACTIVITY_RULES.find((rule) => rule.topic === activityRaw || rule.pattern.test(activityRaw))?.key ?? null
    : parseActivityType(block)
  const labeled: QcSpeechItem = {
    topic,
    floor: floor ? normalizeFloorToken(floor) : null,
    activityType,
    code: code ? code.toUpperCase() : null,
    elementType,
    discipline,
    gridX: nextGridX,
    gridY: nextGridY,
    gridFrom,
    gridTo,
  }
  return mergeItem(parseOneItem(block), labeled)
}

export function parseAiClassifiedText(text: string): ParsedQcRequestSpeech {
  const trimmed = toLatinDigits(text.trim())
  if (!trimmed) return parsedFromItems([], '')
  const looksLabeled = /(?:موضوع|طبقه|عنصر|رشته|مورد|نوع فعالیت|topic|floor)\s*[:：]/.test(trimmed)
  if (looksLabeled) {
    const blocks = trimmed
      .split(/\n\s*\n|(?:^|\n)\s*\d+[).]\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
    const items = blocks.flatMap((block) => expandByFloors(parseLabeledBlock(block), block)).filter(itemHasContent)
    if (items.length) return parsedFromItems(items, trimmed)
  }
  return parseRequestSpeech(trimmed)
}

export function parseRequestSpeech(transcript: string): ParsedQcRequestSpeech {
  const text = toLatinDigits(transcript.trim())
  if (!text) return parsedFromItems([], '')
  const items: QcSpeechItem[] = []
  for (const segment of splitTranscript(text)) {
    items.push(...expandByFloors(parseOneItem(segment), segment))
  }
  return parsedFromItems(items, text)
}

function preferTopic(base: string | null, extra: string | null) {
  const next = extra?.trim() || ''
  const prev = base?.trim() || ''
  if (!next) return prev || null
  if (!prev) return next
  const extraIsActivity = Object.values(QC_ACTIVITY_FA).includes(next)
  const prevIsActivity = Object.values(QC_ACTIVITY_FA).includes(prev)
  if (extraIsActivity && !prevIsActivity) return prev
  if (prev.length > next.length + 4 && prev.includes(next)) return prev
  return next
}

function mergeItem(base: QcSpeechItem, extra: Partial<QcSpeechItem> | null | undefined): QcSpeechItem {
  if (!extra) return { ...base }
  const activityType =
    extra.activityType && isQcActivityType(extra.activityType) ? extra.activityType : base.activityType
  return {
    topic: preferTopic(base.topic, extra.topic ?? null),
    floor: extra.floor?.trim() || base.floor,
    activityType,
    code: extra.code?.trim() || base.code,
    elementType: extra.elementType?.trim() || base.elementType,
    discipline: extra.discipline?.trim() || base.discipline,
    gridX: extra.gridX?.trim() || base.gridX,
    gridY: extra.gridY?.trim() || base.gridY,
    gridFrom: extra.gridFrom?.trim() || base.gridFrom,
    gridTo: extra.gridTo?.trim() || base.gridTo,
  }
}

function itemsFromPartial(extra: Partial<ParsedQcRequestSpeech>): QcSpeechItem[] {
  if (Array.isArray(extra.items) && extra.items.length) {
    return extra.items.map((item) => mergeItem(emptyItem(), item)).filter(itemHasContent)
  }
  const single = mergeItem(emptyItem(), extra)
  return itemHasContent(single) ? [single] : []
}

export function mergeParsedSpeech(
  base: ParsedQcRequestSpeech,
  extra: Partial<ParsedQcRequestSpeech> | null | undefined
): ParsedQcRequestSpeech {
  if (!extra) return { ...base, summary: formatSpeechSummary(base) }
  const extraItems = itemsFromPartial(extra)
  const count = Math.max(base.items.length, extraItems.length)
  const items = Array.from({ length: count }, (_, index) =>
    mergeItem(base.items[index] ?? emptyItem(), extraItems[index])
  ).filter(itemHasContent)
  const merged = parsedFromItems(items.length ? items : base.items, extra.transcript?.trim() || base.transcript)
  merged.summary = formatSpeechSummary(merged)
  return merged
}

export function speechItemCode(item: QcSpeechItem, index: number, used: Set<string>) {
  const raw = item.code?.trim()
  const fallback =
    [
      item.floor,
      item.elementType,
      item.gridFrom && item.gridTo ? `${item.gridFrom}-${item.gridTo}` : [item.gridX, item.gridY].filter(Boolean).join('-'),
      item.activityType,
    ]
      .filter(Boolean)
      .join('-') || `ITEM-${index + 1}`
  let code = (raw || fallback).replace(/\s+/g, '')
  if (!used.has(code.toUpperCase())) {
    used.add(code.toUpperCase())
    return code
  }
  let n = 2
  while (used.has(`${code}-${n}`.toUpperCase())) n += 1
  const next = `${code}-${n}`
  used.add(next.toUpperCase())
  return next
}
