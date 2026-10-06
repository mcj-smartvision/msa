/**
 * Pure domain checks for attendance presence math.
 * Run: npx tsx scripts/test-attendance-domain.ts
 */
import {
  buildPresence,
  computeOutsideMs,
  nextDirection,
} from '../features/attendance/lib/domain'
import type { AttendanceTransit } from '../features/attendance/lib/types'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(nextDirection(null) === 'IN', 'null -> IN')
assert(nextDirection('OUT') === 'IN', 'OUT -> IN')
assert(nextDirection('IN') === 'OUT', 'IN -> OUT')

const base = Date.parse('2026-07-21T08:00:00.000Z')
const outside = computeOutsideMs(
  [
    { direction: 'IN', occurredAt: new Date(base).toISOString() },
    { direction: 'OUT', occurredAt: new Date(base + 4 * 3600000).toISOString() },
    { direction: 'IN', occurredAt: new Date(base + 5 * 3600000).toISOString() },
  ],
  base + 6 * 3600000
)
assert(outside === 3600000, `outside should be 1h, got ${outside}`)

const transits: AttendanceTransit[] = [
  {
    id: '1',
    projectId: 'p',
    userId: 'u1',
    gateId: null,
    direction: 'IN',
    source: 'manual_guard',
    identificationStatus: 'success',
    personName: 'Ali',
    personEmail: 'a@x.com',
    personnelCode: '100',
    occurredAt: new Date(base).toISOString(),
    recordedBy: null,
    notes: null,
    emailStatus: 'sent',
    emailSentAt: null,
    emailError: null,
  },
]

const presence = buildPresence(
  [
    { userId: 'u1', fullName: 'Ali', email: 'a@x.com' },
    { userId: 'u2', fullName: 'Sara', email: null },
  ],
  transits,
  base + 1000
)

assert(presence.find((p) => p.userId === 'u1')?.status === 'inside', 'Ali inside')
assert(presence.find((p) => p.userId === 'u2')?.status === 'absent', 'Sara absent')

console.log('attendance domain tests: OK')
