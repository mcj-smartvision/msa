import type { TaskRelationType } from '@/types/schedule'

/** MSP lag_duration is stored in minutes (LinkLag tenths ÷ 10). */
export const DEFAULT_MSP_MINUTES_PER_DAY = 480

/**
 * Format lag minutes as compact day offset for predecessor labels.
 * Examples: 960 → "+2d", -2160 → "-5d" (nearest working day at 480 min/day)
 */
export function formatLagDaysSuffix(
  lagMinutes: number,
  minutesPerDay: number = DEFAULT_MSP_MINUTES_PER_DAY
): string {
  if (!Number.isFinite(lagMinutes) || lagMinutes === 0) return ''
  const dayLen = minutesPerDay > 0 ? minutesPerDay : DEFAULT_MSP_MINUTES_PER_DAY
  const days = Math.round(lagMinutes / dayLen)
  if (days === 0) return ''
  const sign = days > 0 ? '+' : ''
  return `${sign}${days}d`
}

export function formatPredLabel(
  wbs: string,
  relation: TaskRelationType,
  lagMinutes: number,
  minutesPerDay: number = DEFAULT_MSP_MINUTES_PER_DAY
): string {
  return `${wbs}${relation}${formatLagDaysSuffix(lagMinutes, minutesPerDay)}`
}

/** Parse "1.2FS, 3.1SS+2d" style labels into predecessor WBS codes. */
export function parsePredecessorWbsCodes(label: string | null | undefined): string[] {
  return parsePredecessorLinks(label).map((link) => link.wbs)
}

export type ParsedPredecessorLink = {
  wbs: string
  relation: TaskRelationType
  lagDays: number
}

/**
 * Parse editable پیش‌نیاز text: "3FS+4d, 4.1FS, 5SS-1d"
 */
const PRED_RELATION_CYCLE: TaskRelationType[] = ['FS', 'SS', 'FF', 'SF']

export function formatPredecessorLabel(links: ParsedPredecessorLink[]): string {
  return links
    .map((link) =>
      formatPredLabel(link.wbs, link.relation, link.lagDays * DEFAULT_MSP_MINUTES_PER_DAY)
    )
    .join(', ')
}

/**
 * MSP-style click-to-link: first click adds FS; later clicks on the same WBS
 * cycle FS → SS → FF → SF and then remove.
 */
export function upsertPredecessorLink(
  current: string,
  wbs: string,
  relation: TaskRelationType = 'FS'
): string {
  const code = wbs.trim()
  if (!code) return current.trim()
  const links = parsePredecessorLinks(current)
  const index = links.findIndex((link) => link.wbs === code)
  if (index < 0) {
    return formatPredecessorLabel([...links, { wbs: code, relation, lagDays: 0 }])
  }
  const currentType = links[index]!.relation
  const typeIndex = PRED_RELATION_CYCLE.indexOf(currentType)
  if (typeIndex < 0 || typeIndex === PRED_RELATION_CYCLE.length - 1) {
    return formatPredecessorLabel(links.filter((link) => link.wbs !== code))
  }
  const nextType = PRED_RELATION_CYCLE[typeIndex + 1]!
  return formatPredecessorLabel(
    links.map((link, i) => (i === index ? { ...link, relation: nextType } : link))
  )
}

export function parsePredecessorLinks(
  label: string | null | undefined
): ParsedPredecessorLink[] {
  if (!label?.trim()) return []
  const links: ParsedPredecessorLink[] = []
  const seen = new Set<string>()
  const re =
    /([\d۰-۹٠-٩]+(?:\.[\d۰-۹٠-٩]+)*)\s*(FS|SS|FF|SF)\s*([+-]\s*\d+(?:\.\d+)?\s*d?)?/gi
  for (const match of label.matchAll(re)) {
    const wbs = toLatinDigits(match[1] ?? '').trim()
    const relation = String(match[2] ?? 'FS').toUpperCase() as TaskRelationType
    if (!wbs || !['FS', 'SS', 'FF', 'SF'].includes(relation)) continue
    const lagRaw = (match[3] ?? '').replace(/\s+/g, '').replace(/d$/i, '')
    const lagDays = lagRaw ? Number(lagRaw) : 0
    if (lagRaw && !Number.isFinite(lagDays)) continue
    const key = `${wbs}|${relation}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ wbs, relation, lagDays: Number.isFinite(lagDays) ? lagDays : 0 })
  }
  return links
}

const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC = '٠١٢٣٤٥٦٧٨٩'

function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const p = PERSIAN.indexOf(ch)
    if (p >= 0) return String(p)
    const a = ARABIC.indexOf(ch)
    return a >= 0 ? String(a) : ch
  })
}
