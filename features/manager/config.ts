/**
 * @file features/manager/config.ts
 * @purpose برچسب‌ها، آستانه‌های UI و اعداد جادویی داشبورد مدیر پروژه
 * @safe-to-edit YES
 * @affects features/manager/components
 * @depends-on features/manager/lib/ui-copy, features/manager/lib/overview-types
 */

import type { ManagerPeriod } from '@/features/manager/lib/overview-types'

export interface ManagerTourCopyStep {
  target: string
  title: string
  body: string
}

export interface ManagerHelpCopyLink {
  label: string
  description: string
  href: string
}

export {
  BACKGROUND_COPY,
  CHART_COPY,
  COST_PERF_COPY,
  CUMULATIVE_COPY,
  DAILY_COPY,
  ESTIMATE_COPY,
  FRONTS_COPY,
  INBOX_COPY,
  PERIOD_COPY,
  SECTIONS_COPY,
  WEEKLY_COPY,
  WEEKLY_HELP_COPY,
} from '@/features/manager/lib/ui-copy'

export const MANAGER_PUNCT = {
  percent: '٪',
  list: '، ',
  comma: '،',
  dash: ' — ',
  semi: '؛ ',
  colon: ' · ',
} as const

/** Display and timing numbers used by manager UI — not formula logic. */
export const MANAGER_UI_NUMBERS = {
  refreshMs: 5 * 60 * 1000,
  visibilityReloadMs: 60_000,
  clockTickMs: 30_000,
  tourCardWidth: 340,
  tourPad: 6,
  tourMeasureDelayMs: 350,
  alertsPreview: 3,
  notificationsPreview: 3,
  blockersPreview: 4,
  inboxToastMs: 8_000,
  frontsToastMs: 10_000,
  chartForwardMonths: 3,
  recentHistoryDays: 45,
  chartOneMonthBackDays: 31,
  chartOneMonthForwardDays: 10,
  fulfillmentGood: 95,
  fulfillmentWarn: 50,
  dailyStaleHours: 24,
  gaugeMax: 1.5,
  helpPanelMaxWidth: 440,
  defaultLoadingRows: 3,
  inboxLoadingRows: 3,
  notificationCap: 99,
} as const

export const MANAGER_UI_COPY = {
  about: (label: string) => `دربارهٔ ${label}`,
  loading: 'در حال بارگذاری…',
  notLoaded: 'داده هنوز بارگذاری نشده است',
  notConnected: 'داده هنوز متصل نشده',
  sectionFailed: 'بارگذاری این بخش ناموفق بود',
} as const

export const MANAGER_TOUR_COPY = {
  stepOf: (index: string, total: string) => `مرحلهٔ ${index} از ${total}`,
  close: 'بستن تور',
  skip: 'رد کردن',
  prev: 'قبلی',
  next: 'بعدی',
  end: 'پایان',
} as const

export const MANAGER_TOUR_STEPS: ManagerTourCopyStep[] = [
  {
    target: 'health',
    title: 'نوار سلامت پروژه',
    body: 'پنج ستون اصلی پروژه — زمان‌بندی، هزینه، ایمنی، کیفیت و مصالح — در یک نگاه. وضعیت کلی سربرگ از بدترین ستون گرفته می‌شود.',
  },
  {
    target: 'kpis',
    title: 'چهار شاخص اصلی',
    body: 'پیشرفت تجمعی در برابر برنامه، انحراف زمانی (روز و SPI)، انحراف هزینه (BAC، EV، AC و CPI) و اقدامات معوق.',
  },
  {
    target: 'pulse',
    title: 'نبض زندهٔ کارگاه',
    body: 'آخرین ثبت گزارش روزانه، انبار، ایمنی و گیت. اگر بخشی عقب مانده باشد، با «ارسال یادآوری» به مسئولش اعلان بفرستید.',
  },
  {
    target: 'alerts',
    title: 'هشدارهای هوشمند',
    body: 'فقط سه هشدار مهم، با حوزه، اثر احتمالی و پیشنهاد سیستم. نوار قرمز یعنی بحران و کهربایی یعنی نیازمند توجه؛ فهرست کامل از پایین همین کارت باز می‌شود.',
  },
  {
    target: 'chart',
    title: 'منحنی S پیشرفت',
    body: 'خط برنامه (PV)، پیشرفت واقعی تأییدشده و ارزش کسب‌شده (EV) از چپ به راست در طول زمان. نقطهٔ «امروز» همان مقادیر کارت‌های بالای صفحه است.',
  },
]

export const MANAGER_HELP_COPY = {
  title: 'راهنما و تور سیستم',
  subtitle: 'هر آنچه برای خواندن اتاق فرمان لازم دارید',
  close: 'بستن راهنما',
  tablist: 'بخش‌های راهنما',
  tabs: {
    tour: 'تور معرفی',
    glossary: 'اصطلاحات',
    colors: 'رنگ‌ها',
    shortcuts: 'میانبرها',
  },
  tourInteractive: (steps: string) => `تور تعاملی ${steps} مرحله‌ای`,
  tourIntro: 'هر بخش روی صفحه هایلایت می‌شود و در یک جمله توضیح داده می‌شود. با کلیدهای جهت‌نما هم می‌توانید جابه‌جا شوید.',
  startTour: 'شروع تور',
  glossary: [
    {
      abbr: 'SPI',
      title: 'شاخص عملکرد زمانی',
      name: 'Schedule Performance Index',
      body: 'نشان می‌دهد نسبت به برنامه با چه سرعتی جلو می‌رویم (EV ÷ PV). عدد 1 یعنی دقیقاً طبق برنامه؛ 0.9 یعنی از هر 100 واحد کاری که باید تا امروز انجام می‌شد، 90 واحد انجام شده است. زیر 0.95 کهربایی و زیر 0.85 قرمز می‌شود.',
    },
    {
      abbr: 'CPI',
      title: 'شاخص عملکرد هزینه',
      name: 'Cost Performance Index',
      body: 'نشان می‌دهد در برابر هر تومان هزینه، چقدر کار ارزشمند تحویل گرفته‌ایم (EV ÷ AC). کمتر از 1 یعنی بیش از ارزش کار انجام‌شده خرج کرده‌ایم.',
    },
    {
      abbr: 'EV',
      title: 'ارزش کسب‌شده',
      name: 'Earned Value',
      body: 'ارزش ریالی کاری که واقعاً انجام و تأیید شده است: بودجهٔ هر فعالیت × درصد پیشرفت تأییدشدهٔ آن.',
    },
    {
      abbr: 'AC',
      title: 'هزینهٔ واقعی',
      name: 'Actual Cost',
      body: 'مجموع هزینه‌ای که تا امروز واقعاً پرداخت یا ثبت شده است (اسناد هزینه، صورت‌حساب‌ها و بالاسری).',
    },
    {
      abbr: 'NCR',
      title: 'گزارش عدم انطباق',
      name: 'Non-Conformance Report',
      body: 'وقتی کاری مطابق نقشه، مشخصات فنی یا استاندارد اجرا نشده باشد، NCR ثبت می‌شود. NCR باز یعنی هنوز اصلاح یا تأیید نشده است.',
    },
    {
      abbr: 'PV',
      title: 'ارزش برنامه‌ای',
      name: 'Planned Value',
      body: 'ارزش کاری که طبق برنامهٔ مبنا باید تا امروز انجام می‌شد؛ همان خط «برنامه» در نمودار S.',
    },
    {
      abbr: 'BAC',
      title: 'بودجهٔ کل',
      name: 'Budget at Completion',
      body: 'بودجهٔ مصوب کل پروژه؛ مبنای همهٔ درصدهای ارزشی.',
    },
    {
      abbr: 'SV / CV',
      title: 'انحراف زمانی و هزینه',
      name: 'Schedule / Cost Variance',
      body: 'انحراف زمانی به روز بیان می‌شود (برنامه چه روزی به پیشرفت امروز می‌رسید). انحراف هزینه = EV − AC؛ منفی یعنی بیش‌هزینه.',
    },
  ],
  colors: [
    {
      label: 'پایدار / به‌روز',
      title: 'سبز',
      body: 'شاخص در محدودهٔ مطلوب است یا اطلاعات در بازهٔ مجاز ثبت شده؛ اقدامی لازم نیست.',
    },
    {
      label: 'معوق / نیازمند توجه',
      title: 'زرد (کهربایی)',
      body: 'روند نامطلوب شروع شده یا ثبت اطلاعات از آستانهٔ مجاز عقب افتاده است؛ در روزهای آینده پیگیری کنید یا یادآوری بفرستید.',
    },
    {
      label: 'بحرانی',
      title: 'قرمز',
      body: 'فقط برای خطر جدی یا توقف کارگاه: شناوری منفی، SPI/CPI زیر 0.85، تمام‌شدن مصالح یا NCR بحرانی. نیاز به اقدام فوری دارد.',
    },
    {
      label: 'متصل نشده',
      title: 'خاکستری',
      body: 'دادهٔ این بخش هنوز ثبت یا متصل نشده است. به‌جای صفرِ گمراه‌کننده، «داده هنوز متصل نشده» نمایش داده می‌شود.',
    },
  ],
  colorsNote:
    'کنار هر رنگ، متن و آیکن وضعیت هم آمده تا معنی فقط به رنگ وابسته نباشد. نوار باریک سمت راست کارت‌های هشدار هم همین رنگ‌ها را دارد: قرمز برای بحرانی و کهربایی برای نیازمند توجه.',
  quickLinks: 'دسترسی سریع',
  shortcutsTitle: 'کلیدهای میانبر',
  shortcutOpen: 'باز کردن همین راهنما',
  shortcutClose: 'بستن راهنما، تور یا منوها',
  shortcutTour: 'مرحلهٔ بعد / قبل در تور',
  tipsTitle: 'ترفندها',
  tipHealthLead: 'نوار سلامت',
  tipHealth: ' یا کارت شاخص بزنید تا مستقیم به صفحهٔ جزئیات همان بخش بروید.',
  tipPeriodLead: 'بازهٔ زمانی سربرگ',
  tipPeriod: ' هشدارهای ثبت‌شده در همان بازه را «تازه» علامت می‌زند؛ هشدار فعال هیچ‌وقت پنهان نمی‌شود.',
  tipRefresh: 'داده‌ها هر 5 دقیقه و هنگام بازگشت به این برگه خودکار تازه می‌شوند؛ دکمهٔ همگام‌سازی سربرگ هم فوراً تازه می‌کند.',
  tipInfoLead: 'i',
  tipInfoPrefix: 'آیکن ',
  tipInfo: ' کنار عنوان هر کارت، توضیح منبع داده و نحوهٔ محاسبهٔ آن را نشان می‌دهد.',
  tipOnEach: 'روی هر ستون ',
  unavailableTitle: 'بخش‌هایی که هنوز در منو نیستند:',
} as const

export const DASHBOARD_CONFIG = {
  title: 'داشبورد مدیر پروژه',
  emptyTitle: 'داشبورد مدیر',
  emptyDescription:
    'هنوز پروژه‌ای به شما تخصیص داده نشده است. از ادمین بخواهید شما را به‌عنوان مدیر پروژه روی یک پروژه منصوب کند.',
} as const

export { MANAGER_DASHBOARD_COPY, getManagerDashboardCopy } from '@/features/manager/lib/i18n/dashboard-copy'

export function buildManagerHelpLinks(hrefs: {
  inbox: (() => string) | null
  evm?: string
  scheduleIntel?: string
  attendance?: string
  inventory?: string
  invoices?: string
}): ManagerHelpCopyLink[] {
  const candidates: (ManagerHelpCopyLink | null)[] = [
    { label: 'همهٔ هشدارها', description: 'فهرست کامل هشدارها با فیلتر حوزه و سطح', href: '/dashboard/manager/alerts' },
    { label: 'بک‌گراند محاسبات', description: 'فرمول و ریز محاسبهٔ هر عدد داشبورد', href: '/dashboard/manager/background' },
    { label: 'جدول داده‌ها (Store)', description: 'پیشرفت، تعهد هفته و PPC هر فعالیت از منبع مشترک', href: '/dashboard/manager/store' },
    { label: 'برآورد و کنترل هزینه', description: 'ارزش قرارداد، BAC، هزینهٔ واقعی و EAC', href: '/dashboard/manager/estimate' },
    hrefs.inbox ? { label: 'کارتابل من', description: 'تصمیم‌ها و تأییدهای در انتظار', href: hrefs.inbox() } : null,
    hrefs.evm ? { label: 'شاخص‌های ارزش کسب‌شده', description: 'جزئیات SPI، CPI و فعالیت‌ها', href: hrefs.evm } : null,
    hrefs.scheduleIntel
      ? { label: 'تحلیل زمان‌بندی و مسیر بحرانی', description: 'فعالیت‌های بحرانی و شناوری', href: hrefs.scheduleIntel }
      : null,
    hrefs.attendance ? { label: 'منابع انسانی و تردد', description: 'حضور و تردد امروز کارگاه', href: hrefs.attendance } : null,
    hrefs.inventory ? { label: 'انبار و مصالح', description: 'موجودی و اقلام زیر حداقل', href: hrefs.inventory } : null,
    hrefs.invoices ? { label: 'صورت‌وضعیت‌های کارفرما', description: 'ارسال‌شده، در انتظار و پرداخت‌شده', href: hrefs.invoices } : null,
  ]
  return candidates.filter((c): c is ManagerHelpCopyLink => c != null)
}

export const PERIOD_WORDS: Record<ManagerPeriod, { current: string; previous: string }> = {
  today: { current: 'امروز', previous: 'دیروز' },
  week: { current: 'این هفته', previous: 'هفتهٔ قبل' },
  month: { current: 'این ماه', previous: 'ماه قبل' },
}

export const PERIOD_REPORT_TITLES: Record<ManagerPeriod, string> = {
  today: 'گزارش امروز',
  week: 'گزارش هفتهٔ جاری',
  month: 'گزارش ماه جاری',
}
