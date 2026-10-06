import type { DailyReportAiParsed } from '@/shared/types/schedule'

/**
 * Stub AI parser — replace with OpenAI / Edge Function call.
 * Returns structured JSON from free-text daily report.
 */
export async function parseDailyReportText(rawText: string): Promise<DailyReportAiParsed> {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  return {
    summary: lines[0]?.slice(0, 200) ?? 'No summary extracted.',
    tasks: [],
    issues: lines.filter((l) => /issue|problem|خراب|مشکل/i.test(l)),
    risks: lines.filter((l) => /risk|delay|تأخیر|خطر/i.test(l)),
    materials: [],
  }
}
