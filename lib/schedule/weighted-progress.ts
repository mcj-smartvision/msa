/**
 * Weighted project progress: Σ(progress × weight) / Σ(weight)
 *
 * MSP «وزن» in this project is stored as percent-points (e.g. 0.06, 1.85, … summing ≈ 100).
 * Do NOT multiply values ≤ 1 by 100 — that inflates tiny weights and breaks the rollup.
 */

export function normalizeScheduleWeightPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(Number(value))) return 0
  const v = Number(value)
  if (v <= 0) return 0
  return v
}

/** Normalize a full leaf-weight vector; only convert fractions→% when every value is ≤1 and sum≤1.5 */
export function normalizeScheduleWeightList(
  values: Array<number | null | undefined>
): number[] {
  const raw = values.map((v) => {
    if (v == null || !Number.isFinite(Number(v))) return 0
    const n = Number(v)
    return n > 0 ? n : 0
  })
  const positive = raw.filter((v) => v > 0)
  if (positive.length === 0) return raw.map(() => 1)
  const sum = positive.reduce((a, b) => a + b, 0)
  if (positive.every((v) => v <= 1) && sum <= 1.5) {
    return raw.map((v) => v * 100)
  }
  return raw
}

export function weightedProgressPercent(
  items: Array<{ progress: number; weight?: number | null }>,
  fallbackWeight = 1,
  /** decimal places — use 1+ for S-curve so early months are not rounded to 0 */
  precision = 0
): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const item of items) {
    const w =
      item.weight != null && Number.isFinite(item.weight) && item.weight > 0
        ? item.weight
        : fallbackWeight
    const p = Math.min(100, Math.max(0, Number(item.progress) || 0))
    totalWeight += w
    weightedSum += w * p
  }

  if (totalWeight <= 0) return 0
  const raw = weightedSum / totalWeight
  if (precision <= 0) return Math.round(raw)
  const factor = 10 ** precision
  return Math.round(raw * factor) / factor
}