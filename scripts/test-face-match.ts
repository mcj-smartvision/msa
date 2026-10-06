/**
 * Quick unit checks for biometric match (no network).
 * Run: npx tsx scripts/test-face-match.ts
 */
import {
  averageEmbeddings,
  euclideanDistance,
  l2Normalize,
  matchEmbedding,
} from '../features/attendance/lib/face-match'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function makeVec(seed: number): number[] {
  const v = Array.from({ length: 128 }, (_, i) => Math.sin(seed * 17 + i * 0.37))
  return l2Normalize(v)
}

const a = makeVec(1)
const aNoise = l2Normalize(a.map((x, i) => x + (i % 5 === 0 ? 0.01 : 0)))
const b = makeVec(99)

assert(euclideanDistance(a, a) < 1e-6, 'identical distance')
assert(euclideanDistance(a, aNoise) < 0.2, 'near twin should be close')
assert(euclideanDistance(a, b) > 0.5, 'different people should be far')

const avg = averageEmbeddings([a, aNoise])
assert(avg.length === 128, 'avg dim')

const hit = matchEmbedding(aNoise, [
  { userId: 'u1', personName: 'Alice', embedding: a },
  { userId: 'u2', personName: 'Bob', embedding: b },
])
assert(hit.userId === 'u1', `expected Alice, got ${hit.userId} (${hit.reason})`)

const ambiguous = matchEmbedding(a, [
  { userId: 'u1', personName: 'Alice', embedding: a },
  { userId: 'u2', personName: 'AliceTwin', embedding: aNoise },
])
assert(ambiguous.userId === null, `expected reject on ambiguity, got ${ambiguous.userId}`)
assert(ambiguous.reason.includes('ambiguous') || ambiguous.reason.includes('below'), ambiguous.reason)

console.log('face-match tests OK')
