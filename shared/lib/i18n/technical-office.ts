import type { FormLocale } from '@/features/project-init/lib/i18n/types'

const EN = {
  title: 'Technical Office',
  subtitle: 'Enrich quantities, flag payment gaps — keep the site simple.',
  packages: 'Operational packages',
  enrich: 'Save enrichment',
  paymentFlag: 'Payment readiness',
  reason: 'Reason',
  exceptions: 'Exception queue',
  acknowledge: 'PM acknowledge risk',
  location: 'Location',
  quantity: 'Quantity',
  uom: 'UOM',
  crew: 'Crew',
  category: 'Category',
  status: 'Status',
  openSiteOps: 'Open Site Ops',
  seedHint: 'Import a CRE run in Site Ops, promote READY tasks, then enrich here.',
  flagNeedsReview: 'NeedsChangeReview',
  flagQtyIncomplete: 'QuantityIncomplete',
  flagPaymentReady: 'PaymentReady',
  flagNotForPayment: 'NotForPayment',
  polesExample: 'Example: poles installed but cabling missing → NeedsChangeReview',
  loading: 'Loading…',
  saved: 'Saved.',
  error: 'Something went wrong.',
}

const FA: typeof EN = {
  title: 'دفتر فنی',
  subtitle: 'غنی‌سازی مقادیر و فلگ آمادگی پرداخت — کارگاه ساده می‌ماند.',
  packages: 'پکیج‌های عملیاتی',
  enrich: 'ذخیره غنی‌سازی',
  paymentFlag: 'آمادگی پرداخت',
  reason: 'دلیل',
  exceptions: 'صف استثناها',
  acknowledge: 'تأیید ریسک توسط مدیر پروژه',
  location: 'محل',
  quantity: 'مقدار',
  uom: 'واحد',
  crew: 'گروه کاری',
  category: 'دسته',
  status: 'وضعیت',
  openSiteOps: 'باز کردن Site Ops',
  seedHint: 'ابتدا در Site Ops خروجی CRE را وارد و وظایف READY را ارتقا دهید، سپس اینجا غنی‌سازی کنید.',
  flagNeedsReview: 'NeedsChangeReview',
  flagQtyIncomplete: 'QuantityIncomplete',
  flagPaymentReady: 'PaymentReady',
  flagNotForPayment: 'NotForPayment',
  polesExample: 'مثال: نصب پایه چراغ بدون کابل‌کشی → NeedsChangeReview',
  loading: 'در حال بارگذاری…',
  saved: 'ذخیره شد.',
  error: 'خطایی رخ داد.',
}

export function getTechnicalOfficeMessages(locale: FormLocale | string) {
  if (locale === 'fa' || locale === 'ar') return FA
  return EN
}
