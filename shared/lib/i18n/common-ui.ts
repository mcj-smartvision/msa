/**
 * @file shared/lib/i18n/common-ui.ts
 * @purpose برچسب‌های مشترک همهٔ صفحات (بارگذاری، خالی، خطا)
 * @safe-to-edit YES
 * @affects تمام routeهای app/
 * @depends-on nothing
 */

export const COMMON_UI = {
  loading: 'در حال بارگذاری…',
  loadingDots: 'در حال بارگذاری...',
  loadingDashboard: 'در حال بارگذاری داشبورد شما...',
  loadingFailed: 'بارگذاری ناموفق بود',
  error: 'خطا',
  noProject: 'پروژه‌ای انتخاب نشده است.',
  noActiveProject: 'پروژه فعالی اختصاص داده نشده است.',
  retry: 'تلاش دوباره',
  retryAgain: 'تلاش مجدد',
  save: 'ذخیره',
  saving: 'در حال ذخیره...',
  cancel: 'انصراف',
  details: 'جزئیات',
  back: 'بازگشت',
} as const
