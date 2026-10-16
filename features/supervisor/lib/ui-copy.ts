/**
 * @file features/supervisor/lib/ui-copy.ts
 * @purpose برچسب‌های فارسی باقی‌مانده UI سرپرست کارگاه
 * @safe-to-edit YES
 * @affects گزارش روزانه، بک‌گراند، نمای کلی، نقشه زون
 * @depends-on nothing
 */

export const SUPERVISOR_PUNCT = {
  percent: '٪',
  listSep: '، ',
  persianDigits: '۰۱۲۳۴۵۶۷۸۹',
  arabicDigits: '٠١٢٣٤٥٦٧٨٩',
} as const

export const SUPERVISOR_COPY = {
  pct: (n: string | number) => `${n}${SUPERVISOR_PUNCT.percent}`,
  labeledPct: (label: string, n: string | number) => `${label}: ${n}${SUPERVISOR_PUNCT.percent}`,
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
  voicePct: (name: string, pct: number) => `${name}: ${pct}${SUPERVISOR_PUNCT.percent}`,
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
  donePct: (n: string) => `انجام‌شده ${n}${SUPERVISOR_PUNCT.percent}`,
  remainingPct: (n: string) => `باقی‌مانده ${n}${SUPERVISOR_PUNCT.percent}`,

  pick: 'انتخاب',
  loadingMap: 'بارگذاری نقشه…',
} as const

export const ZONE_MAP_COPY = {
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

export const DRAWING_PREVIEW_COPY = {
  dwgUnsupported: 'پیش‌نمایش DWG در مرورگر پشتیبانی نمی‌شود',
  dwgHint: 'فایل بارگذاری‌شده ذخیره شده — برای زون‌بندی از نقشه PDF استفاده کنید.',
  improvingQuality: 'در حال بهبود کیفیت…',
  previewUnavailable: 'پیش‌نمایش در دسترس نیست',
} as const
