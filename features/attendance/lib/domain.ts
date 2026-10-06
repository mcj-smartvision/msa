import type { AttendanceTransit, PresencePerson, TransitDirection } from './types'

export class AttendanceError extends Error {
  readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION'

  constructor(code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION', message: string) {
    super(message)
    this.name = 'AttendanceError'
    this.code = code
  }
}

/** Next direction from last successful transit (null = treat as outside → IN). */
export function nextDirection(last: TransitDirection | null | undefined): TransitDirection {
  return last === 'IN' ? 'OUT' : 'IN'
}

export function startOfLocalDayIso(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function endOfLocalDayIso(date = new Date()): string {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Sum of outside intervals (OUT → next IN) within the day; open OUT until `now` if still out. */
export function computeOutsideMs(
  orderedAsc: Array<{ direction: TransitDirection; occurredAt: string }>,
  nowMs = Date.now()
): number {
  let outsideMs = 0
  let outAt: number | null = null

  for (const t of orderedAsc) {
    const ts = new Date(t.occurredAt).getTime()
    if (Number.isNaN(ts)) continue
    if (t.direction === 'OUT') {
      outAt = ts
    } else if (t.direction === 'IN' && outAt != null) {
      outsideMs += Math.max(0, ts - outAt)
      outAt = null
    }
  }

  if (outAt != null) {
    outsideMs += Math.max(0, nowMs - outAt)
  }

  return outsideMs
}

export function formatDurationFa(ms: number): string {
  if (ms <= 0) return '۰ دقیقه'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m} دقیقه`
  if (m <= 0) return `${h} ساعت`
  return `${h} ساعت و ${m} دقیقه`
}

type MemberSeed = {
  userId: string
  fullName: string
  email: string | null
  personnelCode?: string | null
}

/**
 * Build presence rows for all active members from today's successful transits.
 * Status:
 * - inside: last successful direction is IN
 * - outside: had at least one transit today and last is OUT
 * - absent: no successful transit today
 */
export function buildPresence(
  members: MemberSeed[],
  successfulTodayAsc: AttendanceTransit[],
  nowMs = Date.now()
): PresencePerson[] {
  const byUser = new Map<string, AttendanceTransit[]>()
  for (const t of successfulTodayAsc) {
    if (!t.userId) continue
    const list = byUser.get(t.userId) ?? []
    list.push(t)
    byUser.set(t.userId, list)
  }

  return members.map((m) => {
    const list = byUser.get(m.userId) ?? []
    const last = list.length > 0 ? list[list.length - 1] : null
    const firstIn = list.find((t) => t.direction === 'IN') ?? null
    const lastOut = [...list].reverse().find((t) => t.direction === 'OUT') ?? null

    let status: PresencePerson['status'] = 'absent'
    if (last?.direction === 'IN') status = 'inside'
    else if (list.length > 0) status = 'outside'

    return {
      userId: m.userId,
      fullName: m.fullName,
      email: m.email,
      personnelCode: m.personnelCode ?? null,
      status,
      lastDirection: last?.direction ?? null,
      lastTransitAt: last?.occurredAt ?? null,
      officialEntryAt: firstIn?.occurredAt ?? null,
      officialExitAt: status === 'outside' ? lastOut?.occurredAt ?? null : null,
      outsideMsToday: computeOutsideMs(
        list.map((t) => ({ direction: t.direction, occurredAt: t.occurredAt })),
        nowMs
      ),
      transitCountToday: list.length,
    }
  })
}
