/**
 * @file features/admin/lib/schedule-ui-copy.ts
 * @purpose برچسب‌های UI برنامه زمان‌بندی در کنترل سنتر
 * @safe-to-edit YES
 * @affects پنل ورود MSP، شروع واقعی، گزارش کارهای تا امروز
 * @depends-on nothing
 */

export const ADMIN_CATCH_UP_COPY = {
  fa: {
    saveFailed: 'ذخیره ناموفق بود',
    saved: (n: number) =>
      `پیشرفت ${n} فعالیت ثبت شد (درصد سرشاخه‌ها از وزن زیرشاخه‌ها حساب شد).`,
    title: 'گزارش کارهای تا امروز',
    description: (actualStart: string | null, totalDue: number) =>
      `شروع واقعی پروژه قبل از امروز است (${actualStart}). ${totalDue} فعالیت طبق برنامه باید تا امروز شروع یا پیشرفت کرده باشند — وضعیت را تأیید کنید.`,
    done: 'انجام‌شده',
    onTrack: 'مطابق',
    behind: 'عقب',
    notStarted: 'شروع‌نشده',
    pastDueIncomplete: 'تاریخ گذشته / ناتمام',
    avgPlan: 'میانگین برنامه',
    avgActual: 'واقعی',
    alignedHint:
      'بر اساس پیشرفت ثبت‌شده، کارهای موعد تا امروز با برنامه هم‌خوان است. در صورت نیاز می‌توانید جزئیات را بازبینی کنید.',
    askTitle: 'تا امروز کارها طبق برنامه انجام شده؟',
    askHint:
      'اگر «بله» بزنید، پیشرفت هر فعالیتِ موعد روی درصد برنامه‌ای تا امروز تنظیم می‌شود. اگر «خیر / گزارش دقیق» بزنید، ردیف‌به‌ردیف وضعیت را مشخص می‌کنید.',
    yesOnPlan: 'بله — طبق برنامه انجام شده',
    noDetailed: 'خیر / گزارش دقیق فعالیت‌ها',
    editorHint: (n: number) =>
      `${n} فعالیت — داخل کادر اسکرول کنید تا انتهای برنامه. ردیف‌های نارنجی: تاریخ پایان گذشته ولی هنوز 100٪ نشده‌اند.`,
    activity: 'فعالیت',
    weight: 'وزن',
    window: 'بازه',
    plan: 'برنامه',
    actualCol: 'واقعی',
    set: 'ثبت',
    pastDue: 'تاریخ گذشته',
    doneShort: 'انجام',
    parentPctHelp: 'نحوه محاسبه درصد سرشاخه',
    close: 'بستن',
    fromChildren: 'از وزن زیرشاخه‌ها محاسبه می‌شود',
    asPlanned: 'طبق برنامه',
    pct100: '100٪',
    pct0: '0٪',
    autoFromChildren: 'خودکار از زیرشاخه',
    saveReport: 'ذخیره گزارش پیشرفت',
    back: 'بازگشت',
    fillAllPlanned: 'همه را طبق برنامه پر کن',
    reviewEdit: 'بازبینی و اصلاح پیشرفت',
    footer:
      'این گزارش همان مبنای داشبورد مدیر پروژه برای شاخص انطباق و SPI است. بعد از ذخیره، وضعیت «تأخیر» در جدول برنامه بر اساس پیشرفت جدید به‌روز می‌شود.',
  },
  en: {
    saveFailed: 'Save failed',
    saved: (n: number) =>
      `Progress saved for ${n} activities (parents rolled up from children).`,
    title: 'Work-to-date catch-up report',
    description: (actualStart: string | null, totalDue: number) =>
      `Actual start is before today (${actualStart}). ${totalDue} activities should have progressed by today — confirm status.`,
    done: 'Done',
    onTrack: 'On track',
    behind: 'Behind',
    notStarted: 'Not started',
    pastDueIncomplete: 'Past due / incomplete',
    avgPlan: 'Avg plan',
    avgActual: 'actual',
    alignedHint:
      'Based on saved progress, due work looks aligned with the plan. You can still review details.',
    askTitle: 'Was work completed according to the plan through today?',
    askHint:
      '“Yes” sets each due activity to its planned % through today. “No / detailed report” lets you set each row.',
    yesOnPlan: 'Yes — on plan through today',
    noDetailed: 'No / detailed activity report',
    editorHint: (n: number) =>
      `${n} activities — scroll inside the list. Orange rows: finish date passed but still incomplete.`,
    activity: 'Activity',
    weight: 'Weight',
    window: 'Window',
    plan: 'Plan',
    actualCol: 'Actual',
    set: 'Set',
    pastDue: 'Past due',
    doneShort: 'Done',
    parentPctHelp: 'How parent % is calculated',
    close: 'Close',
    fromChildren: 'Calculated from children weights',
    asPlanned: 'As planned',
    pct100: '100%',
    pct0: '0%',
    autoFromChildren: 'Auto from children',
    saveReport: 'Save progress report',
    back: 'Back',
    fillAllPlanned: 'Fill all as planned',
    reviewEdit: 'Review & edit progress',
    footer:
      'This report feeds the Project Manager compliance / SPI indicators. After save, Delay badges update from the new progress.',
  },
} as const

export const ADMIN_SCHEDULE_IMPORT_COPY = {
  statusCompleted: 'تکمیل‌شده',
  statusFailed: 'ناموفق',
  statusProcessing: 'در حال پردازش',
  statusPending: 'در انتظار',
  loadFailed: 'بارگذاری برنامه ناموفق بود',
  pickXmlFirst: 'ابتدا یک فایل MSP XML انتخاب کنید.',
  xmlOnly: 'فقط فایل‌های XML پشتیبانی می‌شوند. در Microsoft Project: File → Save As → XML.',
  previewFailed: 'بررسی فایل ناموفق بود',
  importFailed: 'ورود فایل ناموفق بود',
  importSuccess: (tasks: number, deps: number) =>
    `${tasks} فعالیت و ${deps} وابستگی وارد شد. برنامه قبلی پاک شد.`,
  title: 'ورود برنامه MSP',
  description:
    'ابتدا فایل را بررسی کنید؛ گزارش Import نمایش داده می‌شود. پس از تأیید، برنامه قبلی کاملاً جایگزین می‌شود.',
  mspSaveHintBefore: 'در Microsoft Project: ',
  mspSaveHintCode: 'File → Save As → XML',
  mspSaveHintAfter: ' (نه .mpp)',
  selectedPrefix: 'انتخاب‌شده: ',
  previewReportTitle: 'گزارش بررسی Import',
  previewMetaLine: (name: string, tasks: number, deps: number) =>
    `${name} · ${tasks} فعالیت · ${deps} وابستگی`,
  errorPrefix: 'خطا: ',
  warnPrefix: 'هشدار: ',
  noIssues: 'مشکل مسدودکننده یا هشداری یافت نشد.',
  blockedCycle: 'به‌خاطر حلقه در وابستگی‌ها، ورود قطعی ممکن نیست. فایل را در MSP اصلاح کنید.',
  confirmReplace: 'در صورت تأیید، برنامه قبلی پروژه کاملاً جایگزین می‌شود.',
  previewing: 'در حال بررسی...',
  previewFile: 'بررسی فایل',
  confirming: 'در حال ورود قطعی...',
  confirmImport: 'تأیید و ورود قطعی',
  actualStartPrefix: 'شروع واقعی: ',
  projectStartPrefix: 'شروع پروژه: ',
  pendingApply: '(در انتظار اعمال)',
  taskCountLabel: 'فعالیت‌های برنامه',
  successfulImports: 'ورودهای موفق',
  previewTitle: (shown: number) => `پیش‌نمایش برنامه (${shown}`,
  ofTotal: (n: number) => ` از ${n}`,
  previewTitleEnd: ')',
  previewHint: 'تیتر عمودی · همه ستون‌ها · خط بین ستون‌ها = عرض · ؟ = توضیح · «تنظیم خودکار عرض»',
  historyTitle: 'تاریخچه ورود',
  historyCompleted: (tasks: number, deps: number) => ` · ${tasks} فعالیت، ${deps} پیوند`,
  download: 'دانلود',
} as const

export const ADMIN_ACTUAL_START_COPY = {
  fa: {
    rescheduleFailed: 'زمان‌بندی مجدد ناموفق بود',
    title: 'تاریخ شروع واقعی پروژه',
    description:
      'تاریخ جدید را وارد کنید: همهٔ تسک‌ها به‌اندازهٔ همان فاصله از baseline MSP جابه‌جا می‌شوند (بدون تغییر مدت).',
    baseline: 'Baseline MSP',
    activeStart: 'شروع واقعی فعال',
    dateLabel: 'تاریخ شروع واقعی',
    rescheduling: 'در حال بازمحاسبه…',
    apply: 'بازمحاسبه سراسری',
    completed: 'بازمحاسبه سراسری انجام شد',
    updatedPrefix: (updated: number, total: number) =>
      `${updated} از ${total} تسک به‌روزرسانی شد · شروع جدید: `,
    shift: (days: number) => ` · جابه‌جایی: ${days} روز`,
    anchor: (wbs: string) => ` · لنگر: WBS ${wbs}`,
    baselineSaved: (n: number) => ` · ${n} baseline ذخیره شد`,
  },
  en: {
    rescheduleFailed: 'Reschedule failed',
    title: 'Actual Project Start Date',
    description:
      'Enter the new start: every task shifts by the same day offset from the MSP baseline (durations unchanged).',
    baseline: 'MSP baseline',
    activeStart: 'Active actual start',
    dateLabel: 'Actual start date',
    rescheduling: 'Rescheduling…',
    apply: 'Apply global reschedule',
    completed: 'Global reschedule completed',
    updatedPrefix: (updated: number, total: number) =>
      `${updated} of ${total} tasks updated · new start: `,
    shift: (days: number) => ` · shift: ${days} day(s)`,
    anchor: (wbs: string) => ` · anchor: WBS ${wbs}`,
    baselineSaved: (n: number) => ` · ${n} baselines snapshotted`,
  },
} as const
