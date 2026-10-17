/**
 * @file features/site-report/components/printable-daily-report.tsx
 * @purpose چاپ A4 تمیز — فقط بخش‌های پر
 * @safe-to-edit CAREFUL
 * @affects پیش‌نمایش چاپ گزارش روزانه
 * @depends-on features/site-report/lib/*, features/site-report/config
 */

'use client'

import { SITE_REPORT_SECTION_LABELS } from '@/features/site-report/config'
import { sectionsForPrint } from '@/features/site-report/lib/section-visibility'
import type { LipartaDailyReportData, SiteReportSectionId } from '@/features/site-report/lib/types'

function Section({ id, children }: { id: SiteReportSectionId; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-b border-slate-200 pb-3 mb-3">
      <h3 className="text-sm font-bold text-slate-900 mb-2">{SITE_REPORT_SECTION_LABELS[id]}</h3>
      {children}
    </section>
  )
}

export function PrintableDailyReport({ report }: { report: LipartaDailyReportData }) {
  const ids = sectionsForPrint(report)
  const h = report.header

  return (
    <div
      className="mx-auto max-w-[210mm] bg-white p-6 text-[12px] leading-relaxed text-slate-900 print:p-4"
      dir="rtl"
      lang="fa"
    >
      <header className="mb-4 border-b-2 border-slate-800 pb-3">
        <h1 className="text-lg font-bold">گزارش روزانه کارگاه — Liparta</h1>
        <p className="mt-1 tabular-nums">
          {h.project_name}
          {h.report_no ? ` · ${h.report_no}` : ''}
          {h.date_shamsi ? ` · ${h.date_shamsi}` : ''}
          {h.day_of_week ? ` · ${h.day_of_week}` : ''}
          {h.day_type ? ` · ${h.day_type}` : ''}
        </p>
        <p className="text-slate-600">
          سرپرست: {h.supervisor_name || '—'} · وضعیت: {h.status}
          {h.submission_time ? ` · ${h.submission_time}` : ''}
        </p>
      </header>

      {ids.includes('weather') ? (
        <Section id="weather">
          <p>
            {report.weather.location_name ? `${report.weather.location_name} · ` : ''}
            {report.weather.condition ??
              report.weather.morning_condition ??
              report.weather.noon_condition ??
              report.weather.evening_condition ??
              '—'}
          </p>
          <p>
            دما: {report.weather.min_temp_c ?? '—'} تا {report.weather.max_temp_c ?? '—'} · اثر:{' '}
            {report.weather.impact_level}
            {report.weather.lost_hours != null ? ` · ساعت از دست‌رفته: ${report.weather.lost_hours}` : ''}
          </p>
          {report.weather.notes ? <p>{report.weather.notes}</p> : null}
        </Section>
      ) : null}

      {ids.includes('crews_and_progress') ? (
        <Section id="crews_and_progress">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b bg-slate-50 text-right">
                <th className="p-1">اکیپ</th>
                <th className="p-1">فعالیت</th>
                <th className="p-1">محل</th>
                <th className="p-1">نفر</th>
                <th className="p-1">ساعت</th>
                <th className="p-1">مقدار</th>
                <th className="p-1">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {report.crews_and_progress.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-1">{row.contractor_or_crew}</td>
                  <td className="p-1">
                    {row.wbs_code ? `${row.wbs_code} ` : ''}
                    {row.activity_name}
                  </td>
                  <td className="p-1">
                    {[row.location.floor, row.location.zone, row.location.axis].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="p-1 tabular-nums">{row.headcount ?? '—'}</td>
                  <td className="p-1 tabular-nums">{row.regular_hours ?? '—'}</td>
                  <td className="p-1 tabular-nums">
                    {row.work_done_today.quantity ?? '—'} {row.work_done_today.unit ?? ''}
                  </td>
                  <td className="p-1">{row.activity_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {ids.includes('equipment') ? (
        <Section id="equipment">
          <ul className="space-y-1">
            {report.equipment.map((e, i) => (
              <li key={i}>
                {e.name_or_code} ({e.ownership}) · اپراتور: {e.operator_name ?? '—'} · مفید:{' '}
                {e.operating_hours ?? '—'} · Idle: {e.idle_hours ?? '—'} · خرابی: {e.breakdown_hours ?? '—'}
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
              <p className="font-semibold">ورودی</p>
              <ul>
                {report.materials.received.map((m, i) => (
                  <li key={i}>
                    {m.item_name} {m.quantity ?? '—'} {m.unit ?? ''} · {m.supplier ?? '—'} · حواله:{' '}
                    {m.waybill_or_invoice_no ?? '—'} · پلاک: {m.truck_plate ?? '—'} · {m.supplied_by}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {report.materials.consumed.length ? (
            <div className="mb-2">
              <p className="font-semibold">مصرفی</p>
              <ul>
                {report.materials.consumed.map((m, i) => (
                  <li key={i}>
                    {m.item_name} {m.quantity ?? '—'} {m.unit ?? ''} · محل: {m.location_used ?? '—'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {report.materials.shortages.length ? (
            <div>
              <p className="font-semibold">کمبود</p>
              <ul>
                {report.materials.shortages.map((m, i) => (
                  <li key={i}>
                    {m.item_name} {m.required_quantity ?? '—'} {m.unit ?? ''} · نیاز تا:{' '}
                    {m.needed_by_date ?? '—'} · {m.urgency}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {ids.includes('work_summary') ? (
        <Section id="work_summary">
          {report.work_summary.completed_activities.length ? (
            <p>تمام‌شده: {report.work_summary.completed_activities.join('، ')}</p>
          ) : null}
          {report.work_summary.ongoing_activities.length ? (
            <p>
              در جریان:{' '}
              {report.work_summary.ongoing_activities
                .map((a) => `${a.activity}${a.cumulative_percent != null ? ` (${a.cumulative_percent}٪)` : ''}`)
                .join('، ')}
            </p>
          ) : null}
          {report.work_summary.unexecuted_planned_tasks.length ? (
            <ul>
              {report.work_summary.unexecuted_planned_tasks.map((t, i) => (
                <li key={i}>
                  انجام‌نشده: {t.task} — {t.reason}
                </li>
              ))}
            </ul>
          ) : null}
          {report.work_summary.out_of_plan_tasks.length ? (
            <p>خارج از برنامه: {report.work_summary.out_of_plan_tasks.join('، ')}</p>
          ) : null}
        </Section>
      ) : null}

      {ids.includes('delays_and_blockers') ? (
        <Section id="delays_and_blockers">
          <ul>
            {report.delays_and_blockers.map((d, i) => (
              <li key={i}>
                {d.description} · {d.cause_category}
                {d.lost_hours != null ? ` · ${d.lost_hours} ساعت` : ''}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {ids.includes('tomorrow_plan') ? (
        <Section id="tomorrow_plan">
          <p>فعالیت‌ها: {report.tomorrow_plan.planned_activities.join('، ') || '—'}</p>
          {report.tomorrow_plan.required_materials ? (
            <p>مصالح: {report.tomorrow_plan.required_materials}</p>
          ) : null}
          {report.tomorrow_plan.required_manpower_and_equipment ? (
            <p>نفرات/تجهیزات: {report.tomorrow_plan.required_manpower_and_equipment}</p>
          ) : null}
        </Section>
      ) : null}

      {ids.includes('attached_photos') ? (
        <Section id="attached_photos">
          <div className="grid grid-cols-3 gap-2">
            {report.attached_photos.map((p, i) => (
              <figure key={i} className="border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url ? <img src={p.url} alt={p.caption} className="h-28 w-full object-cover" /> : null}
                <figcaption className="p-1 text-[10px]">
                  {p.caption}
                  {p.linked_activity_or_location ? ` · ${p.linked_activity_or_location}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      ) : null}

      {ids.includes('free_notes') && report.free_notes ? (
        <Section id="free_notes">
          <p className="whitespace-pre-wrap">{report.free_notes}</p>
        </Section>
      ) : null}
    </div>
  )
}
