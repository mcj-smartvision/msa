/**
 * @file features/project-manager/config.ts
 * @purpose برچسب صفحات و ویجت‌های مدیر پروژه
 * @safe-to-edit YES
 * @affects /project/subcontractors, EVM KPI, RAG, controls cards
 * @depends-on nothing
 */

export const PROJECT_MANAGER_PAGE_COPY = {
  subcontractorsTitle: 'پیمانکاران و قراردادها',
  subcontractorsHint: 'معرفی پیمانکار، ضمیمه قرارداد، و خروجی استاندارد خلاصه قرارداد — توسط مدیر پروژه.',
  subcontractorsEmptyTitle: 'پیمانکاران',
  subcontractorsEmptyDescription: 'پروژه‌ای تخصیص داده نشده است.',
} as const

export const EVM_SOURCES_COPY = {
  costSource: {
    expense: 'اسناد هزینهٔ حسابداری (نهایی / اصلاح‌شده)',
    vendor_bill: 'صورت‌حساب تأمین‌کنندگان',
    overhead: 'جدول هزینهٔ بالاسری کارگاه',
  },
  rag: {
    GREEN: 'سبز',
    AMBER: 'زرد',
    RED: 'قرمز',
    insufficient: 'داده ناکافی',
  },
  missingSkipped: (missing: string) => `${missing}؛ در ارزیابی حساب نشد`,
  belowCritical: (threshold: number) => `کمتر از ${threshold} ← قرمز`,
  betweenAmber: (lo: number, hi: number) => `بین ${lo} و ${hi} ← زرد`,
  atLeastGreen: (threshold: number) => `حداقل ${threshold} ← سبز`,
  pvZero: 'PV صفر است',
  acZero: 'AC صفر است',
  minCriticalFloat: 'کمترین شناوری بحرانی',
  cpmNotRun: 'CPM اجرا نشده؛ حساب نشد',
  days: (formatted: string) => `${formatted} روز`,
  negativeRed: 'منفی ← قرمز',
  nonnegativeGreen: 'نامنفی ← سبز',
  floatConsumption: 'مصرف شناوری',
  noHistorySkipped: 'تاریخچه ندارد؛ حساب نشد',
  floatOverAmber: (pct: number) => `بیش از ${pct}٪ ← زرد`,
  floatAtMostGreen: (pct: number) => `حداکثر ${pct}٪ ← سبز`,
  noBudgetActivities:
    'هیچ فعالیتی بودجه ندارد؛ در «ویرایش برنامه زمانبندی» مقدار و قیمت واحد وارد نشده است.',
  activity: 'فعالیت',
  budgetByWeight: 'بودجه = وزن × بودجهٔ پروژه',
  budgetByQty: 'بودجه = مقدار × قیمت واحد',
  baselineRange: 'baseline شروع ← پایان',
  plannedPct: '٪ برنامه‌ای',
  pvFormula: 'PV = بودجه × ٪ برنامه‌ای',
  physicalPct: '٪ فیزیکی',
  evFormula: 'EV = بودجه × ٪ فیزیکی',
  package: '(زیرشاخه)',
  activityTotal: (count: number) => `جمع (${count} فعالیت)`,
  costEmpty: (date: string, sources: string) =>
    `تا ${date} هیچ رکوردی در این سه منبع ثبت نشده است: ${sources}. پس AC = 0.`,
  listSep: '، ',
  source: 'منبع',
  record: 'رکورد',
  date: 'تاریخ',
  calc: 'محاسبه',
  amountToman: 'مبلغ (تومان)',
  sourceSum: (label: string) => `جمع ${label}`,
  unknownActivity: 'فعالیت نامشخص',
  projectStatus: (status: string) => `وضعیت پروژه: ${status}`,
  spiNull: 'PV صفر است، پس تقسیم انجام نمی‌شود. ',
  spiHint: 'EV و PV جمع ستون‌های جدول فعالیت‌ها در پایین همین صفحه‌اند.',
  cpiNull: 'AC صفر است، پس تقسیم انجام نمی‌شود. ',
  cpiHint: 'AC جمع جدول هزینه‌ها در پایین همین صفحه است.',
  earnedProgress: 'پیشرفت واقعی =',
  plannedProgress: 'پیشرفت برنامه‌ای =',
  and: ' و ',
  andWord: 'و',
  percent: (n: number) => `${Math.round(n)}٪`,
  bacSectionRest: (count: number, date: string) => ` — ${count} فعالیت بودجه‌دار تا ${date}`,
  activitySourceHint:
    'منبع هر ردیف: «دفتر فنی ← ویرایش برنامه زمانبندی»؛ مقدار، قیمت واحد، تاریخ‌های baseline برنامه MSP و ٪ پیشرفت فیزیکی همان فعالیت.',
  technicalOfficeCostHint:
    ' بودجهٔ هر ردیف = ستون «هزینه» همان فعالیت در برنامهٔ دفتر فنی (بسته‌های کاری سهم هزینهٔ فعالیت والد را به نسبت وزن می‌گیرند)؛ ردیف‌های خلاصه جمع زیرمجموعه‌اند و دوباره شمرده نمی‌شوند.',
  weightedBudgetHint: (amount: string) =>
    ` هیچ فعالیتی قیمت واحد ندارد، پس بودجهٔ پروژه (${amount} تومان) به نسبت وزن تقسیم شده است.`,
  toman: 'تومان',
  floatSection: 'شناوری مسیر بحرانی و مصرف شناوری',
  cpmMissing: 'برای این پروژه هنوز CPM محاسبه نشده است.',
  criticalFloatBefore: (task: string) => `کمترین شناوری کل: فعالیت «${task}» با`,
  criticalFloatAfter: 'روز، از آخرین محاسبهٔ CPM برنامه',
  criticalFromAll: ' (هیچ فعالیتی بحرانی علامت نخورده بود، پس بین همهٔ فعالیت‌ها)',
  criticalFromCritical: ' (بین فعالیت‌های بحرانی)',
  floatConsumptionUnavailable:
    'مصرف شناوری: هیچ فعالیتی در تاریخچهٔ CPM شناوری اولیهٔ مثبت ندارد، پس قابل محاسبه نیست.',
  floatConsumptionZero:
    'مصرف شناوری 0٪: شناوری فعلی هیچ فعالیتی از اولین شناوری ثبت‌شده‌اش در تاریخچهٔ CPM کمتر نشده است.',
  worstConsumption: (task: string) => `بیشترین مصرف شناوری: فعالیت «${task}»`,
  floatNumbersHint: 'عدد اول اولین شناوری ثبت‌شده در تاریخچهٔ CPM و عدد دوم شناوری فعلی است.',
  sourcesAria: 'منبع و محاسبهٔ شاخص‌های سلامت پروژه',
  dialogTitle: (date: string) => `منبع و محاسبهٔ اعداد — تا ${date}`,
  close: 'بستن',
} as const

export const EVM_KPI_COPY = {
  costSource: {
    expense: 'اسناد هزینه نهایی‌شده',
    vendor_bill: 'صورت‌حساب تأمین‌کنندگان',
    overhead: 'هزینه بالاسری کارگاه',
  },
  budgetBasis: {
    technical_office_cost: 'بودجه = ستون «هزینه» برنامهٔ دفتر فنی (جمع فعالیت‌های برگ)',
    contract_value: 'بودجه = مقدار × قیمت واحد فعالیت‌ها',
    weighted_project_budget: 'بودجه پروژه به نسبت وزن فعالیت‌ها تقسیم شده',
    none: 'بودجه‌ای برای فعالیت‌ها ثبت نشده است',
  },
  toman: 'تومان',
  cpiTitle: 'CPI — شاخص عملکرد هزینه',
  cpiMissing: 'هزینهٔ واقعی ثبت نشده است',
  cpiCaption: 'EV ریالی (Σ بودجه × پیشرفت) ÷ AC',
  cpiHelp: 'نسبت ارزش کسب‌شده به هزینهٔ واقعی؛ کمتر از 1 یعنی بیش از بودجه خرج شده.',
  earnedTitle: 'پیشرفت واقعی (کسب‌شده)',
  earnedCaption: (planned: string, count: number, basis: string) =>
    `برنامه‌ای: ${planned}٪ · ${count} فعالیت ${basis}`,
  weighted: 'وزن‌دار',
  budgeted: 'بودجه‌دار',
  earnedHelp:
    'درصد کسب‌شده طبق پیشرفت فیزیکی تأییدشدهٔ دفتر فنی و درصد برنامه‌ای طبق baseline برنامه MSP.',
  floatTitle: 'شناوری مسیر بحرانی',
  days: 'روز',
  floatHistoryMissing: 'تاریخچهٔ شناوری ثبت نشده',
  maxFloatConsumption: (pct: number) => `بیشترین مصرف شناوری: ${pct}٪`,
  floatHelp: 'کمترین شناوری کل در فعالیت‌های بحرانی طبق آخرین محاسبهٔ CPM.',
  pvTitle: 'PV — ارزش برنامه‌ای',
  fromBac: (amount: string) => `از بودجهٔ کل ${amount}`,
  evTitle: 'EV — ارزش کسب‌شده',
  svCaption: (amount: string) => `انحراف زمانی (SV): ${amount}`,
  acTitle: 'AC — هزینهٔ واقعی',
  cvCaption: (amount: string) => `انحراف هزینه (CV): ${amount}`,
} as const

const PM_SUBCONTRACTORS_FA = {
  standardsDefault: 'رعایت نقشه‌ها، مشخصات فنی، HSE کارگاه و برنامه زمان‌بندی ابلاغی.',
  loadFailed: 'بارگذاری پیمانکاران ناموفق بود. آیا migration 42 اجرا شده؟',
  contractTitle: (name: string) => `قرارداد ${name}`,
  saveFailed: 'ذخیره ناموفق بود',
  title: 'پیمانکاران پروژه',
  hint: 'معرفی پیمانکار، ضمیمه قرارداد و خروجی استاندارد — قبل از ابلاغ دستور لازم است.',
  add: 'پیمانکار جدید',
  missingTables: 'اگر جدول وجود ندارد: فایل database/42-project-subcontractors.sql را در Supabase اجرا کنید.',
  name: 'نام پیمانکار *',
  trade: 'رشته / تخصص',
  tradePlaceholder: 'مثلاً سرامیک، اسکلت، تأسیسات',
  contact: 'نماینده',
  phone: 'تلفن',
  contractNo: 'شماره قرارداد',
  contractValue: 'مبلغ قرارداد (ریال)',
  start: 'شروع قرارداد',
  end: 'پایان قرارداد',
  scope: 'محدوده کار / کلیات',
  standards: 'استانداردها و الزامات',
  attach: 'ضمیمه قرارداد (PDF/تصویر)',
  save: 'ثبت پیمانکار و قرارداد',
  loading: 'در حال بارگذاری…',
  empty:
    'هنوز هیچ پیمانکاری معرفی نشده. تا وقتی پیمانکار ثبت نشود، نمی‌توان دستور کار را «ارسال به پیمانکار» کرد.',
  export: 'خروجی استاندارد',
  fullPagePrefix: 'صفحه کامل:',
  fullPageLink: 'مدیریت پیمانکاران',
}

const PM_SUBCONTRACTORS_EN: typeof PM_SUBCONTRACTORS_FA = {
  standardsDefault: 'Follow drawings, specs, site HSE, and issued schedule.',
  loadFailed: 'Failed to load subcontractors. Run migration 42?',
  contractTitle: (name: string) => `Contract — ${name}`,
  saveFailed: 'Save failed',
  title: 'Project subcontractors',
  hint: 'Register subcontractors, attach contracts, export standard summary — required before releasing instructions.',
  add: 'Add subcontractor',
  missingTables: 'If tables are missing: run database/42-project-subcontractors.sql in Supabase.',
  name: 'Name *',
  trade: 'Trade',
  tradePlaceholder: 'e.g. tiling, structure',
  contact: 'Contact',
  phone: 'Phone',
  contractNo: 'Contract no.',
  contractValue: 'Contract value',
  start: 'Start',
  end: 'End',
  scope: 'Scope summary',
  standards: 'Standards',
  attach: 'Attach contract file',
  save: 'Save subcontractor & contract',
  loading: 'Loading…',
  empty: 'No subcontractors registered yet. You cannot “send to subcontractor” until one is registered.',
  export: 'Export',
  fullPagePrefix: 'Full page:',
  fullPageLink: 'Subcontractors',
}

export const PM_SUBCONTRACTORS_COPY = {
  fa: PM_SUBCONTRACTORS_FA,
  en: PM_SUBCONTRACTORS_EN,
} as const

export const CONTROLS_KPI_COPY = {
  loadFailed: 'بارگذاری شاخص‌های کنترل پروژه ناموفق بود',
  delayForecast: 'تأخیر پیش‌بینی‌شده',
  staleData: (date: string) => `داده‌ها قدیمی‌اند؛ تاریخ مبنا ${date}`,
  details: 'جزئیات',
  detailsAria: (label: string) => `جزئیات ${label}`,
  close: 'بستن',
  dataQuality: (quality: string) => `کیفیت داده: ${quality}`,
  asOfDate: (date: string) => `· تاریخ مبنا ${date}`,
  formula: 'فرمول',
  substitution: 'جایگذاری',
  interpretation: 'تفسیر',
  action: 'اقدام پیشنهادی',
  missingReason: 'علت کمبود داده',
  assumptions: 'فرض‌ها',
  sources: 'منابع داده',
  scheduleTitle: 'زمان‌بندی — SPI(t)',
  calculating: 'در حال محاسبه…',
  detailsSpiT: 'جزئیات SPI(t)',
  detailsSpi: 'جزئیات SPI',
  sectionTitle: 'شاخص‌های کنترل پروژه',
  statusDate: (date: string) => `تاریخ وضعیت ${date}`,
  calculatingKpis: 'در حال محاسبهٔ شاخص‌ها…',
} as const

export const RAG_STATUS_COPY = {
  GREEN: {
    label: 'سبز — در مسیر',
    hint: 'SPI و CPI حداقل 0.95 و شناوری مسیر بحرانی نامنفی است.',
  },
  AMBER: {
    label: 'زرد — نیازمند توجه',
    hint: 'یکی از شاخص‌ها بین 0.85 و 0.95 است یا بیش از 75٪ شناوری مصرف شده.',
  },
  RED: {
    label: 'قرمز — بحرانی',
    hint: 'SPI یا CPI کمتر از 0.85 است یا مسیر بحرانی شناوری منفی دارد.',
  },
  unevaluatedTitle: 'برای ارزیابی، قیمت واحد/وزن فعالیت‌ها، پیشرفت فیزیکی و محاسبهٔ CPM لازم است.',
  unevaluatedLabel: 'وضعیت پروژه: داده ناکافی',
  projectStatus: (label: string) => `وضعیت پروژه: ${label}`,
} as const
