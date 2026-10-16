/**
 * @file features/site-ops/config.ts
 * @purpose برچسب‌های فارسی عملیات کارگاه
 * @safe-to-edit YES
 * @affects /site-ops
 * @depends-on nothing
 */

export const SITE_OPS_NAV_PRIMARY = [
  { href: '/site-ops/schedule', label: 'برنامه' },
  { href: '/site-ops/approvals', label: 'تأییدات' },
  { href: '/site-ops/prepared', label: 'لیست‌ها' },
  { href: '/site-ops/today', label: 'امروز' },
  { href: '/site-ops/flags', label: 'پرچم‌ها' },
] as const

export const SITE_OPS_NAV_ADVANCED = [
  { href: '/site-ops/cre-runs', label: 'اجراهای CRE' },
  { href: '/site-ops/daily-plans', label: 'برنامه روزانه (پیشرفته)' },
  { href: '/site-ops/reports/daily', label: 'گزارش روزانه' },
  { href: '/site-ops/exceptions', label: 'استثناها' },
  { href: '/dashboard/technical-office', label: 'دفتر فنی (پیشرفته)' },
] as const

export const SITE_OPS_COPY = {
  title: 'کارگاه روزانه',
  supervisorDescription: 'نمای سرپرست کارگاه — فقط مشاهده؛ ویرایش برای دفتر فنی است.',
  editorDescription: 'برنامه را ببینید، زیرمجموعه بسازید، به امروز بفرستید، عملکرد ثبت کنید.',
  hideAdvanced: 'مخفی کردن ابزار پیشرفته',
  showAdvanced: 'ابزار پیشرفته',
  pickProject: 'یک پروژه انتخاب کنید.',
  exceptionsIntro: 'مدیر پروژه / کنترل پروژه — فقط شکاف‌های حساس مقدار/پرداخت را تأیید کنید.',
  paymentRiskTitle: 'ریسک پرداخت / مقدار',
  noPaymentRisk: 'پرچم باز ریسک پرداخت وجود ندارد.',
  riskAcknowledged: 'ریسک تأیید شد',
  openBlockers: 'موانع باز',
  noOpenBlockers: 'مانع بازی وجود ندارد.',
  acknowledgeNote: 'مدیر پروژه ریسک پرداخت/محدوده را تأیید کرد',
  colName: 'نام',
  colActivity: 'فعالیت',
} as const

export const FIELD_STATE_COPY = {
  VALID: 'معتبر',
  MISSING: 'ناموجود',
  UNUSABLE: 'غیرقابل استفاده',
} as const
