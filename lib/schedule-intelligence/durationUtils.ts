/**
 * ISO 8601 duration → integer minutes.
 * Supports PT8H0M0S, PT2295H0M0S, P5D, P1DT8H0M0S
 */
export function parseIsoDurationMinutes(
  raw: unknown,
  minutesPerDay: number,
  daysPerMonth = 20
): number {
  const text = String(raw ?? '').trim().toUpperCase()
  if (!text) return 0

  const iso = text.match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i
  )
  if (!iso) {
    const n = Number(text)
    return Number.isFinite(n) ? Math.round(n) : 0
  }

  const years = Number(iso[1] ?? 0)
  const months = Number(iso[2] ?? 0)
  const weeks = Number(iso[3] ?? 0)
  const days = Number(iso[4] ?? 0)
  const hours = Number(iso[5] ?? 0)
  const mins = Number(iso[6] ?? 0)
  const secs = Number(iso[7] ?? 0)

  const dayMinutes =
    years * 365 * minutesPerDay +
    months * daysPerMonth * minutesPerDay +
    weeks * 5 * minutesPerDay +
    days * minutesPerDay

  return Math.round(dayMinutes + hours * 60 + mins + secs / 60)
}

/** MSP LinkLag is often in tenths of a minute. */
export function parseMspLagMinutes(raw: unknown, minutesPerDay: number): number {
  const text = String(raw ?? '').trim()
  if (!text) return 0
  if (text.startsWith('P') || text.startsWith('PT')) {
    return parseIsoDurationMinutes(text, minutesPerDay)
  }
  const tenths = Number(text)
  if (Number.isFinite(tenths)) return Math.round(tenths / 10)
  return 0
}

export function durationDaysFromMinutes(minutes: number, minutesPerDay: number): number {
  if (minutesPerDay <= 0) return 0
  return Math.round((minutes / minutesPerDay) * 1000) / 1000
}
