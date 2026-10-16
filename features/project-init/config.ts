/**
 * @file features/project-init/config.ts
 * @purpose برچسب صفحه راه‌اندازی پروژه
 * @safe-to-edit YES
 * @affects /admin/projects/initialize
 * @depends-on nothing
 */

export const PROJECT_INIT_PAGE_COPY = {
  title: 'راه‌اندازی پروژه',
  description:
    'هر 8 بخش را تکمیل کنید تا پروژه عمرانی جدید راه‌اندازی شود. شناسه‌های سیستمی پنهان هنگام ثبت به‌صورت خودکار اختصاص داده می‌شوند.',
  backToProjects: 'بازگشت به پروژه‌ها',
} as const

export const PROJECT_INIT_FIELDS_COPY = {
  selectPlaceholder: 'انتخاب کنید...',
  searchPlaceholder: 'برای جستجو تایپ کنید...',
  noMatch: 'موردی یافت نشد',
  dropHint: 'برای بارگذاری کلیک کنید یا فایل را بکشید',
  noFile: 'فایلی انتخاب نشده',
} as const
