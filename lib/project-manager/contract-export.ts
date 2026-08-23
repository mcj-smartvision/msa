import type { ProjectSubcontractor, SubcontractorContract } from '@/lib/project-manager/subcontractor-types'
import { formatInvoiceNumber } from '@/lib/finance/invoice-weekday'
import { formatScheduleDate } from '@/lib/schedule/dates'
import type { ScheduleCalendar } from '@/lib/schedule/calendar-preference'

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Standard printable subcontract summary (Persian construction template). */
export function buildSubcontractHtml(
  projectName: string,
  sub: ProjectSubcontractor,
  contract: SubcontractorContract,
  calendar: ScheduleCalendar = 'jalali'
): string {
  const value =
    contract.contract_value != null
      ? `${formatInvoiceNumber(contract.contract_value, 'fa')} ریال`
      : '—'

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(contract.title)} — ${escapeHtml(sub.name)}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; padding: 28px; color: #111; line-height: 1.7; }
    h1 { text-align: center; font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .meta { font-size: 13px; margin-bottom: 16px; }
    .meta div { margin: 4px 0; }
    .box { border: 1px solid #333; padding: 12px; margin: 12px 0; white-space: pre-wrap; }
    .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; text-align: center; }
    .sign-line { border-top: 1px solid #222; margin-top: 48px; padding-top: 6px; font-size: 12px; }
    .footer { margin-top: 24px; font-size: 10px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <h1>قرارداد پیمانکاری (خلاصه استاندارد)</h1>
  <p style="text-align:center;font-size:12px;color:#555">پروژه: ${escapeHtml(projectName)}</p>
  <div class="meta">
    <div><strong>شماره قرارداد:</strong> ${escapeHtml(contract.contract_no || '—')}</div>
    <div><strong>عنوان:</strong> ${escapeHtml(contract.title)}</div>
    <div><strong>پیمانکار:</strong> ${escapeHtml(sub.name)}</div>
    <div><strong>رشته / تخصص:</strong> ${escapeHtml(sub.trade || '—')}</div>
    <div><strong>نماینده:</strong> ${escapeHtml(sub.contact_name || '—')}</div>
    <div><strong>تلفن:</strong> ${escapeHtml(sub.phone || '—')}</div>
    <div><strong>مبلغ قرارداد:</strong> ${value}</div>
    <div><strong>شروع:</strong> ${escapeHtml(formatScheduleDate(contract.start_date, calendar))}</div>
    <div><strong>پایان:</strong> ${escapeHtml(formatScheduleDate(contract.end_date, calendar))}</div>
    <div><strong>حسن انجام کار:</strong> ${contract.retention_percent ?? 10}٪</div>
    <div><strong>وضعیت:</strong> ${escapeHtml(contract.status)}</div>
  </div>
  <h2>موضوع و محدوده کار</h2>
  <div class="box">${escapeHtml(contract.scope_summary || '—')}</div>
  <h2>شرایط پرداخت</h2>
  <div class="box">${escapeHtml(contract.payment_terms || 'طبق صورت‌وضعیت تأییدشده و برنامه مالی پروژه')}</div>
  <h2>استانداردها و الزامات</h2>
  <div class="box">${escapeHtml(
    contract.standards_notes ||
      'رعایت نقشه‌ها، مشخصات فنی پروژه، مقررات ایمنی کارگاه (HSE) و برنامه زمان‌بندی ابلاغی. هرگونه تغییر محدوده کار منوط به تأیید کتبی مدیر پروژه است.'
  )}</div>
  <div class="signs">
    <div><div class="sign-line">امضاء کارفرما / مدیر پروژه</div></div>
    <div><div class="sign-line">امضاء پیمانکار</div></div>
  </div>
  <p class="footer">تولیدشده توسط MSA — قالب استاندارد خلاصه قرارداد</p>
</body>
</html>`
}
