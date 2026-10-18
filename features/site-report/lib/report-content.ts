/**
 * @file features/site-report/lib/report-content.ts
 * @purpose تشخیص پر بودن گزارش ساختاریافته و ساخت متن پشتیبان
 * @safe-to-edit YES
 * @affects ثبت / ارسال گزارش روزانه
 * @depends-on features/site-report/lib/types, features/site-report/lib/section-visibility
 */

import { isSiteReportSectionEmpty } from '@/features/site-report/lib/section-visibility'
import type { LipartaDailyReportData, SiteReportSectionId } from '@/features/site-report/lib/types'

const CONTENT_SECTIONS: SiteReportSectionId[] = [
  'weather',
  'crews_and_progress',
  'staff_headcount',
  'equipment',
  'materials',
  'work_summary',
  'quality_control',
  'site_visits_and_directives',
  'hse',
  'delays_and_blockers',
  'special_project_items',
  'tomorrow_plan',
  'free_notes',
]

export function siteReportHasContent(report: LipartaDailyReportData | null | undefined): boolean {
  if (!report) return false
  return CONTENT_SECTIONS.some((id) => !isSiteReportSectionEmpty(report, id))
}

function pushLines(parts: string[], label: string, lines: string[]) {
  const clean = lines.map((s) => s.trim()).filter(Boolean)
  if (clean.length) parts.push(`${label}: ${clean.join('؛ ')}`)
}

/** Fallback raw_text when the free note field is empty but structured data exists. */
export function siteReportFallbackNote(report: LipartaDailyReportData): string {
  const parts: string[] = []
  const w = report.weather
  if (w.condition || w.location_name || w.notes) {
    parts.push(
      [
        'وضعیت هوا:',
        w.location_name,
        w.condition,
        w.min_temp_c != null || w.max_temp_c != null
          ? `${w.min_temp_c ?? '—'} تا ${w.max_temp_c ?? '—'} درجه`
          : null,
        w.notes,
      ]
        .filter(Boolean)
        .join(' - ')
    )
  }
  for (const c of report.crews_and_progress) {
    if (!c.activity_name && !c.contractor_or_crew && !c.trade) continue
    parts.push(
      [
        c.activity_name || 'فعالیت',
        c.contractor_or_crew,
        c.trade,
        c.activity_status,
        c.work_done_today.quantity != null
          ? `${c.work_done_today.quantity} ${c.work_done_today.unit ?? ''}`.trim()
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    )
  }
  for (const e of report.equipment) {
    if (!e.name_or_code) continue
    parts.push(`ماشین‌آلات: ${e.name_or_code}${e.operator_name ? ` · ${e.operator_name}` : ''}`)
  }
  for (const m of report.materials.received) {
    if (!m.item_name) continue
    parts.push(`مصالح ورودی: ${m.item_name} ${m.quantity ?? ''} ${m.unit ?? ''}`.trim())
  }
  for (const m of report.materials.consumed) {
    if (!m.item_name) continue
    parts.push(`مصالح مصرفی: ${m.item_name} ${m.quantity ?? ''} ${m.unit ?? ''}`.trim())
  }
  for (const m of report.materials.shortages) {
    if (!m.item_name) continue
    parts.push(`کمبود مصالح: ${m.item_name}`)
  }
  pushLines(parts, 'تمام‌شده', report.work_summary.completed_activities)
  if (report.work_summary.ongoing_activities.length) {
    parts.push(
      `در جریان: ${report.work_summary.ongoing_activities
        .map((a) =>
          a.cumulative_percent != null ? `${a.activity} (${a.cumulative_percent}٪)` : a.activity
        )
        .filter((s) => s.trim())
        .join('؛ ')}`
    )
  }
  for (const t of report.work_summary.unexecuted_planned_tasks) {
    if (!t.task?.trim()) continue
    parts.push(`انجام‌نشده: ${t.task}${t.reason?.trim() ? ` — ${t.reason}` : ''}`)
  }
  pushLines(parts, 'خارج از برنامه', report.work_summary.out_of_plan_tasks)
  for (const d of report.delays_and_blockers) {
    if (!d.description?.trim()) continue
    parts.push(`مانع: ${d.description} · ${d.cause_category}`)
  }
  pushLines(parts, 'HSE حوادث', report.hse.accidents)
  pushLines(parts, 'HSE شبه‌حادثه', report.hse.near_misses)
  pushLines(parts, 'HSE اخطار', report.hse.safety_warnings)
  const tomorrow = report.tomorrow_plan.planned_activities.map((s) => s.trim()).filter(Boolean)
  if (tomorrow.length) parts.push(`برنامه فردا: ${tomorrow.join('؛ ')}`)
  if (report.tomorrow_plan.required_materials?.trim()) {
    parts.push(`مصالح فردا: ${report.tomorrow_plan.required_materials.trim()}`)
  }
  if (report.tomorrow_plan.required_manpower_and_equipment?.trim()) {
    parts.push(`نفرات/تجهیزات فردا: ${report.tomorrow_plan.required_manpower_and_equipment.trim()}`)
  }
  if (report.free_notes?.trim()) parts.push(report.free_notes.trim())
  return parts.join('\n') || 'گزارش ساختاریافته کارگاه'
}

/** Merge free note + structured summary for archive raw_text. */
export function resolveDailyReportNote(
  note: string | null | undefined,
  structured: LipartaDailyReportData | null | undefined
): string {
  const n = typeof note === 'string' ? note.trim() : ''
  const fromForm =
    structured && siteReportHasContent(structured) ? siteReportFallbackNote(structured) : ''
  if (fromForm && n && n !== '—' && !fromForm.includes(n) && !n.includes(fromForm.slice(0, 48))) {
    return `${n}\n\n${fromForm}`
  }
  if (fromForm) return fromForm
  return n && n !== '—' ? n : ''
}
