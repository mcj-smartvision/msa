/**
 * Server-side biometric match for FaceNet-style descriptors.
 * Same pattern used by commercial gate terminals:
 * detect → embed → 1:N distance → absolute threshold + ambiguity margin.
 */

export const FACE_EMBEDDING_MODEL = 'facenet-128-vladmandic'
export const FACE_EMBEDDING_DIM = 128

/** Euclidean distance must be below this to accept (stricter = fewer false IDs). */
export const FACE_MATCH_MAX_DISTANCE = 0.48

/**
 * Winner must beat 2nd place by at least this margin.
 * Prevents swapping lookalikes / the same two people.
 */
export const FACE_MATCH_MIN_MARGIN = 0.06

export type EmbeddingGalleryItem = {
  userId: string
  personName: string
  embedding: number[]
}

export type EmbeddingMatchResult = {
  userId: string | null
  /** 0–1 score derived from distance (higher = better) */
  confidence: number
  distance: number
  margin: number
  reason: string
}

export function isValidEmbedding(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length === FACE_EMBEDDING_DIM &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

export function l2Normalize(vec: number[]): number[] {
  let sum = 0
  for (const n of vec) sum += n * n
  const norm = Math.sqrt(sum)
  if (norm < 1e-8) return vec.map(() => 0)
  return vec.map((n) => n / norm)
}

/** Average several descriptors then L2-normalize (multi-sample enroll). */
export function averageEmbeddings(samples: number[][]): number[] {
  if (samples.length === 0) throw new Error('no_embedding_samples')
  const dim = samples[0].length
  const acc = new Array(dim).fill(0)
  for (const s of samples) {
    if (s.length !== dim) throw new Error('embedding_dim_mismatch')
    for (let i = 0; i < dim; i++) acc[i] += s[i]
  }
  for (let i = 0; i < dim; i++) acc[i] /= samples.length
  return l2Normalize(acc)
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

function distanceToConfidence(distance: number, maxDistance = FACE_MATCH_MAX_DISTANCE): number {
  if (distance >= maxDistance) return Math.max(0, 1 - distance)
  return Math.min(1, Math.max(0, 1 - distance / maxDistance) * 0.35 + 0.65)
}

/**
 * Open-set 1:N identification with absolute threshold + relative margin.
 */
export function matchEmbedding(
  live: number[],
  gallery: EmbeddingGalleryItem[],
  options?: {
    maxDistance?: number
    minMargin?: number
  }
): EmbeddingMatchResult {
  const maxDistance = options?.maxDistance ?? FACE_MATCH_MAX_DISTANCE
  const minMargin = options?.minMargin ?? FACE_MATCH_MIN_MARGIN

  if (!isValidEmbedding(live)) {
    return { userId: null, confidence: 0, distance: 1, margin: 0, reason: 'invalid_live_embedding' }
  }
  if (gallery.length === 0) {
    return { userId: null, confidence: 0, distance: 1, margin: 0, reason: 'no_enrollments' }
  }

  const ranked = gallery
    .filter((g) => isValidEmbedding(g.embedding))
    .map((g) => ({
      userId: g.userId,
      personName: g.personName,
      distance: euclideanDistance(live, g.embedding),
    }))
    .sort((a, b) => a.distance - b.distance)

  if (ranked.length === 0) {
    return { userId: null, confidence: 0, distance: 1, margin: 0, reason: 'no_biometric_enrollments' }
  }

  const best = ranked[0]
  const second = ranked[1]
  const margin = second ? second.distance - best.distance : 1

  if (best.distance > maxDistance) {
    return {
      userId: null,
      confidence: distanceToConfidence(best.distance, maxDistance),
      distance: best.distance,
      margin,
      reason: `below_threshold dist=${best.distance.toFixed(3)}`,
    }
  }

  if (second && margin < minMargin) {
    return {
      userId: null,
      confidence: distanceToConfidence(best.distance, maxDistance),
      distance: best.distance,
      margin,
      reason: `ambiguous_top2 margin=${margin.toFixed(3)} (${best.personName} vs ${second.personName})`,
    }
  }

  return {
    userId: best.userId,
    confidence: distanceToConfidence(best.distance, maxDistance),
    distance: best.distance,
    margin,
    reason: `match dist=${best.distance.toFixed(3)} margin=${margin.toFixed(3)}`,
  }
}
