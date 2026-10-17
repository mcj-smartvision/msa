/**
 * @file features/manager/lib/daily-reports-config.ts
 * @purpose برچسب‌های صفحه تأیید گزارش روزانه مدیر
 * @safe-to-edit YES
 * @affects features/manager/components/manager-daily-reports-page
 * @depends-on nothing
 */

export const MANAGER_DAILY_REPORTS_COPY = {
  title: 'گزارش‌های روزانه کارگاه',
  hint: 'سرپرست با «تأیید نهایی و ارسال» گزارش را فرستاده است. شما مشاهده و در صورت تأیید، دکمهٔ تأیید را بزنید.',
  pendingTitle: 'منتظر تأیید شما',
  archiveTitle: 'آرشیو ارسال‌شده‌ها',
  approveCta: 'تأیید گزارش',
  approveOk: 'گزارش تأیید شد',
  approveFailed: 'تأیید گزارش ناموفق بود',
  loadFailed: 'خواندن گزارش‌ها ناموفق بود',
  emptyPending: 'گزارش منتظر تأییدی نیست.',
  emptyArchive: 'هنوز گزارشی ارسال نشده است.',
  statusSubmitted: 'منتظر تأیید مدیر',
  statusApproved: 'تأییدشده',
  backToManager: 'بازگشت به داشبورد مدیر',
  selectProject: 'ابتدا پروژه را از بالای صفحه انتخاب کنید.',
  noNote: 'بدون متن یادداشت',
  loading: 'در حال بارگذاری…',
} as const
