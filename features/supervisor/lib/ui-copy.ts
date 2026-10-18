/**
 * @file features/supervisor/lib/ui-copy.ts
 * @purpose برچسب‌های باقی‌مانده UI سرپرست کارگاه — FA / EN (DE→EN)
 * @safe-to-edit YES
 * @affects گزارش روزانه، بک‌گراند، نمای کلی، نقشه زون
 * @depends-on shared/lib/i18n/make-live-copy
 */

import { makeLiveCopy } from '@/shared/lib/i18n/make-live-copy'

const PUNCT_FA = {
  percent: '٪',
  listSep: '، ',
  persianDigits: '۰۱۲۳۴۵۶۷۸۹',
  arabicDigits: '٠١٢٣٤٥٦٧٨٩',
} as const

const PUNCT_EN = {
  percent: '%',
  listSep: ', ',
  persianDigits: '۰۱۲۳۴۵۶۷۸۹',
  arabicDigits: '٠١٢٣٤٥٦٧٨٩',
} as const

export const SUPERVISOR_PUNCT = makeLiveCopy({
  fa: PUNCT_FA,
  en: PUNCT_EN as unknown as typeof PUNCT_FA,
})

const COPY_FA = {
  pct: (n: string | number) => `${n}${PUNCT_FA.percent}`,
  labeledPct: (label: string, n: string | number) => `${label}: ${n}${PUNCT_FA.percent}`,
  weekN: (n: string) => `هفته ${n}`,
  notReached: 'هنوز نرسیده',
  dayProgress: 'پیشرفت روز',
  cumulative: 'تجمعی',
  currentWeek: '(جاری)',
  weekProgress: 'پیشرفت هفته:',
  cumulativeColon: 'تجمعی:',
  start: 'شروع:',
  finish: 'پایان:',
  locationPrefix: 'محل:',
  recorded: 'ثبت شده',
  todayCumulativePct: 'درصد پیشرفت تجمعی امروز',
  todayRecord: 'ثبت امروز',
  todayProgress: 'پیشرفت امروز:',
  waitingToday: 'در انتظار ثبت امروز',
  edit: 'ویرایش',
  cancel: 'انصراف',
  between: (min: string, max: string) => `عددی بین ${min} و ${max} وارد کنید`,
  selectProject: 'ابتدا یک پروژه انتخاب کنید.',
  todayReportDate: 'امروز — تاریخ گزارش روزانه',
  reportableActivity: 'فعالیت قابل گزارش',
  remainingToday: (n: string) => `${n} فعالیت باقی‌مانده برای ثبت امروز`,
  hintStrong: 'فعالیت‌های ایام جاری',
  hintBefore: 'همه ',
  hintAfter: ' و کارهای قبلی که هنوز 100٪ نشده‌اند اینجا می‌آیند.',
  hintLine2:
    'اگر فعالیت قبلی 100٪ شود، فعالیت بعدی حتی قبل از تاریخ شروع برنامه‌ای هم برای ثبت درصد می‌آید.',
  filterAll: (n: string) => `همه (${n})`,
  filterCurrent: (n: string) => `ایام جاری (${n})`,
  filterPast: (n: string) => `کار قبلی (${n})`,
  noSubItems:
    'هنوز زیرشاخه از دفتر فنی ثبت نشده — در داشبورد دفتر فنی → «برنامه زمانبندی» زیرشاخه و مقدار تعریف کنید.',
  sectionHeader: 'سرتیتر فعالیت',
  itemSaved: 'این مورد ثبت شد.',
  voicePct: (name: string, pct: number) => `${name}: ${pct}${PUNCT_FA.percent}`,
  previousReports: 'گزارش‌های ثبت‌شده قبلی',
  activityCol: 'فعالیت (آخرین نسخه برنامه)',
  legendDayPct: ' درصد تجمعی ثبت‌شده در آن روز',
  legendWindow: 'بازهٔ همان فعالیت در برنامه زمان‌بندی',
  today: 'امروز',
  friday: 'جمعه',
  recordedHoliday: 'تعطیل ثبت‌شده',
  grayParents: 'ردیف‌های خاکستری سرشاخه‌اند و درصدشان از زیرشاخه‌ها حساب می‌شود.',
  totalProgress: 'پیشرفت کل',
  quickProgress: 'نمای سریع پیشرفت پروژه',
  sameWeighted: 'همان میانگین وزنی منحنی بالا تا امروز',
  donePct: (n: string) => `انجام‌شده ${n}${PUNCT_FA.percent}`,
  remainingPct: (n: string) => `باقی‌مانده ${n}${PUNCT_FA.percent}`,
  pick: 'انتخاب',
  loadingMap: 'بارگذاری نقشه…',
} as const

const COPY_EN = {
  pct: (n: string | number) => `${n}${PUNCT_EN.percent}`,
  labeledPct: (label: string, n: string | number) => `${label}: ${n}${PUNCT_EN.percent}`,
  weekN: (n: string) => `Week ${n}`,
  notReached: 'Not reached yet',
  dayProgress: 'Day progress',
  cumulative: 'Cumulative',
  currentWeek: '(current)',
  weekProgress: 'Week progress:',
  cumulativeColon: 'Cumulative:',
  start: 'Start:',
  finish: 'Finish:',
  locationPrefix: 'Location:',
  recorded: 'Recorded',
  todayCumulativePct: 'Today’s cumulative progress %',
  todayRecord: 'Today’s record',
  todayProgress: 'Today’s progress:',
  waitingToday: 'Awaiting today’s record',
  edit: 'Edit',
  cancel: 'Cancel',
  between: (min: string, max: string) => `Enter a number between ${min} and ${max}`,
  selectProject: 'Select a project first.',
  todayReportDate: 'Today — daily report date',
  reportableActivity: 'Reportable activity',
  remainingToday: (n: string) => `${n} activities left to record today`,
  hintStrong: 'Current-period activities',
  hintBefore: 'All ',
  hintAfter: ' and earlier work not yet at 100% appear here.',
  hintLine2:
    'When a previous activity hits 100%, the next one becomes available for % entry even before its planned start.',
  filterAll: (n: string) => `All (${n})`,
  filterCurrent: (n: string) => `Current period (${n})`,
  filterPast: (n: string) => `Earlier work (${n})`,
  noSubItems:
    'No technical-office sub-items yet — define them under Technical Office → Schedule.',
  sectionHeader: 'Activity header',
  itemSaved: 'This item was saved.',
  voicePct: (name: string, pct: number) => `${name}: ${pct}${PUNCT_EN.percent}`,
  previousReports: 'Previously recorded reports',
  activityCol: 'Activity (latest schedule version)',
  legendDayPct: ' cumulative % recorded that day',
  legendWindow: 'That activity’s window on the schedule',
  today: 'Today',
  friday: 'Friday',
  recordedHoliday: 'Recorded holiday',
  grayParents: 'Gray rows are parents; their % is computed from children.',
  totalProgress: 'Total progress',
  quickProgress: 'Quick project progress view',
  sameWeighted: 'Same weighted average as the curve above to today',
  donePct: (n: string) => `Done ${n}${PUNCT_EN.percent}`,
  remainingPct: (n: string) => `Remaining ${n}${PUNCT_EN.percent}`,
  pick: 'Select',
  loadingMap: 'Loading map…',
} as const

export const SUPERVISOR_COPY = makeLiveCopy({
  fa: COPY_FA,
  en: COPY_EN as unknown as typeof COPY_FA,
})

const ZONE_FA = {
  discipline: 'رشته نقشه',
  pickDrawing: 'انتخاب نقشه — پیش‌نمایش (بارگذاری دفتر فنی)',
  noDrawingsInDiscipline: 'در این رشته هنوز نقشه‌ای از دفتر فنی بارگذاری نشده است.',
  zoneColor: 'رنگ زون:',
  drawTool: 'ابزار ترسیم:',
  zoneShape: 'شکل زون:',
  marking: 'علامت‌گذاری:',
  eraseMarks: 'پاک‌کردن علامت‌ها',
  saveText: 'ثبت متن',
} as const

const ZONE_EN = {
  discipline: 'Drawing discipline',
  pickDrawing: 'Select drawing — preview (technical-office upload)',
  noDrawingsInDiscipline: 'No technical-office drawing uploaded in this discipline yet.',
  zoneColor: 'Zone color:',
  drawTool: 'Draw tool:',
  zoneShape: 'Zone shape:',
  marking: 'Markup:',
  eraseMarks: 'Clear marks',
  saveText: 'Save text',
} as const

export const ZONE_MAP_COPY = makeLiveCopy({
  fa: ZONE_FA,
  en: ZONE_EN as unknown as typeof ZONE_FA,
})

const PREVIEW_FA = {
  dwgUnsupported: 'پیش‌نمایش DWG در مرورگر پشتیبانی نمی‌شود',
  dwgHint: 'فایل بارگذاری‌شده ذخیره شده — برای زون‌بندی از نقشه PDF استفاده کنید.',
  improvingQuality: 'در حال بهبود کیفیت…',
  previewUnavailable: 'پیش‌نمایش در دسترس نیست',
} as const

const PREVIEW_EN = {
  dwgUnsupported: 'DWG preview is not supported in the browser',
  dwgHint: 'The uploaded file is saved — use a PDF drawing for zoning.',
  improvingQuality: 'Improving quality…',
  previewUnavailable: 'Preview unavailable',
} as const

export const DRAWING_PREVIEW_COPY = makeLiveCopy({
  fa: PREVIEW_FA,
  en: PREVIEW_EN as unknown as typeof PREVIEW_FA,
})
