/**
 * @file features/site-report/lib/lines.ts
 * @purpose تبدیل textarea چندخطی ↔ آرایهٔ رشته
 * @safe-to-edit YES
 * @affects features/site-report/components
 * @depends-on nothing
 */

export function linesToText(lines: string[]): string {
  return lines.join('\n')
}

export function textToLines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseNum(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
