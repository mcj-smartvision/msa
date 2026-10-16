/**
 * @file features/schedule/lib/ui-copy.ts
 * @purpose برچسب‌ها و پیام‌های فارسی UI زمان‌بندی و گانت
 * @safe-to-edit YES
 * @affects صفحات زمان‌بندی، گانت، پیش‌نمایش و هشدار پیشرفت
 * @depends-on nothing
 */

export const GANTT_COPY = {
  recalcToast: 'برای اعمال روی مسیر بحرانی، محاسبه‌ی مجدد را اجرا کنید',
  loadFailed: 'بارگذاری گانت ناموفق بود',
  loadError: 'خطا در بارگذاری',
  dateSaveFailed: 'ذخیره تاریخ ناموفق بود',
  noNewChanges: 'تغییر جدیدی برای ثبت نیست',
  finalSavedCpm: (days: number) =>
    `ثبت نهایی شد — شناوری‌ها به‌روز شد (مدت پروژه ${days} روز)`,
  finalSavedDates: (hint: string) => `ثبت نهایی شد — تاریخ‌ها ذخیره شد · ${hint}`,
  finalSaveError: 'خطا در ثبت نهایی',
  cpmFailed: 'محاسبه CPM ناموفق بود',
  cpmDone: (days: number, alerts: number) =>
    `محاسبه انجام شد — طول پروژه ${days} روز، هشدار: ${alerts}`,
  calcError: 'خطا در محاسبه',
  pickProject: 'ابتدا یک پروژه را انتخاب کنید.',
  commitFinal: 'ثبت نهایی',
  calculating: 'در حال محاسبه…',
  calcCritical: 'محاسبه مسیر بحرانی',
  refresh: 'بروزرسانی',
  noLinks: 'پیوند وابستگی‌ای برای این پروژه نیست',
  hideLinkLines: 'مخفی کردن خطوط وابستگی',
  showLinkLines: 'نمایش خطوط وابستگی مثل MSP',
  hideDeps: 'مخفی کردن وابستگی‌ها',
  enableDeps: 'فعال کردن وابستگی‌ها',
  zoomOut: 'کوچک‌نمایی',
  fitTitle: 'نمایش کل بازه پروژه در عرض صفحه',
  fitAria: 'نمایش کل بازه پروژه',
  fitAll: 'کل بازه',
  zoomIn: 'بزرگ‌نمایی',
  saving: 'در حال ثبت…',
  activityCount: (n: number) => `${n} فعالیت`,
  linksCount: (n: number) => ` · ${n} پیوند`,
  missingDatesCount: (n: number) => ` · ${n} بدون تاریخ`,
  viewOnly: 'فقط مشاهده',
  dragHint: 'کشیدن میله = جابه‌جایی · لبه = تغییر مدت · سپس «ثبت نهایی»',
  activity: 'فعالیت',
  loading: 'در حال بارگذاری…',
  noActivities: 'فعالیتی نیست.',
  progressLabel: (pct: string) => `پیشرفت ${pct}%`,
  milestoneTitle: (name: string, date: string, percent: string) =>
    `${name} · مایلستون · ${date} · ${percent}`,
  barTitle: (name: string, start: string, finish: string, days: number, percent: string) =>
    `${name}\n${start} → ${finish}\n${days} روز · ${percent}`,
  floatTitle: (days: number) => `شناوری ${days} روز`,
  noDate: 'بدون تاریخ',
  legendCritical: 'بحرانی / منفی',
  legendNear: 'نزدیک‌بحرانی',
  legendFast: 'مصرف سریع / پیشرفت ملایم',
  legendWatch: 'پایش پیشرفت (بحرانی + نرخ خوب)',
  legendNormal: 'غیربحرانی (عادی)',
  legendDone: 'تکمیل‌شده (100%)',
  legendProgress: 'بخش تیره = درصد پیشرفت',
  legendLink: 'پیوند وابستگی — موس را روی فلش نگه دارید',
  legendFloat: (cap: number) => `شناوری (حداکثر ${cap} روز نمایشی)`,
  legendMilestone: '◆ مایلستون',
} as const

export const SCHEDULE_ALERTS_COPY = {
  notStarted: 'شروع‌نشده',
  finished: 'تمام‌شده',
  legendTitle: 'رنگ فعالیت = شناوری CPM × نرخ پیشروی',
  redUrgent: 'قرمز · فوری',
  redHint: 'بحرانی + کند',
  blueWatch: 'آبی · رصد عادی',
  blueHint: 'بحرانی + خوب',
  yellowSoft: 'زرد · اطلاع ملایم',
  yellowHint: 'شناوری زیاد + کند',
  greenNormal: 'سبز · عادی',
  greenHint: 'شناوری زیاد + خوب',
  saveFailed: 'ذخیره ناموفق بود',
  error: 'خطا',
  thresholds: 'آستانه‌ها',
  thresholdSummary: (good: number, warning: number, near: number) =>
    `خوب≥${good} · هشدار≥${warning} · نزدیک‌بحرانی≤${near}روز`,
  save: 'ذخیره',
  savingDots: '…',
  emptyHeaders: 'سر‌تیتری در برنامه زمان‌بندی پیدا نشد.',
  colColor: 'رنگ / دسته',
  colHeader: 'سر‌تیتر / مادر',
  colProgress: 'پیشرفت %',
  colFloat: 'شناوری (CPM)',
  colPace: 'نرخ پیشروی',
  colActualStart: 'شروع واقعی',
  colGantt: 'گانت',
  critical: 'بحرانی',
  gantt: 'گانت',
  loadFailed: 'بارگذاری ناموفق بود',
  colored: (inProgress: number) =>
    `فعالیت‌های دارای پیشرفت رنگ‌بندی شدند: ${inProgress} در حال اجرا`,
  urgentAlerts: (n: number) => ` · ${n} هشدار فوری`,
  liveListHint:
    'لیست از درصد پیشرفت زنده بارگذاری شد. برای ذخیره ستون‌های نرخ، مایگریشن 77 و 78 را اجرا کنید.',
  title: 'هشدار هوشمند پیشرفت',
  descriptionLead: 'همهٔ سر‌تیترها / مادرهای',
  descriptionRest:
    ' برنامه زمان‌بندی اینجا می‌آیند (بدون فرزندان برگ). رنگ هر ردیف از ترکیب شناوری CPM و نرخ پیشروی همان سر‌تیتر است.',
  statusDate: (date: string) => `تاریخ وضعیت: ${date}`,
  refresh: 'بروزرسانی',
  syncEdited: 'همگام با برنامهٔ ویرایش‌شده',
  urgentCount: (n: number) => `فوری ${n}`,
  watchCount: (n: number) => `رصد عادی ${n}`,
  softCount: (n: number) => `اطلاع ملایم ${n}`,
  normalCount: (n: number) => `عادی ${n}`,
  totalHeaders: (n: number) => `کل سر‌تیتر ${n}`,
  migrationBefore: 'برای ذخیره دائم ستون‌های نرخ، در Supabase فایل‌های',
  migrationAnd: 'و',
  migrationAfter:
    'را اجرا کنید. لیست فعالیت‌ها بدون آن‌ها هم از درصد پیشرفت زنده محاسبه می‌شود — «بروزرسانی» را بزنید.',
  allHeaders: (n: number) => `همهٔ سر‌تیترها / مادرها (${n})`,
  showAllColors: 'نمایش همه‌ی رنگ‌ها',
  exceptionsOnly: 'فقط استثناها (فوری + ملایم)',
  loading: 'در حال بارگذاری…',
} as const

export const SCHEDULE_PREVIEW_COPY = {
  loadContractorsFailed: 'بارگذاری پیمانکاران ناموفق بود',
  saveContractorFailed: 'ذخیره پیمانکار ناموفق بود',
  savePackageContractorFailed: 'ذخیره پیمانکار زیرشاخه ناموفق بود',
  tabSchedule: 'برنامه زمان‌بندی',
  tabReview: 'مرور تخصیص پیمانکاران',
  filterContractor: 'فیلتر پیمانکار',
  allContractors: 'همه پیمانکاران',
  unassigned: 'بدون پیمانکار',
  colActivity: 'فعالیت اجرایی',
  colFinalContractor: 'پیمانکار نهایی',
  colAssignType: 'نوع تخصیص',
  unknownContractor: 'پیمانکار نامشخص',
  inherited: 'ارثی',
  direct: 'مستقیم',
  unassignedType: 'تخصیص‌نیافته',
  noFilterMatch: 'فعالیتی مطابق این فیلتر وجود ندارد.',
  weightErrorLead: 'خطای وزن‌دهی: جمع وزن سطح پروژه',
  weightMust: 'باید',
  weightBe: 'باشد',
  weightGap: 'اختلاف',
  columnHint: (n: number) =>
    `همهٔ ${n} ستون · تیتر عمودی · خط بین ستون‌ها = تغییر عرض · ؟ = توضیح`,
  autoFit: 'تنظیم خودکار عرض',
  colHelpTitle: 'توضیح ستون',
  colHelpAria: (label: string) => `توضیح ${label}`,
  resizeAria: (label: string) => `تغییر عرض ${label}`,
  selectedCount: (n: number) => `${n} فعالیت انتخاب شده`,
  clearInherit: 'پاک‌کردن و بازگشت به وراثت',
  assignContractor: 'تخصیص پیمانکار',
  clearSelection: 'لغو انتخاب',
} as const

export const SCHEDULE_TASK_ROW_COPY = {
  yes: 'بله',
  inheritedAria: 'به ارث رسیده',
  inheritedFrom: (name: string) => `به ارث رسیده از سرشاخه: ${name}`,
  contractor: 'پیمانکار',
  directAssign: 'تخصیص مستقیم پیمانکار',
  noContractor: 'بدون پیمانکار',
  parentWeightOrigin: 'وزن سرشاخه از کجا آمده؟',
} as const

export const SCHEDULE_DATE_COPY = {
  jalali: 'تاریخ (هجری شمسی)',
  gregorian: 'تاریخ (میلادی)',
  jalaliExample: ' — مثال: 1403/07/14',
  jalaliFormat: 'فرمت: 1403/07/14',
  viewOnDate: 'مشاهده برنامه در تاریخ',
  today: 'امروز',
  selected: 'انتخاب شده:',
} as const

export const SCHEDULE_DOWNLOAD_COPY = {
  label: 'دانلود برنامه XML',
  failed: 'دانلود انجام نشد',
} as const

export const TASK_STATUS_COPY = {
  criticalPath: 'مسیر بحرانی',
  critical: 'بحرانی',
} as const

export const CALENDAR_SWITCHER_COPY = {
  gregorian: 'میلادی',
  jalali: 'هجری شمسی',
} as const

export const SCHEDULE_COPY = {
  date: SCHEDULE_DATE_COPY,
  download: SCHEDULE_DOWNLOAD_COPY,
  status: TASK_STATUS_COPY,
  calendar: CALENDAR_SWITCHER_COPY,
} as const
