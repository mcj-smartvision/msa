/**
 * @file features/manager/lib/i18n/shell-copy.ts
 * @purpose Live FA/EN/DE catalogs for manager shell UI (help, tour, punct, daily reports)
 * @safe-to-edit YES
 * @affects features/manager/config, daily-reports page, help/tour panels
 * @depends-on shared/lib/i18n/make-live-copy, features/manager/lib/overview-types
 */

import type { ManagerPeriod } from '@/features/manager/lib/overview-types'
import { getActiveLocale } from '@/shared/lib/i18n/active-locale'
import { makeLiveCopy } from '@/shared/lib/i18n/make-live-copy'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

export interface ManagerTourCopyStep {
  target: string
  title: string
  body: string
}

const UI_FA = {
  about: (label: string) => `دربارهٔ ${label}`,
  loading: 'در حال بارگذاری…',
  notLoaded: 'داده هنوز بارگذاری نشده است',
  notConnected: 'داده هنوز متصل نشده',
  sectionFailed: 'بارگذاری این بخش ناموفق بود',
} as const

const UI_EN = {
  about: (label: string) => `About ${label}`,
  loading: 'Loading…',
  notLoaded: 'Data not loaded yet',
  notConnected: 'Data not connected yet',
  sectionFailed: 'Failed to load this section',
} as const

export const MANAGER_UI_COPY = makeLiveCopy({ fa: UI_FA, en: UI_EN as unknown as typeof UI_FA })

const TOUR_FA = {
  stepOf: (index: string, total: string) => `مرحلهٔ ${index} از ${total}`,
  close: 'بستن تور',
  skip: 'رد کردن',
  prev: 'قبلی',
  next: 'بعدی',
  end: 'پایان',
} as const

const TOUR_EN = {
  stepOf: (index: string, total: string) => `Step ${index} of ${total}`,
  close: 'Close tour',
  skip: 'Skip',
  prev: 'Previous',
  next: 'Next',
  end: 'Done',
} as const

export const MANAGER_TOUR_COPY = makeLiveCopy({ fa: TOUR_FA, en: TOUR_EN as unknown as typeof TOUR_FA })

const TOUR_STEPS_FA = [
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
] as const

const TOUR_STEPS_EN = [
  {
    target: 'health',
    title: 'Project health bar',
    body: 'Five main pillars — schedule, cost, safety, quality and materials — at a glance. The header status comes from the worst pillar.',
  },
  {
    target: 'kpis',
    title: 'Four key metrics',
    body: 'Cumulative progress vs plan, schedule variance (days and SPI), cost variance (BAC, EV, AC and CPI) and overdue actions.',
  },
  {
    target: 'pulse',
    title: 'Live site pulse',
    body: 'Latest daily report, warehouse, safety and gate records. If something is stale, send a reminder notification to the owner.',
  },
  {
    target: 'alerts',
    title: 'Smart alerts',
    body: 'Only the three highest-priority alerts, with domain, likely impact and a system suggestion. Red means crisis; amber means needs attention. The full list opens from the bottom of this card.',
  },
  {
    target: 'chart',
    title: 'Progress S-curve',
    body: 'Plan (PV), approved actual progress and earned value (EV) left to right over time. The “today” point matches the cards above.',
  },
] as const

export function getManagerTourSteps(): ManagerTourCopyStep[] {
  return pickMessages(getActiveLocale(), {
    fa: TOUR_STEPS_FA as unknown as ManagerTourCopyStep[],
    en: TOUR_STEPS_EN as unknown as ManagerTourCopyStep[],
    de: TOUR_STEPS_EN as unknown as ManagerTourCopyStep[],
  })
}

/** Array-like live proxy so `.map` / indexing follow the active locale. */
export const MANAGER_TOUR_STEPS: ManagerTourCopyStep[] = new Proxy([] as ManagerTourCopyStep[], {
  get(_target, prop) {
    const steps = getManagerTourSteps()
    const value = Reflect.get(steps, prop)
    return typeof value === 'function' ? value.bind(steps) : value
  },
})

const HELP_FA = {
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
  tourIntro:
    'هر بخش روی صفحه هایلایت می‌شود و در یک جمله توضیح داده می‌شود. با کلیدهای جهت‌نما هم می‌توانید جابه‌جا شوید.',
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
  links: {
    alerts: { label: 'همهٔ هشدارها', description: 'فهرست کامل هشدارها با فیلتر حوزه و سطح' },
    background: { label: 'بک‌گراند محاسبات', description: 'فرمول و ریز محاسبهٔ هر عدد داشبورد' },
    store: { label: 'جدول داده‌ها (Store)', description: 'پیشرفت، تعهد هفته و PPC هر فعالیت از منبع مشترک' },
    estimate: { label: 'برآورد و کنترل هزینه', description: 'ارزش قرارداد، BAC، هزینهٔ واقعی و EAC' },
    inbox: { label: 'کارتابل من', description: 'تصمیم‌ها و تأییدهای در انتظار' },
    evm: { label: 'شاخص‌های ارزش کسب‌شده', description: 'جزئیات SPI، CPI و فعالیت‌ها' },
    scheduleIntel: { label: 'تحلیل زمان‌بندی و مسیر بحرانی', description: 'فعالیت‌های بحرانی و شناوری' },
    attendance: { label: 'منابع انسانی و تردد', description: 'حضور و تردد امروز کارگاه' },
    inventory: { label: 'انبار و مصالح', description: 'موجودی و اقلام زیر حداقل' },
    invoices: { label: 'صورت‌وضعیت‌های کارفرما', description: 'ارسال‌شده، در انتظار و پرداخت‌شده' },
  },
} as const

const HELP_EN = {
  title: 'Help & system tour',
  subtitle: 'Everything you need to read the control room',
  close: 'Close help',
  tablist: 'Help sections',
  tabs: {
    tour: 'Intro tour',
    glossary: 'Glossary',
    colors: 'Colors',
    shortcuts: 'Shortcuts',
  },
  tourInteractive: (steps: string) => `${steps}-step interactive tour`,
  tourIntro: 'Each area is highlighted and explained in one sentence. You can also move with the arrow keys.',
  startTour: 'Start tour',
  glossary: [
    {
      abbr: 'SPI',
      title: 'Schedule performance index',
      name: 'Schedule Performance Index',
      body: 'How fast we are progressing vs plan (EV ÷ PV). 1 means exactly on plan; 0.9 means 90 of every 100 planned work units to date are done. Below 0.95 is amber; below 0.85 is red.',
    },
    {
      abbr: 'CPI',
      title: 'Cost performance index',
      name: 'Cost Performance Index',
      body: 'How much earned work we got per unit of cost (EV ÷ AC). Below 1 means we spent more than the value of work performed.',
    },
    {
      abbr: 'EV',
      title: 'Earned value',
      name: 'Earned Value',
      body: 'Monetary value of work actually done and approved: each activity’s budget × its approved progress %.',
    },
    {
      abbr: 'AC',
      title: 'Actual cost',
      name: 'Actual Cost',
      body: 'Total cost paid or recorded to date (cost documents, invoices and overhead).',
    },
    {
      abbr: 'NCR',
      title: 'Non-conformance report',
      name: 'Non-Conformance Report',
      body: 'Raised when work does not match drawings, specs or standards. An open NCR means it is not yet corrected or closed.',
    },
    {
      abbr: 'PV',
      title: 'Planned value',
      name: 'Planned Value',
      body: 'Value of work that should have been done by today per the baseline — the “plan” line on the S-curve.',
    },
    {
      abbr: 'BAC',
      title: 'Budget at completion',
      name: 'Budget at Completion',
      body: 'Approved total project budget; the basis for all value percentages.',
    },
    {
      abbr: 'SV / CV',
      title: 'Schedule and cost variance',
      name: 'Schedule / Cost Variance',
      body: 'Schedule variance is in days (when the plan would have reached today’s progress). Cost variance = EV − AC; negative means cost overrun.',
    },
  ],
  colors: [
    {
      label: 'Healthy / up to date',
      title: 'Green',
      body: 'The metric is in range or data was recorded within the allowed window; no action needed.',
    },
    {
      label: 'Stale / needs attention',
      title: 'Amber',
      body: 'An adverse trend has started or recording is past the threshold; follow up soon or send a reminder.',
    },
    {
      label: 'Critical',
      title: 'Red',
      body: 'Only for serious risk or site stoppage: negative float, SPI/CPI below 0.85, material stock-out or critical NCR. Needs immediate action.',
    },
    {
      label: 'Not connected',
      title: 'Gray',
      body: 'This section’s data is not recorded or connected yet. Instead of a misleading zero, we show “data not connected yet”.',
    },
  ],
  colorsNote:
    'Each color also has text and status icons so meaning is not color-only. The thin bar on alert cards uses the same palette: red for critical, amber for needs attention.',
  quickLinks: 'Quick links',
  shortcutsTitle: 'Keyboard shortcuts',
  shortcutOpen: 'Open this help panel',
  shortcutClose: 'Close help, tour or menus',
  shortcutTour: 'Next / previous tour step',
  tipsTitle: 'Tips',
  tipHealthLead: 'Health bar',
  tipHealth: ' or a metric card to jump straight to that section’s detail page.',
  tipPeriodLead: 'Header time range',
  tipPeriod: ' marks alerts recorded in that range as “fresh”; active alerts are never hidden.',
  tipRefresh: 'Data refreshes every 5 minutes and when you return to this tab; the header sync button refreshes immediately.',
  tipInfoLead: 'i',
  tipInfoPrefix: 'The ',
  tipInfo: ' icon next to each card title explains the data source and how it is calculated.',
  tipOnEach: 'On each pillar ',
  unavailableTitle: 'Sections not yet in the menu:',
  links: {
    alerts: { label: 'All alerts', description: 'Full alert list with domain and severity filters' },
    background: { label: 'Calculation background', description: 'Formula and line-by-line math for every dashboard figure' },
    store: { label: 'Data table (Store)', description: 'Progress, weekly commitment and PPC per activity from the shared source' },
    estimate: { label: 'Estimate & cost control', description: 'Contract value, BAC, actual cost and EAC' },
    inbox: { label: 'My inbox', description: 'Pending decisions and approvals' },
    evm: { label: 'Earned value metrics', description: 'SPI, CPI and activity detail' },
    scheduleIntel: { label: 'Schedule intelligence & critical path', description: 'Critical activities and float' },
    attendance: { label: 'Workforce & attendance', description: 'Today’s site presence and gate traffic' },
    inventory: { label: 'Warehouse & materials', description: 'Stock and below-minimum items' },
    invoices: { label: 'Employer invoices', description: 'Sent, pending and paid' },
  },
} as const

export const MANAGER_HELP_COPY = makeLiveCopy({ fa: HELP_FA, en: HELP_EN as unknown as typeof HELP_FA })

const PUNCT_FA = {
  percent: '٪',
  list: '، ',
  comma: '،',
  dash: ' — ',
  semi: '؛ ',
  colon: ' · ',
} as const

const PUNCT_EN = {
  percent: '%',
  list: ', ',
  comma: ',',
  dash: ' — ',
  semi: '; ',
  colon: ' · ',
} as const

export const MANAGER_PUNCT = makeLiveCopy({ fa: PUNCT_FA, en: PUNCT_EN as unknown as typeof PUNCT_FA })

const DAILY_REPORTS_FA = {
  title: 'گزارش‌های روزانه کارگاه',
  hint: 'تأیید مدیر فعلاً غیرفعال است — سرپرست با «تأیید نهایی و آرشیو» مستقیماً در آرشیو ثبت می‌کند.',
  disabledBanner: 'تأیید مدیر گزارش روزانه فعلاً برداشته شده است.',
  pendingTitle: 'منتظر تأیید شما',
  archiveTitle: 'آرشیو ارسال‌شده‌ها',
  approveCta: 'تأیید گزارش',
  approveOk: 'گزارش تأیید شد',
  approveFailed: 'تأیید گزارش ناموفق بود',
  loadFailed: 'خواندن گزارش‌ها ناموفق بود',
  emptyPending: 'گزارش منتظر تأییدی نیست.',
  emptyArchive: 'هنوز گزارشی ارسال نشده است.',
  statusSubmitted: 'آرشیو شده',
  statusApproved: 'آرشیو شده',
  backToManager: 'بازگشت به داشبورد مدیر',
  selectProject: 'ابتدا پروژه را از بالای صفحه انتخاب کنید.',
  noNote: 'بدون متن یادداشت',
  loading: 'در حال بارگذاری…',
} as const

const DAILY_REPORTS_EN = {
  title: 'Site daily reports',
  hint: 'Manager approval is currently off — the supervisor archives directly with “Final approve & archive”.',
  disabledBanner: 'Manager approval for daily reports is currently disabled.',
  pendingTitle: 'Awaiting your approval',
  archiveTitle: 'Submitted archive',
  approveCta: 'Approve report',
  approveOk: 'Report approved',
  approveFailed: 'Failed to approve report',
  loadFailed: 'Failed to load reports',
  emptyPending: 'No report awaiting approval.',
  emptyArchive: 'No report submitted yet.',
  statusSubmitted: 'Archived',
  statusApproved: 'Archived',
  backToManager: 'Back to manager dashboard',
  selectProject: 'Select a project from the top of the page first.',
  noNote: 'No note text',
  loading: 'Loading…',
} as const

export const MANAGER_DAILY_REPORTS_COPY = makeLiveCopy({
  fa: DAILY_REPORTS_FA,
  en: DAILY_REPORTS_EN as unknown as typeof DAILY_REPORTS_FA,
})

const PERIOD_WORDS_FA: Record<ManagerPeriod, { current: string; previous: string }> = {
  today: { current: 'امروز', previous: 'دیروز' },
  week: { current: 'این هفته', previous: 'هفتهٔ قبل' },
  month: { current: 'این ماه', previous: 'ماه قبل' },
}

const PERIOD_WORDS_EN: Record<ManagerPeriod, { current: string; previous: string }> = {
  today: { current: 'Today', previous: 'Yesterday' },
  week: { current: 'This week', previous: 'Last week' },
  month: { current: 'This month', previous: 'Last month' },
}

export const PERIOD_WORDS = makeLiveCopy({
  fa: PERIOD_WORDS_FA,
  en: PERIOD_WORDS_EN as unknown as typeof PERIOD_WORDS_FA,
})

const PERIOD_REPORT_TITLES_FA: Record<ManagerPeriod, string> = {
  today: 'گزارش امروز',
  week: 'گزارش هفتهٔ جاری',
  month: 'گزارش ماه جاری',
}

const PERIOD_REPORT_TITLES_EN: Record<ManagerPeriod, string> = {
  today: 'Today’s report',
  week: 'Current week report',
  month: 'Current month report',
}

export const PERIOD_REPORT_TITLES = makeLiveCopy({
  fa: PERIOD_REPORT_TITLES_FA,
  en: PERIOD_REPORT_TITLES_EN as unknown as typeof PERIOD_REPORT_TITLES_FA,
})

const DASHBOARD_FA = {
  title: 'داشبورد مدیر پروژه',
  emptyTitle: 'داشبورد مدیر',
  emptyDescription:
    'هنوز پروژه‌ای به شما تخصیص داده نشده است. از ادمین بخواهید شما را به‌عنوان مدیر پروژه روی یک پروژه منصوب کند.',
} as const

const DASHBOARD_EN = {
  title: 'Project manager dashboard',
  emptyTitle: 'Manager dashboard',
  emptyDescription:
    'No project is assigned to you yet. Ask an admin to appoint you as project manager on a project.',
} as const

export const DASHBOARD_CONFIG = makeLiveCopy({
  fa: DASHBOARD_FA,
  en: DASHBOARD_EN as unknown as typeof DASHBOARD_FA,
})
