/**
 * @file features/dashboard/config.ts
 * @purpose برچسب‌ها و متن ویجت‌ها و صفحهٔ داشبورد نقش
 * @safe-to-edit YES
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on nothing
 */

export const ROLE_DASHBOARD_COPY = {
  titlePrefix: 'داشبورد',
  fallbackRole: 'عضو تیم',
  welcome: (name: string) => `${name} عزیز، خوش آمدید. فضای کاری مطابق نقش شما تنظیم شده است.`,
  noWidgets: 'ویجتی برای نقش شما پیکربندی نشده است.',
} as const

export const DASHBOARD_CLIENT_COPY = {
  loading: 'در حال بارگذاری داشبورد شما...',
  loadFailed: 'بارگذاری داشبورد ناموفق بود',
} as const

export const OVERVIEW_STATS_COPY = {
  title: 'خلاصه روزانه',
  description: 'نمای کلی پروژه در یک نگاه',
  noProject: 'پروژه فعالی اختصاص داده نشده است.',
  labels: {
    reports: 'گزارش‌ها',
    members: 'اعضای تیم',
    role: 'نقش',
    status: 'وضعیت',
  },
  fallbackRole: 'عضو',
  activeStatus: 'فعال',
  allReports: 'مشاهده همه گزارش‌ها',
} as const

export const SAFETY_WIDGET_COPY = {
  title: 'نمای ایمنی',
  description: 'وضعیت HSE و مشاهدات باز',
  noProject: 'پروژه‌ای انتخاب نشده است.',
  labels: {
    daysWithoutStoppage: 'روز بدون حادثه منجر به توقف',
    openObservations: 'مشاهدات باز',
    ppeCompliance: 'رعایت PPE',
    toolboxTalks: 'جلسات ایمنی (هفته)',
  },
  sample: {
    daysWithoutStoppage: '47',
    openObservations: '3',
    ppeCompliance: '92%',
    toolboxTalks: '5',
  },
} as const

export const PROGRESS_WIDGET_COPY = {
  title: 'نمای پیشرفت',
  description: 'پیشرفت تجمعی برنامه‌ای در برابر واقعی',
  assignProject: 'برای مشاهده پیشرفت، پروژه اختصاص دهید',
  planned: 'برنامه‌ای',
  actual: 'واقعی',
  delay: 'تأخیر',
  forecast: 'پیش‌بینی',
  sample: {
    planned: 62,
    actual: 54,
    delay: '8 روز',
    forecast: 'Q4 2026',
  },
} as const

export const INVENTORY_WIDGET_COPY = {
  title: 'موجودی و انبار',
  description: 'دریافت مصالح و سطح موجودی در سایت',
  receive: 'دریافت',
  noProject: 'پروژه‌ای انتخاب نشده است.',
  status: { low: 'کم', ok: 'کافی', critical: 'بحرانی' },
  sampleStock: [
    { item: 'میلگرد 16', qty: '2.4 تن', status: 'کم' as const },
    { item: 'سیمان پرتلند', qty: '180 پاکت', status: 'کافی' as const },
    { item: 'پانل قالب', qty: '42 عدد', status: 'کافی' as const },
    { item: 'هارنس ایمنی', qty: '6 عدد', status: 'بحرانی' as const },
  ],
} as const

export const SCHEDULE_WIDGET_COPY = {
  title: 'برنامه زمان‌بندی',
  description: 'نقاط عطف برنامه پایه',
  needBaseline: 'برای فعال‌سازی نقاط عطف، برنامه پایه را بارگذاری کنید.',
  sampleMilestones: [
    { name: 'اتمام فونداسیون', date: '12 فروردین', status: 'done' as const },
    { name: 'بتن‌ریزی سقف طبقه 3', date: '13 اردیبهشت', status: 'active' as const },
    { name: 'شروع زیرسازی تأسیسات', date: '7 خرداد', status: 'upcoming' as const },
    { name: 'بستن نما', date: '24 تیر', status: 'upcoming' as const },
  ],
} as const

export const FINANCIAL_WIDGET_COPY = {
  title: 'خلاصه مالی',
  description: 'عملکرد کلی قرارداد (فقط مشاهده)',
  noProject: 'پروژه‌ای انتخاب نشده است.',
  contract: 'مبلغ قرارداد',
  approved: 'تأییدشده تا امروز',
  eac: 'پیش‌بینی در پایان',
  budgetUsed: 'بودجه مصرف‌شده',
  sample: {
    contract: '$12.4M',
    approved: '$7.2M',
    eac: '$12.8M',
    budgetUsed: 58,
  },
} as const

export const REPORT_WIDGET_COPY = {
  title: 'گزارش‌های اخیر',
  description: 'آخرین گزارش‌های تصویری سایت',
  newReport: 'گزارش جدید',
  empty: 'هنوز گزارشی ثبت نشده است.',
  siteReport: 'گزارش سایت',
  workforce: 'نیروی کار',
} as const

export const SECURITY_ALERTS_COPY = {
  title: 'هشدارهای امنیتی',
  description: 'شناسایی‌های ناموفق و حضور لحظه‌ای',
  noProject: 'پروژه‌ای انتخاب نشده است.',
  loading: 'در حال بارگذاری…',
  insideNow: 'هم‌اکنون در سایت:',
  noFails: 'امروز شناسایی ناموفقی ثبت نشده است.',
  unauthorized: 'غیرمجاز',
  failedId: 'شناسایی ناموفق',
} as const

export const ENTRY_EXIT_COPY = {
  title: 'ثبت ورود / خروج',
  description: 'تردد گیت امروز',
  openGate: 'باز کردن گیت',
  noProject: 'پروژه‌ای انتخاب نشده است.',
  loading: 'در حال بارگذاری…',
  empty: 'هنوز ترددی ثبت نشده است.',
  in: 'ورود',
  out: 'خروج',
} as const

export const DAILY_REPORT_WIDGET_COPY = {
  title: 'گزارش روزانه',
  description: 'کار سایت را شرح دهید، عکس پیوست کنید، خروجی هوش مصنوعی را بررسی و سپس نهایی کنید',
  needProject: 'برای ثبت گزارش روزانه باید پروژه اختصاص‌یافته داشته باشید.',
  noProject: 'پروژه‌ای اختصاص داده نشده است.',
  needDescription: 'لطفاً شرح گزارش را وارد کنید.',
  needPhoto: 'لطفاً عکس سایت را بارگذاری کنید.',
  uploading: 'در حال بارگذاری عکس...',
  analyzing: 'در حال تحلیل با هوش مصنوعی...',
  reviewHint: 'نتایج هوش مصنوعی را بررسی و قبل از نهایی‌سازی ویرایش کنید.',
  analyzeFailed: 'تحلیل ناموفق بود',
  saving: 'در حال ذخیره گزارش...',
  saved: 'گزارش روزانه با موفقیت نهایی شد.',
  saveFailed: 'ذخیره ناموفق بود',
  another: 'ثبت گزارش دیگر',
  descriptionLabel: 'شرح گزارش (وضعیت هوا خودکار درج می‌شود)',
  descriptionPlaceholder: 'فعالیت‌ها، پیشرفت و مسائل امروز سایت را شرح دهید...',
  photoLabel: 'عکس سایت',
  previewAlt: 'پیش‌نمایش',
  analyze: 'تحلیل و بررسی',
  reviewIntro: 'فیلدهای تولیدشده توسط هوش مصنوعی را ویرایش کنید، سپس گزارش را نهایی کنید.',
  activityType: 'نوع فعالیت',
  workforce: 'تعداد نیروی کار',
  supervisorSummary: 'خلاصه سرپرست',
  descriptionReview: 'شرح گزارش (قابل ویرایش)',
  back: 'بازگشت',
  finalize: 'نهایی‌سازی گزارش',
  savingButton: 'در حال ذخیره...',
  unauthenticated: 'احراز هویت نشده‌اید',
} as const
