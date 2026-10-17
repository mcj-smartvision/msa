/**
 * @file features/site-report/components/printable-daily-report.tsx
 * @purpose چاپ A4 حرفه‌ای برای مدیر — بخش‌های پر + عکس
 * @safe-to-edit CAREFUL
 * @affects پیش‌نمایش چاپ گزارش روزانه
 * @depends-on features/site-report/lib/*, features/site-report/config
 */

'use client'

import { SITE_REPORT_COPY, SITE_REPORT_PRINT, SITE_REPORT_SECTION_LABELS } from '@/features/site-report/config'
import { mergePrintPhotos } from '@/features/site-report/lib/merge-print-photos'
import { sectionsForPrint } from '@/features/site-report/lib/section-visibility'
import type {
  LipartaDailyReportData,
  SiteReportAttachedPhoto,
  SiteReportSectionId,
} from '@/features/site-report/lib/types'

function Section({ id, children }: { id: SiteReportSectionId; children: React.ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h3
        className={`mb-2 border-r-4 ${SITE_REPORT_PRINT.accentBorder} pr-2 text-[13px] font-bold text-slate-900`}
      >
        {SITE_REPORT_SECTION_LABELS[id]}
      </h3>
      <div className="text-[11.5px] leading-relaxed text-slate-800">{children}</div>
    </section>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2">
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold text-slate-900 tabular-nums">{value || '—'}</p>
    </div>
  )
}

const PREVIEW_CORE: SiteReportSectionId[] = [
  'weather',
  'crews_and_progress',
  'tomorrow_plan',
  'free_notes',
]

export function PrintableDailyReport({
  report,
  previewMode = false,
  photos,
}: {
  report: LipartaDailyReportData
  /** When true, always show core sections (even if empty) so preview is never blank. */
  previewMode?: boolean
  /** Live uploaded photos (signed URLs) — preferred over report.attached_photos */
  photos?: SiteReportAttachedPhoto[]
}) {
  const attached = mergePrintPhotos(photos, report.attached_photos)
  const filled = sectionsForPrint(report)
  const ids = previewMode
    ? Array.from(new Set<SiteReportSectionId>([...PREVIEW_CORE, ...filled]))
    : filled
  const showPhotos = attached.length > 0
  const bodyIds = ids.filter((id) => id !== 'header' && id !== 'attached_photos')
  const h = report.header
  const dayLine = [h.day_of_week, h.day_type].filter(Boolean).join(' · ')

  return (
    <div
      className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none"
      dir="rtl"
      lang="fa"
    >
      <div className={`h-1.5 w-full ${SITE_REPORT_PRINT.accentBar}`} aria-hidden />

      <div className="px-6 py-5 print:px-5 print:py-4">
        <header className="mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-[11px] font-semibold tracking-wide ${SITE_REPORT_PRINT.accentText}`}>
                {SITE_REPORT_PRINT.brandName}
              </p>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900">{SITE_REPORT_PRINT.brandTitle}</h1>
            </div>
            {h.report_no ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
                <p className="text-[10px] text-slate-500">{SITE_REPORT_PRINT.metaReportNo}</p>
                <p className="font-mono text-[12px] font-bold tabular-nums text-slate-900">{h.report_no}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetaCell label={SITE_REPORT_PRINT.metaProject} value={h.project_name} />
            <MetaCell label={SITE_REPORT_PRINT.metaDate} value={h.date_shamsi} />
            <MetaCell label={SITE_REPORT_PRINT.metaSupervisor} value={h.supervisor_name} />
            <MetaCell
              label={SITE_REPORT_PRINT.metaStatus}
              value={[h.status, h.submission_time].filter(Boolean).join(' · ')}
            />
          </div>
          {dayLine ? (
            <p className="mt-2 text-[11px] text-slate-500">
              {SITE_REPORT_PRINT.metaDay}: {dayLine}
            </p>
          ) : null}
        </header>

        {!previewMode && bodyIds.length === 0 && !showPhotos ? (
          <p className="text-sm text-slate-600">{SITE_REPORT_COPY.printEmpty}</p>
        ) : null}

        {ids.includes('weather') ? (
          <Section id="weather">
            <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2.5">
              <p className="font-medium text-slate-900">
                {report.weather.location_name ? `${report.weather.location_name} · ` : ''}
                {report.weather.condition ??
                  report.weather.morning_condition ??
                  report.weather.noon_condition ??
                  report.weather.evening_condition ??
                  '—'}
              </p>
              <p className="mt-1 tabular-nums text-slate-700">
                {SITE_REPORT_PRINT.weatherTemp}: {report.weather.min_temp_c ?? '—'} تا{' '}
                {report.weather.max_temp_c ?? '—'} · {SITE_REPORT_PRINT.weatherImpact}:{' '}
                {report.weather.impact_level}
                {report.weather.lost_hours != null
                  ? ` · ${SITE_REPORT_PRINT.weatherLost}: ${report.weather.lost_hours}`
                  : ''}
              </p>
              {report.weather.notes ? <p className="mt-1 text-slate-600">{report.weather.notes}</p> : null}
            </div>
          </Section>
        ) : null}

        {ids.includes('crews_and_progress') ? (
          <Section id="crews_and_progress">
            {report.crews_and_progress.length === 0 ? (
              <p className="text-slate-500">—</p>
            ) : (
              <table className="w-full border-collapse overflow-hidden rounded-md text-[11px]">
                <thead>
                  <tr className="bg-slate-800 text-right text-white">
                    <th className="p-2 font-semibold">اکیپ</th>
                    <th className="p-2 font-semibold">فعالیت</th>
                    <th className="p-2 font-semibold">محل</th>
                    <th className="p-2 font-semibold">نفر</th>
                    <th className="p-2 font-semibold">ساعت</th>
                    <th className="p-2 font-semibold">مقدار</th>
                    <th className="p-2 font-semibold">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {report.crews_and_progress.map((row, i) => {
                    const loc = row.location ?? {}
                    const done = row.work_done_today ?? { quantity: null, unit: null }
                    return (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                      >
                        <td className="border border-slate-200 p-1.5">{row.contractor_or_crew || '—'}</td>
                        <td className="border border-slate-200 p-1.5">
                          {row.wbs_code ? `${row.wbs_code} ` : ''}
                          {row.activity_name || '—'}
                        </td>
                        <td className="border border-slate-200 p-1.5">
                          {[loc.floor, loc.zone, loc.axis].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="border border-slate-200 p-1.5 tabular-nums">
                          {row.headcount ?? '—'}
                        </td>
                        <td className="border border-slate-200 p-1.5 tabular-nums">
                          {row.regular_hours ?? '—'}
                        </td>
                        <td className="border border-slate-200 p-1.5 tabular-nums">
                          {done.quantity ?? '—'} {done.unit ?? ''}
                        </td>
                        <td className="border border-slate-200 p-1.5">{row.activity_status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Section>
        ) : null}

        {ids.includes('staff_headcount') ? (
          <Section id="staff_headcount">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['کارفرما', report.staff_headcount.client_staff],
                  ['مشاور', report.staff_headcount.consultant_staff],
                  ['پیمانکار', report.staff_headcount.contractor_staff],
                  ['ستاد کارگاه', report.staff_headcount.site_hq_staff],
                ] as const
              ).map(([label, n]) => (
                <MetaCell key={label} label={label} value={n != null ? String(n) : '—'} />
              ))}
            </div>
          </Section>
        ) : null}

        {ids.includes('equipment') ? (
          <Section id="equipment">
            <ul className="list-disc space-y-1 pr-4">
              {report.equipment.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.name_or_code}</span> ({e.ownership}) · اپراتور:{' '}
                  {e.operator_name ?? '—'} · مفید: {e.operating_hours ?? '—'} · Idle:{' '}
                  {e.idle_hours ?? '—'} · خرابی: {e.breakdown_hours ?? '—'}
                  {e.breakdown_cause ? ` (${e.breakdown_cause})` : ''}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {ids.includes('materials') ? (
          <Section id="materials">
            {report.materials.received.length ? (
              <div className="mb-2">
                <p className={`mb-1 text-[11px] font-bold ${SITE_REPORT_PRINT.accentText}`}>ورودی</p>
                <ul className="list-disc space-y-0.5 pr-4">
                  {report.materials.received.map((m, i) => (
                    <li key={i}>
                      {m.item_name} {m.quantity ?? '—'} {m.unit ?? ''}
                      {m.supplier ? ` · ${m.supplier}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {report.materials.consumed.length ? (
              <div className="mb-2">
                <p className={`mb-1 text-[11px] font-bold ${SITE_REPORT_PRINT.accentText}`}>مصرفی</p>
                <ul className="list-disc space-y-0.5 pr-4">
                  {report.materials.consumed.map((m, i) => (
                    <li key={i}>
                      {m.item_name} {m.quantity ?? '—'} {m.unit ?? ''}
                      {m.location_used ? ` · ${m.location_used}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {report.materials.shortages.length ? (
              <div>
                <p className={`mb-1 text-[11px] font-bold ${SITE_REPORT_PRINT.accentText}`}>کمبود</p>
                <ul className="list-disc space-y-0.5 pr-4">
                  {report.materials.shortages.map((m, i) => (
                    <li key={i}>
                      {m.item_name} {m.required_quantity ?? '—'} {m.unit ?? ''} · {m.urgency}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>
        ) : null}

        {ids.includes('work_summary') ? (
          <Section id="work_summary">
            {report.work_summary.completed_activities.filter((s) => s.trim()).length ? (
              <p>
                <span className="font-semibold">تمام‌شده: </span>
                {report.work_summary.completed_activities.filter((s) => s.trim()).join('، ')}
              </p>
            ) : null}
            {report.work_summary.ongoing_activities.length ? (
              <p className="mt-1">
                <span className="font-semibold">در جریان: </span>
                {report.work_summary.ongoing_activities
                  .map(
                    (a) =>
                      `${a.activity}${a.cumulative_percent != null ? ` (${a.cumulative_percent}٪)` : ''}`
                  )
                  .join('، ')}
              </p>
            ) : null}
            {report.work_summary.unexecuted_planned_tasks.length ? (
              <ul className="mt-1 list-disc pr-4">
                {report.work_summary.unexecuted_planned_tasks.map((t, i) => (
                  <li key={i}>
                    انجام‌نشده: {t.task}
                    {t.reason?.trim() ? ` — ${t.reason}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            {report.work_summary.out_of_plan_tasks.filter((s) => s.trim()).length ? (
              <p className="mt-1">
                <span className="font-semibold">خارج از برنامه: </span>
                {report.work_summary.out_of_plan_tasks.filter((s) => s.trim()).join('، ')}
              </p>
            ) : null}
          </Section>
        ) : null}

        {ids.includes('quality_control') ? (
          <Section id="quality_control">
            <ul className="list-disc space-y-0.5 pr-4">
              {report.quality_control.map((q, i) => (
                <li key={i}>
                  {q.test_type || 'آزمایش'} · {q.result}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {ids.includes('site_visits_and_directives') ? (
          <Section id="site_visits_and_directives">
            <ul className="list-disc space-y-1 pr-4">
              {report.site_visits_and_directives.map((v, i) => (
                <li key={i}>
                  {v.visitor_name_and_role}
                  {v.directive_or_decision ? ` — ${v.directive_or_decision}` : ''}
                  {v.official_letter_required ? ' · نیاز به نامه رسمی' : ''}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-slate-500">{SITE_REPORT_COPY.disclaimerVisits}</p>
          </Section>
        ) : null}

        {ids.includes('hse') ? (
          <Section id="hse">
            {report.hse.accidents.filter((s) => s.trim()).length ? (
              <p>حوادث: {report.hse.accidents.filter((s) => s.trim()).join('، ')}</p>
            ) : null}
            {report.hse.near_misses.filter((s) => s.trim()).length ? (
              <p>شبه‌حادثه: {report.hse.near_misses.filter((s) => s.trim()).join('، ')}</p>
            ) : null}
            {report.hse.safety_warnings.filter((s) => s.trim()).length ? (
              <p>اخطار: {report.hse.safety_warnings.filter((s) => s.trim()).join('، ')}</p>
            ) : null}
            {report.hse.toolbox_talk.held ? (
              <p>
                Toolbox: {report.hse.toolbox_talk.topic ?? 'برگزار شد'}
                {report.hse.toolbox_talk.attendees_count != null
                  ? ` · ${report.hse.toolbox_talk.attendees_count} نفر`
                  : ''}
              </p>
            ) : null}
            {report.hse.work_stopped_by_hse ? (
              <p className="font-semibold text-rose-700">توقف کار توسط HSE</p>
            ) : null}
          </Section>
        ) : null}

        {ids.includes('delays_and_blockers') ? (
          <Section id="delays_and_blockers">
            <ul className="list-disc space-y-0.5 pr-4">
              {report.delays_and_blockers.map((d, i) => (
                <li key={i}>
                  {d.description} · {d.cause_category}
                  {d.lost_hours != null ? ` · ${d.lost_hours} ساعت` : ''}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {ids.includes('special_project_items') ? (
          <Section id="special_project_items">
            <ul className="space-y-0.5">
              {(
                [
                  ['ژئوتکنیک', report.special_project_items.geotechnical_monitoring],
                  ['معارضین', report.special_project_items.neighbor_issues],
                  ['مجوزها', report.special_project_items.municipal_and_utility_permits],
                  ['RFI', report.special_project_items.rfis_and_design_changes],
                  ['پیمانکار جزء', report.special_project_items.subcontractor_entries_exits],
                ] as const
              )
                .filter(([, v]) => v?.trim())
                .map(([label, v]) => (
                  <li key={label}>
                    <span className="font-semibold">{label}: </span>
                    {v}
                  </li>
                ))}
            </ul>
          </Section>
        ) : null}

        {ids.includes('tomorrow_plan') ? (
          <Section id="tomorrow_plan">
            <p>
              فعالیت‌ها:{' '}
              {report.tomorrow_plan.planned_activities.filter((s) => s.trim()).join('، ') || '—'}
            </p>
            {report.tomorrow_plan.required_materials?.trim() ? (
              <p className="mt-1">مصالح: {report.tomorrow_plan.required_materials}</p>
            ) : null}
            {report.tomorrow_plan.required_manpower_and_equipment?.trim() ? (
              <p className="mt-1">نفرات/تجهیزات: {report.tomorrow_plan.required_manpower_and_equipment}</p>
            ) : null}
          </Section>
        ) : null}

        {ids.includes('free_notes') && report.free_notes?.trim() ? (
          <Section id="free_notes">
            <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              {report.free_notes}
            </p>
          </Section>
        ) : null}

        {showPhotos ? (
          <Section id="attached_photos">
            <div className="grid grid-cols-2 gap-3">
              {attached.map((p, i) => (
                <figure
                  key={`${p.url}-${i}`}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm break-inside-avoid"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption || SITE_REPORT_PRINT.photoCaptionFallback}
                    className="h-40 w-full object-cover print:h-44"
                  />
                  <figcaption className="border-t border-slate-100 px-2 py-1.5 text-[10px] text-slate-600">
                    {p.caption?.trim() || SITE_REPORT_PRINT.photoCaptionFallback}
                    {p.linked_activity_or_location?.trim()
                      ? ` · ${p.linked_activity_or_location}`
                      : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Section>
        ) : null}

        <footer className="mt-6 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
          {SITE_REPORT_PRINT.footerNote}
          {h.project_name ? ` · ${h.project_name}` : ''}
          {h.report_no ? ` · ${h.report_no}` : ''}
        </footer>
      </div>
    </div>
  )
}
