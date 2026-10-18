/**
 * @file shared/lib/i18n/common-ui.ts
 * @purpose برچسب‌های مشترک همهٔ صفحات (بارگذاری، خالی، خطا)
 * @safe-to-edit YES
 * @affects تمام routeهای app/
 * @depends-on shared/lib/i18n/make-live-copy
 */

import { makeLiveCopy } from '@/shared/lib/i18n/make-live-copy'

const FA = {
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

const EN: { [K in keyof typeof FA]: (typeof FA)[K] } = {
  loading: 'Loading…',
  loadingDots: 'Loading...',
  loadingDashboard: 'Loading your dashboard...',
  loadingFailed: 'Failed to load',
  error: 'Error',
  noProject: 'No project selected.',
  noActiveProject: 'No active project is assigned.',
  retry: 'Try again',
  retryAgain: 'Retry',
  save: 'Save',
  saving: 'Saving...',
  cancel: 'Cancel',
  details: 'Details',
  back: 'Back',
}

export const COMMON_UI = makeLiveCopy({
  fa: FA,
  en: EN as unknown as typeof FA,
})
