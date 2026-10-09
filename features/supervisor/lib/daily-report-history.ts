import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { formatScheduleDate } from '@/features/schedule/lib/dates'

export type DayReport = {
  reportDate: string
  savedAt: string | null
  note: string
  entries: DailyProgressEntry[]
}

export function buildDayReports(
  entries: DailyProgressEntry[],
  notesByDate: Record<string, string>
): DayReport[] {
  const byDate = new Map<string, DailyProgressEntry[]>()
  for (const e of entries) {
    const list = byDate.get(e.reportDate) ?? []
    list.push(e)
    byDate.set(e.reportDate, list)
  }

  return [...byDate.entries()]
    .map(([reportDate, dayEntries]) => {
      const savedAts = dayEntries.map((x) => x.savedAt).filter(Boolean) as string[]
      const savedAt = savedAts.length > 0 ? savedAts.sort().at(-1)! : null
      return {
        reportDate,
        savedAt,
        note: notesByDate[reportDate] ?? '',
        entries: dayEntries,
      }
    })
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate))
}

export const HISTORY_PAGE_SIZE = 30

/** «+X٪ نسبت به گزارش قبلی» with English digits; the change since the previous report, not strictly a day. */
export function progressDeltaLabel(previousPct: number, currentPct: number): string {
  const delta = Math.round((currentPct - previousPct) * 100) / 100
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : ''
  return `${sign}${Math.abs(delta).toLocaleString('en-US', { maximumFractionDigits: 2 })}٪ نسبت به گزارش قبلی`
}

export function formatReportSavedTimestamp(
  reportDate: string,
  savedAt: string | null,
  calendar: 'jalali' | 'gregorian'
): { dateLabel: string; timeLabel: string | null } {
  const dateLabel = formatScheduleDate(reportDate, calendar)
  if (!savedAt) return { dateLabel, timeLabel: null }
  const d = new Date(savedAt)
  if (Number.isNaN(d.getTime())) return { dateLabel, timeLabel: null }
  const timeLabel = d.toLocaleTimeString('fa-IR-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return { dateLabel, timeLabel }
}

export function formatReportTitle(
  reportDate: string,
  calendar: 'jalali' | 'gregorian'
): string {
  const d = new Date(`${reportDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return formatScheduleDate(reportDate, calendar)
  if (calendar === 'jalali') {
    const label = d.toLocaleDateString('fa-IR-u-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return `گزارش ${label}`
  }
  const label = d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `Report — ${label}`
}

export function extractAiHighlightNote(note: string): string {
  const trimmed = note.trim()
  if (!trimmed) return ''

  const sections = parseOrganizedNote(trimmed)
  const field = sections.find((s) => /یادداشت میدانی/i.test(s.title))
  if (field?.lines.length) {
    return field.lines.map((l) => l.replace(/^•\s*/, '')).join(' ').trim()
  }
  const summary = sections.find((s) => /خلاصه/i.test(s.title))
  if (summary?.lines.length) {
    return summary.lines.map((l) => l.replace(/^•\s*/, '')).join(' ').trim()
  }
  if (sections.length === 1 && !sections[0].title) {
    return sections[0].lines.join(' ').trim()
  }
  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed
}

export const REPORT_PROGRESS_BAR_COLORS = [
  '#10b981',
  '#8b5cf6',
  '#f97316',
  '#3b82f6',
  '#14b8a6',
] as const

export type OrganizedNoteSection = {
  title: string
  lines: string[]
}

/** Split AI-organized note into titled sections (خلاصه روز، پیشرفت فعالیت‌ها، …) */
export function parseOrganizedNote(note: string): OrganizedNoteSection[] {
  const trimmed = note.trim()
  if (!trimmed) return []

  const blocks = trimmed.split(/\n\n+/)
  const sections: OrganizedNoteSection[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    const first = lines[0]
    const isHeading =
      lines.length > 1 &&
      !first.startsWith('•') &&
      !first.startsWith('-') &&
      first.length <= 48 &&
      !/^\d+[\).]/.test(first)

    if (isHeading) {
      sections.push({
        title: first,
        lines: lines.slice(1),
      })
    } else {
      sections.push({ title: '', lines })
    }
  }

  return sections
}
