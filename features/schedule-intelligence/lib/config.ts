/**
 * @file features/schedule-intelligence/lib/config.ts
 * @purpose تنظیمات و برچسب‌ها — تحلیل کیفیت برنامه و آپلود MSP (config)
 * @safe-to-edit YES
 * @affects تحلیل کیفیت برنامه و آپلود MSP
 * @depends-on shared/types/schedule-intelligence
 */

import type { ScheduleAnalysisConfig } from '@/shared/types/schedule-intelligence'

/** Central configuration — do not scatter thresholds across modules. */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleAnalysisConfig = {
  analysisDate: new Date().toISOString().slice(0, 10),
  minutesPerDay: 480,
  minutesPerWeek: 2400,
  daysPerMonth: 20,
  weekendDays: [6, 0],
  criticalFloatEpsilonMinutes: 0,
  nearCriticalFloatDays: 10,
  riskWeights: {
    criticality: 30,
    float: 25,
    status: 20,
    duration: 10,
    dependency: 10,
    dataQuality: 5,
  },
  riskThresholds: { low: 25, medium: 50, high: 75 },
  topN: 10,
  includeSummaryInReports: false,
  honorProjectDeadline: false,
  timezonePolicy: 'utc-date',
}

export function mergeScheduleConfig(
  partial?: Partial<ScheduleAnalysisConfig>
): ScheduleAnalysisConfig {
  return { ...DEFAULT_SCHEDULE_CONFIG, ...partial }
}

export const SCHEDULE_INTELLIGENCE_COPY = {
  title: 'تحلیل زمان‌بندی',
  description: 'داشبورد هوشمند زمان‌بندی ساخت — CPM قطعی، بدون هوش مصنوعی',
  analysisDate: 'تاریخ تحلیل',
  processing: 'در حال پردازش و محاسبه CPM...',
  executive: 'خلاصه مدیریتی',
  activityStatus: 'وضعیت فعالیت‌ها',
  riskSpread: 'توزیع ریسک',
  longest: 'طولانی‌ترین فعالیت‌ها',
  dependencyTypes: 'نوع وابستگی‌ها',
  allActivities: 'همه فعالیت‌ها',
  highRisk: 'فعالیت‌های پرریسک',
  criticalPath: 'مسیر بحرانی',
  alerts: 'هشدارها و خطاها',
  fatal: 'خطاهای بحرانی در داده — نتایج CPM ممکن است نامعتبر باشد. بخش اعتبارسنجی را بررسی کنید.',
  tabs: {
    overview: 'خلاصه',
    activities: 'فعالیت‌ها',
    risk: 'ریسک',
    validation: 'اعتبارسنجی',
  },
  kpi: {
    leaf: 'فعالیت‌های اجرایی',
    duration: 'مدت شبکه (روز)',
    critical: 'بحرانی',
    avgProgress: 'میانگین پیشرفت %',
  },
  statusLabels: {
    'not-started': 'شروع‌نشده',
    'in-progress': 'در حال انجام',
    completed: 'تکمیل',
    unknown: 'نامشخص',
  },
  riskLabels: {
    low: 'کم',
    medium: 'متوسط',
    high: 'زیاد',
    veryHigh: 'خیلی زیاد',
  },
  searchPlaceholder: 'جستجو نام، WBS، UID...',
  analyzeFailed: 'خطا در تحلیل',
  projectDurationCpm: 'مدت کل پروژه (CPM):',
  days: 'روز',
  shareColumnHint: '— ستون «سهم از کل» = مدت هر فعالیت ÷ مدت کل پروژه',
  colName: 'نام',
  colDuration: 'مدت (روز)',
  colShare: 'سهم از کل',
  colProgress: 'پیشرفت',
  colFloat: 'شناوری',
  colRisk: 'ریسک',
  colCritical: 'بحرانی',
  percent: '٪',
  showingFirst: (total: string) => `نمایش 200 از ${total} فعالیت`,
  close: 'بستن',
  status: 'وضعیت',
  totalFloatDays: 'شناوری کل (روز)',
  riskScore: 'امتیاز ریسک',
  riskReasons: 'دلایل ریسک',
  predecessors: 'پیش‌نیازها',
  successors: 'پس‌نیازها',
  listSep: '، ',
  criticalChains: (activities: string, chains: string) =>
    `${activities} فعالیت بحرانی — ${chains} زنجیره`,
  validationLine: (errors: string, warnings: string) =>
    `خطا: ${errors} — هشدار: ${warnings}`,
  xmlOnly: 'فقط فایل XML Microsoft Project پشتیبانی می‌شود',
  readFailed: 'خواندن فایل ناموفق بود',
  uploadTitle: 'بارگذاری فایل زمان‌بندی',
  uploadHint:
    'فایل XML خروجی Microsoft Project — پردازش کاملاً محلی در مرورگر، بدون ارسال به سرور یا هوش مصنوعی.',
  clickXml: 'کلیک برای انتخاب XML',
  anyFileName: 'هر نام فایل — بدون محدودیت نام خاص',
  xmlProgram: 'XML برنامه',
} as const

/** Domain / parse / risk messages shown in the dashboard. */
export const SCHEDULE_LIB_COPY = {
  unknownLinkType: (num: number) => `نوع رابطه ناشناخته (${num}) — FS به‌عنوان پیش‌فرض استفاده شد`,
  emptyXml: 'فایل XML خالی است',
  invalidXml: 'XML نامعتبر — از Microsoft Project به‌صورت XML ذخیره کنید',
  notMspProject: 'فایل MSP XML معتبر نیست (ریشه Project وجود ندارد)',
  missingUid: 'فعالیت بدون UID معتبر',
  duplicateUid: (uid: string) => `UID تکراری: ${uid}`,
  missingName: 'فعالیت بدون نام',
  activityFallback: (uid: string) => `فعالیت ${uid}`,
  selfDependency: 'وابستگی به خود',
  negativeLag: 'Lag منفی',
  orphanPredecessor: (uid: string) => `پیش‌نیاز ناشناخته UID=${uid}`,
  missingProjectDates: 'تاریخ شروع یا پایان پروژه در XML موجود نیست',
  noTasks: 'هیچ فعالیتی در XML پیدا نشد',
  cycleDetected: 'شبکه وابستگی حلقه دارد — CPM معتبر نیست',
  daysSuffix: (days: string) => `${days} روز`,
  projectFallback: 'پروژه',
  unknown: 'نامشخص',
  listSep: '، ',
  andSep: ' و ',
  validationErrors: (n: string) => `${n} خطای اعتبارسنجی`,
  validationWarnings: (n: string) => `${n} هشدار`,
  qualityAttention: (parts: string) => `توجه: ${parts} در داده‌ها ثبت شد.`,
  qualityOk: 'کیفیت داده‌ها برای تحلیل قابل قبول است.',
  calendarNote:
    ' محاسبه روز کاری با تقویم پیش‌فرض انجام شده و ممکن است با تقویم واقعی پروژه متفاوت باشد.',
  cpmFailed: (activities: string, deps: string) =>
    `تحلیل CPM به‌دلیل خطا در شبکه وابستگی (مثلاً حلقه) انجام نشد. فایل شامل ${activities} فعالیت و ${deps} رابطه است. `,
  summaryBody: (p: {
    activities: string
    deps: string
    duration: string
    start: string
    finish: string
    critical: string
    phase: string
  }) =>
    `این برنامه شامل ${p.activities} فعالیت اجرایی و ${p.deps} رابطه است. ` +
    `مدت شبکه محاسبه‌شده پروژه ${p.duration} روز است و بازه برنامه از ${p.start} تا ${p.finish} ادامه دارد. ` +
    `تعداد ${p.critical} فعالیت در مسیر بحرانی محاسبه‌شده قرار گرفته‌اند. ` +
    `بیشترین تمرکز ریسک در فاز «${p.phase}» مشاهده شد. `,
  topRisks: (names: string) => `مهم‌ترین فعالیت‌های قابل پیگیری: ${names}. `,
  zeroDuration: 'فعالیت با مدت صفر (احتمالاً milestone)',
  finishBeforeStart: 'تاریخ پایان قبل از تاریخ شروع',
  invalidPercent: 'درصد پیشرفت نامعتبر',
  openStart: 'فعالیت بدون پیش‌نیاز (شروع باز)',
  openFinish: 'فعالیت بدون پس‌نیاز (پایان باز)',
  hasConstraint: (type: number) => `محدودیت تاریخ (نوع ${type})`,
  duplicateDependency: 'وابستگی تکراری',
  calendarUnavailable: (hours: string) =>
    `تقویم کامل پروژه در دسترس نیست — روزهای کاری با پیش‌فرض ${hours} ساعت/روز محاسبه می‌شوند`,
  remainingMismatch: 'اختلاف بین مدت مانده منبع و محاسبه‌شده',
  riskOnCritical: 'فعالیت روی مسیر بحرانی محاسبه‌شده قرار دارد.',
  riskNearCritical: 'فعالیت نزدیک به بحرانی (شناوری کم) است.',
  riskNegativeFloat: 'فعالیت دارای شناوری منفی است.',
  riskZeroFloat: 'شناوری کل فعالیت صفر است.',
  riskFloatUnder5: 'شناوری کل کمتر از 5 روز کاری است.',
  riskFloatNear: 'شناوری کل در محدوده نزدیک به بحرانی است.',
  riskDurationP90: 'مدت فعالیت در صدک 90 یا بالاتر قرار دارد.',
  riskDurationP75: 'مدت فعالیت در صدک 75 یا بالاتر قرار دارد.',
  riskManySuccessors: 'این فعالیت به تعداد زیادی فعالیت بعدی وابسته است.',
  riskManyDownstream: 'تعداد زیادی فعالیت پایین‌دست از این فعالیت تأثیر می‌گیرند.',
  riskShouldHaveStarted: 'فعالیت باید شروع شده باشد اما هنوز شروع نشده است.',
  riskPastFinish: 'فعالیت در حال انجام است اما از تاریخ پایان برنامه عبور کرده.',
  riskValidationError: 'فعالیت دارای خطای اعتبارسنجی داده است.',
  riskMissingDates: 'تاریخ شروع یا پایان فعالیت ناقص است.',
} as const
