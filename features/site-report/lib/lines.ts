/**
 * @file features/site-report/lib/lines.ts
 * @purpose تبدیل textarea چندخطی ↔ آرایهٔ رشته
 * @safe-to-edit YES
 * @affects features/site-report/components
 * @depends-on nothing
 */

/** Join lines for a controlled textarea (preserves trailing empty line). */
export function linesToText(lines: string[]): string {
  return lines.join('\n')
}

/**
 * Split textarea value into lines while typing.
 * Do not trim/filter — that eats spaces and blocks new lines.
 */
export function textToLines(text: string): string[] {
  return text.split('\n')
}

/** Drop blank lines when serializing for AI / archive (not while typing). */
export function normalizeLines(lines: string[]): string[] {
  return lines.map((s) => s.trim()).filter((s) => s.length > 0)
}

export function parseNum(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Keep spaces while typing; only empty string becomes null. */
export function optionalText(value: string): string | null {
  return value === '' ? null : value
}
