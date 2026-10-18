/**
 * @file features/manager/lib/i18n/overview-alerts.ts
 * @purpose Localized schedule-alert groups and common overview reason strings
 * @safe-to-edit YES
 * @affects load-manager-overview
 * @depends-on features/project-init/lib/i18n/types, shared/lib/i18n/pick-messages
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'
import type { ManagerAlert } from '@/features/manager/lib/overview-types'
import type { ScheduleAlertSeverity } from '@/features/schedule/lib/float-alerts'

type ScheduleGroup = {
  severities: ScheduleAlertSeverity[]
  level: ManagerAlert['level']
  title: string
  cause: string
  impact: string
  suggestion: string
}

const SCHEDULE_GROUPS_EN: ScheduleGroup[] = [
  {
    severities: ['negative'],
    level: 'critical',
    title: 'Negative float on the critical path',
    cause: 'Activities whose total float has gone negative.',
    impact: 'The project finish date slips under the current trend.',
    suggestion:
      'Approve a recovery plan (extra shifts or more crew) for these activities and align with the site supervisor.',
  },
  {
    severities: ['urgent', 'critical'],
    level: 'warning',
    title: 'Critical activities progressing slowly',
    cause: 'Critical-path activities whose progress rate is below plan.',
    impact: 'Each day of delay on these activities pushes the project finish out.',
    suggestion: 'Ask the site supervisor why (crew, materials or work front) and reallocate resources.',
  },
  {
    severities: ['near_critical', 'fast_consumption'],
    level: 'warning',
    title: 'Activities near the critical path',
    cause: 'These activities have little float or are consuming it faster than allowed.',
    impact: 'A few more days of delay will put them on the critical path.',
    suggestion: 'Review sequence and resources before they join the critical path.',
  },
]

const SCHEDULE_GROUPS_FA: ScheduleGroup[] = [
  {
    severities: ['negative'],
    level: 'critical',
    title: 'شناوری منفی روی مسیر بحرانی',
    cause: 'فعالیت‌هایی که شناوری آن‌ها منفی شده است.',
    impact: 'تاریخ پایان پروژه با روند فعلی عقب می‌افتد.',
    suggestion:
      'برنامهٔ جبرانی (شیفت اضافه یا نیروی بیشتر) برای این فعالیت‌ها تصویب و با سرپرست کارگاه هماهنگ کنید.',
  },
  {
    severities: ['urgent', 'critical'],
    level: 'warning',
    title: 'فعالیت‌های بحرانی با پیشرفت کند',
    cause: 'فعالیت‌های مسیر بحرانی که نرخ پیشرفتشان از برنامه پایین‌تر است.',
    impact: 'هر روز تأخیر این فعالیت‌ها مستقیماً پایان پروژه را عقب می‌اندازد.',
    suggestion: 'علت کندی (نیرو، مصالح یا جبههٔ کاری) را از سرپرست کارگاه بپرسید و منابع را جابه‌جا کنید.',
  },
  {
    severities: ['near_critical', 'fast_consumption'],
    level: 'warning',
    title: 'فعالیت‌های نزدیک به مسیر بحرانی',
    cause: 'شناوری این فعالیت‌ها کم است یا سریع‌تر از حد مجاز مصرف می‌شود.',
    impact: 'با چند روز تأخیر دیگر روی مسیر بحرانی قرار می‌گیرند.',
    suggestion: 'پیش از ورود به مسیر بحرانی، توالی و منابع این فعالیت‌ها را بازبینی کنید.',
  },
]

const REASONS_EN = {
  notBuilt: 'Tables for this section have not been created in the database yet.',
  evmLoadFailed: 'Failed to load EVM metrics',
  inboxLoadFailed: 'Failed to load inbox',
  genericError: 'Error',
  attendanceLoadFailed: 'Failed to load today’s attendance',
  ncrLoadFailed: 'Failed to load NCRs',
  hseMissing: 'No HSE alert has been recorded by the site supervisor for this project yet.',
  hseLoadFailed: 'Failed to load HSE alerts',
  invoicesMissing: 'No employer payment application has been recorded for this project yet.',
  invoicesLoadFailed: 'Failed to load payment applications',
  unnamedPackage: 'Untitled work package',
  unnamedWorkOrder: 'Untitled work order',
  sitePlanLoadFailed: 'Failed to load the daily site plan',
  progressUnavailable: 'EVM metrics are unavailable.',
  curveNeedsBaseline:
    'To draw the curve, activities need baseline dates and a budget (or weight).',
  unnamedPerson: 'Unnamed',
  inventoryMissing: 'No warehouse items have been recorded for this project yet.',
  inventoryMissingShort: 'No warehouse items recorded yet.',
  unnamedActivity: 'Untitled activity',
  costOverEarned: 'Actual cost exceeds earned value',
  criticalFloatBurn: 'Critical-path float is being consumed',
  overallBehind: 'Overall project is behind schedule',
  costOverBudgetTrend: 'At this trend, final project cost will exceed the budget.',
  scheduleSlipTrend: 'At this trend, the project finishes later than the contract date.',
  costSuggestion:
    'Reconcile cost documents with approved progress and review costs without matching progress.',
  scheduleSuggestion: 'Prioritize late activities and approve a recovery plan.',
  stockEmptyTitle: 'Materials stock is exhausted',
  stockEmptyCause: 'Warehouse stock for these items has reached zero.',
  stockEmptyImpact: 'Activities that depend on these materials will stop.',
  stockEmptySuggestion: 'Follow up urgently with procurement for a purchase order or transfer.',
  stockLowTitle: 'Materials below minimum stock',
  stockLowCause: 'Stock for these items has reached the minimum allowed.',
  stockLowImpact: 'If purchasing is delayed, dependent activities will slow down.',
  stockLowSuggestion: 'Place a purchase order before stock runs out.',
  stockLowItem: (name: string, current: string, min: string) => `${name} (${current} of ${min})`,
  ncrCriticalTitle: 'Open critical non-conformance',
  ncrCriticalCause: 'A critical-severity NCR has not been closed.',
  ncrCriticalImpact: 'Continuing work in the NCR area risks quality issues and rework.',
  ncrCriticalSuggestion: 'Stop work in the NCR area until corrective action and re-inspection.',
  ncrUnnumbered: 'NCR without number',
  noMemberWithRole: (role: string) => `No project member is assigned the role “${role}”.`,
  pulseDailyLabel: 'Supervisor daily report',
  pulseDailyDetail: (date: string, approved: boolean) =>
    `Report ${date}${approved ? ' · Approved' : ' · Pending approval'}`,
  pulseWarehouseLabel: 'Central warehouse stock',
  pulseItemCount: (n: string) => `${n} items`,
  pulseHseLabel: 'HSE safety checklist',
  pulseGateLabel: 'Security gate & attendance',
  pulseGatesActive: (n: string) => `${n} active gates`,
  pulseNoGates: 'No gate defined',
  physicalWeightMissing: 'Physical weights are not defined for schedule activities.',
  baselineMissing:
    'No baseline schedule is recorded for activities; delay versus plan cannot be calculated.',
  sourceSitePlan: 'Daily site plan',
  sourceInventory: 'Warehouse stock',
  sourceOpenNcrs: 'Open NCRs',
  sourcePlanningAlerts: 'Planning alerts',
  listSep: ', ',
  projectIdRequired: 'projectId is required',
  neverActivity: 'No activity recorded yet.',
  neverDaily: 'No daily report has been recorded for this project yet.',
  neverWarehouse: 'No warehouse items have been recorded yet.',
  hseDemo: 'The HSE module is not connected to live data yet; the safety page still shows demo data.',
  neverGate: 'No gate traffic has been recorded yet.',
  stoppedWorkOrders: 'Stopped work orders from today’s site plan (WBS match)',
  stoppedWoLabel: (constraints: string) =>
    constraints ? `Stopped work order — ${constraints}` : 'Today’s work order is marked “stopped”',
  openPlanningAlerts: 'Open planning alerts',
  openPlanningAlert: 'Open planning alert',
}

const REASONS_FA: typeof REASONS_EN = {
  notBuilt: 'جدول‌های این بخش هنوز در پایگاه داده ساخته نشده‌اند.',
  evmLoadFailed: 'بارگذاری شاخص‌های EVM ناموفق بود',
  inboxLoadFailed: 'بارگذاری کارتابل ناموفق بود',
  genericError: 'خطا',
  attendanceLoadFailed: 'بارگذاری تردد امروز ناموفق بود',
  ncrLoadFailed: 'بارگذاری NCR ناموفق بود',
  hseMissing: 'هنوز هشدار HSE از سرپرست کارگاه برای این پروژه ثبت نشده است.',
  hseLoadFailed: 'بارگذاری هشدارهای HSE ناموفق بود',
  invoicesMissing: 'هنوز صورت‌وضعیتی برای کارفرما در این پروژه ثبت نشده است.',
  invoicesLoadFailed: 'بارگذاری صورت‌وضعیت‌ها ناموفق بود',
  unnamedPackage: 'بستهٔ کاری بدون نام',
  unnamedWorkOrder: 'دستور کار بدون نام',
  sitePlanLoadFailed: 'بارگذاری برنامهٔ روزانهٔ کارگاه ناموفق بود',
  progressUnavailable: 'شاخص‌های EVM در دسترس نیست.',
  curveNeedsBaseline: 'برای رسم منحنی، فعالیت‌ها باید تاریخ baseline و بودجه (یا وزن) داشته باشند.',
  unnamedPerson: 'بدون نام',
  inventoryMissing: 'هنوز کالایی در انبار این پروژه ثبت نشده است.',
  inventoryMissingShort: 'هنوز کالایی در انبار ثبت نشده است.',
  unnamedActivity: 'فعالیت بدون نام',
  costOverEarned: 'هزینهٔ واقعی بیشتر از ارزش کار انجام‌شده',
  criticalFloatBurn: 'مصرف شناوری مسیر بحرانی',
  overallBehind: 'عقب‌ماندگی کلی پروژه از برنامه',
  costOverBudgetTrend: 'با این روند، هزینهٔ تمام‌شدهٔ پروژه از بودجه عبور می‌کند.',
  scheduleSlipTrend: 'با این روند، پروژه دیرتر از تاریخ قراردادی تمام می‌شود.',
  costSuggestion:
    'اسناد هزینه را با پیشرفت تأییدشده تطبیق دهید و هزینه‌های بدون پیشرفت متناظر را بررسی کنید.',
  scheduleSuggestion: 'فعالیت‌های عقب‌افتاده را اولویت‌بندی و برنامهٔ جبرانی را تصویب کنید.',
  stockEmptyTitle: 'موجودی مصالح تمام شده است',
  stockEmptyCause: 'موجودی انبار برای این اقلام به صفر رسیده است.',
  stockEmptyImpact: 'فعالیت‌های وابسته به این مصالح متوقف می‌شوند.',
  stockEmptySuggestion: 'سفارش فوری خرید یا انتقال از انبار دیگر را با تدارکات پیگیری کنید.',
  stockLowTitle: 'مصالح زیر حداقل موجودی',
  stockLowCause: 'موجودی این اقلام به حداقل مجاز رسیده است.',
  stockLowImpact: 'در صورت تأخیر در خرید، فعالیت‌های وابسته کند می‌شوند.',
  stockLowSuggestion: 'سفارش خرید را پیش از تمام‌شدن موجودی ثبت کنید.',
  stockLowItem: (name: string, current: string, min: string) => `${name} (${current} از ${min})`,
  ncrCriticalTitle: 'عدم انطباق بحرانی باز',
  ncrCriticalCause: 'NCR با شدت بحرانی بسته نشده است.',
  ncrCriticalImpact: 'ادامهٔ کار در محدودهٔ NCR ریسک کیفی و دوباره‌کاری دارد.',
  ncrCriticalSuggestion: 'کار در محدودهٔ NCR را تا اقدام اصلاحی و بازرسی مجدد متوقف کنید.',
  ncrUnnumbered: 'NCR بدون شماره',
  noMemberWithRole: (role: string) => `هیچ عضوی با سمت «${role}» در این پروژه ثبت نشده است.`,
  pulseDailyLabel: 'گزارش روزانهٔ سرپرست',
  pulseDailyDetail: (date: string, approved: boolean) =>
    `گزارش ${date}${approved ? ' · تأییدشده' : ' · منتظر تأیید'}`,
  pulseWarehouseLabel: 'موجودی انبار مرکزی',
  pulseItemCount: (n: string) => `${n} قلم کالا`,
  pulseHseLabel: 'چک‌لیست ایمنی HSE',
  pulseGateLabel: 'گیت حراست و حضور و غیاب',
  pulseGatesActive: (n: string) => `${n} گیت فعال`,
  pulseNoGates: 'گیتی تعریف نشده',
  physicalWeightMissing: 'وزن فیزیکی فعالیت‌های برنامه تعریف نشده است.',
  baselineMissing:
    'برنامهٔ مبنا (baseline) برای فعالیت‌ها ثبت نشده است؛ تأخیر نسبت به برنامه قابل محاسبه نیست.',
  sourceSitePlan: 'برنامهٔ روزانهٔ کارگاه',
  sourceInventory: 'موجودی انبار',
  sourceOpenNcrs: 'NCRهای باز',
  sourcePlanningAlerts: 'هشدارهای برنامه‌ریزی',
  listSep: '، ',
  projectIdRequired: 'projectId لازم است',
  neverActivity: 'هنوز فعالیتی ثبت نشده است.',
  neverDaily: 'هنوز گزارش روزانه‌ای برای این پروژه ثبت نشده است.',
  neverWarehouse: 'هنوز کالایی در انبار ثبت نشده است.',
  hseDemo: 'ماژول HSE هنوز به دادهٔ واقعی متصل نشده است؛ صفحهٔ ایمنی فعلاً دادهٔ نمایشی دارد.',
  neverGate: 'هنوز ترددی از گیت ثبت نشده است.',
  stoppedWorkOrders: 'دستور کارهای متوقف برنامهٔ امروز کارگاه (تطبیق WBS)',
  stoppedWoLabel: (constraints: string) =>
    constraints ? `دستور کار متوقف — ${constraints}` : 'دستور کار امروز «متوقف» ثبت شده',
  openPlanningAlerts: 'هشدارهای باز برنامه‌ریزی',
  openPlanningAlert: 'هشدار باز برنامه‌ریزی',
}

export function getOverviewScheduleGroups(locale: FormLocale): ScheduleGroup[] {
  return pickMessages(locale, { fa: SCHEDULE_GROUPS_FA, en: SCHEDULE_GROUPS_EN, de: SCHEDULE_GROUPS_EN })
}

export function getOverviewReasons(locale: FormLocale): typeof REASONS_EN {
  return pickMessages(locale, { fa: REASONS_FA, en: REASONS_EN, de: REASONS_EN })
}
