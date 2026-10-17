/**
 * @file features/supervisor/lib/normalize-report-date.ts
 * @purpose نرمال‌سازی تاریخ گزارش از date / timestamptz
 * @safe-to-edit YES
 * @affects آرشیو و متای گزارش روزانه
 * @depends-on nothing
 */

/** Accepts `2026-10-17` or `2026-10-17T00:00:00+00:00` → `2026-10-17`. */
export function normalizeReportDate(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return normalizeReportDate(String(value))
}
