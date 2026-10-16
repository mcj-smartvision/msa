/**
 * @file features/hse/lib/ui-copy.ts
 * @purpose برچسب‌های فارسی صفحات ایمنی — منبع واحد برای config.ts
 * @safe-to-edit YES
 * @affects صفحات HSE
 * @depends-on nothing
 */

export const HSE_SHELL_COPY = {
  controlCenter: 'مرکز کنترل ایمنی',
  pipeline: 'خط لوله سامانه',
} as const

export const HSE_COMMON_COPY = {
  yes: 'بله',
  no: 'خیر',
  save: 'ذخیره',
  code: 'کد',
  title: 'عنوان',
  severity: 'شدت',
  status: 'وضعیت',
  zone: 'زون',
  camera: 'دوربین',
  confidence: 'اطمینان',
  detectedAt: 'زمان تشخیص',
  name: 'نام',
  allSeverities: 'همه شدت‌ها',
  allStatuses: 'همه وضعیت‌ها',
  listSep: '، ',
} as const

export const HSE_BADGE_COPY = {
  severity: {
    critical: 'بحرانی',
    high: 'بالا',
    medium: 'متوسط',
    low: 'کم',
  },
  status: {
    new: 'جدید',
    acknowledged: 'دریافت‌شده',
    ai_review: 'بازبینی هوشمند',
    confirmed: 'تأیید تخلف',
    dismissed: 'رد شده',
    escalated: 'ارجاع بالا',
    assigned: 'محول‌شده',
    closed: 'بسته‌شده',
  },
  health: {
    online: 'آنلاین',
    degraded: 'ضعیف',
    offline: 'قطع',
    calibrating: 'کالیبره',
  },
  risk: {
    critical: 'بحرانی',
    high: 'بالا',
    medium: 'متوسط',
    low: 'کم',
  },
} as const

export const HSE_ACTION_COPY = {
  ai_verify: 'تأیید هوش مصنوعی',
  acknowledge: 'دریافت',
  confirm: 'تأیید',
  dismiss: 'رد',
  escalate: 'ارجاع',
  assign: 'تخصیص',
  close: 'بستن',
  note: 'یادداشت',
} as const

export const HSE_VERDICT_COPY = {
  likely_violation: 'احتمال تخلف',
  uncertain: 'نامشخص',
  likely_false_positive: 'احتمال مثبت کاذب',
} as const

export const HSE_SOURCE_COPY = {
  rtsp: 'آدرس استریم',
  onvif: 'کشف خودکار شبکه',
  nvr: 'ضبط‌کننده شبکه',
  edge_usb: 'یو‌اس‌بی یا لپ‌تاپ',
} as const

export const HSE_CA_STATUS_COPY = {
  open: 'باز',
  in_progress: 'در حال انجام',
  done: 'انجام‌شده',
} as const

export const HSE_ROLE_COPY = {
  employer: 'کارفرما',
  hse_officer: 'مسئول ایمنی و بهداشت',
  technical_admin: 'مدیر فنی',
  supervisor: 'ناظر',
} as const

export const HSE_CHANNEL_COPY = {
  telegram: 'تلگرام',
  email: 'ایمیل',
  webhook: 'فراخوان خودکار وب',
} as const

export const HSE_ALERT_RESULT_COPY = {
  sent: 'ارسال‌شده',
  queued: 'در صف',
  failed: 'ناموفق',
} as const

export const HSE_IP_STATUS_COPY = {
  registered: 'ثبت‌شده',
  awaiting_edge: 'در انتظار همگام‌سازی لبه',
  verified: 'تأییدشده',
} as const

export const HSE_OVERVIEW_COPY = {
  title: 'نمای کلی ایمنی',
  description:
    'تصویر عملیاتی از حوادث تشخیص‌داده‌شده با دوربین، ریسک زون‌ها، مواجهه پیمانکاران و عملکرد پاسخ.',
  kpiActive: 'حوادث فعال',
  totalHint: (n: number) => `${n} مورد در مجموعه داده`,
  kpiConfirmed: 'تخلفات تأییدشده',
  falsePositiveHint: (n: number) => `${n} مثبت کاذب`,
  kpiCameras: 'دوربین‌های آنلاین',
  livePulse: 'ضربان زنده',
  kpiAckClose: 'میانگین دریافت / بستن',
  ackCloseValue: (ackMin: number, closeHours: number) => `${ackMin}د / ${closeHours}س`,
  responseHint: 'شاخص پاسخ',
  severityTitle: 'تفکیک شدت',
  severityDesc: 'همه حوادث بر اساس شدت',
  topZonesTitle: 'زون‌های پرریسک',
  topZonesDesc: 'بیشترین تعداد حادثه',
  emptyZones: 'فعالیتی در زون ثبت نشده است.',
  camerasTitle: 'سلامت دوربین‌ها',
  camerasDesc: 'خلاصه وضعیت ناوگان',
  contractorsTitle: 'مقایسه پیمانکاران',
  contractorsDesc: 'موارد باز در برابر تخلفات تأییدشده',
  colContractor: 'پیمانکار',
  colTrade: 'رشته',
  colOpen: 'باز',
  colConfirmed: 'تأییدشده',
  colFalsePositive: 'مثبت کاذب',
  recentTitle: 'بحرانی / بالای اخیر',
  recentDesc: 'جدیدترین تشخیص‌های شدت بالا',
  viewAll: 'مشاهده همه',
  emptyCritical: 'حادثه بحرانی یا بالایی نیست.',
  responseTitle: 'عملکرد پاسخ',
  responseDesc: 'زمان دریافت و بستن چرخه',
  avgAck: 'میانگین دریافت',
  minutes: 'دقیقه',
  avgAckHint: 'زمان از تشخیص تا اولین دریافت انسانی.',
  avgClose: 'میانگین بستن',
  hours: 'ساعت',
  avgCloseHint: 'زمان از تشخیص تا وضعیت بسته‌شده (شامل پیگیری اصلاحی).',
} as const

export const HSE_ALERTS_COPY = {
  savedNote: 'مسیریابی هشدار و تنظیمات کانال ذخیره شد (فقط نشست محلی)',
  testMessage: (chatId: string, email: string) =>
    `هشدار آزمایشی به گفتگوی تلگرام ${chatId} و ایمیل ${email} در صف قرار گرفت. تحویل را ظرف 30 ثانیه در گفتگوی عملیات تأیید کنید.`,
  defaultWebhookUrl: 'آدرس فراخوان سامانه ایمنی (نمونه)',
  defaultEmailDigest: 'ایمنی@نمونه.ایران',
  title: 'هشدارها',
  description: 'پیکربندی کانال‌ها، مسیریابی بر اساس شدت، و تاریخچه تحویل اخیر.',
  saveSettings: 'ذخیره تنظیمات',
  testAlert: 'هشدار آزمایشی',
  roleRoutingTitle: 'مسیریابی نقش‌ها',
  roleRoutingDesc: 'پس از تحلیل و اطمینان، چه کسی چه چیزی دریافت می‌کند.',
  hseOfficer: 'مسئول ایمنی',
  hseOfficerDesc: 'همه رخدادهای دوربین برای بازبینی، تأیید، رد و ارجاع.',
  siteSupervisor: 'سرپرست کارگاه',
  siteSupervisorDesc: 'فقط موارد تأییدشده یا بحرانی برای اقدام فوری میدانی.',
  projectManager: 'مدیر پروژه',
  projectManagerDesc: 'خلاصه هفتگی روندها + فقط بحران‌های خیلی جدی به‌صورت فوری.',
  telegramTitle: 'تلگرام',
  telegramDesc: 'کانال اصلی اعلان فوری ناظر',
  botConfigured: 'ربات پیکربندی‌شده',
  chatId: 'شناسه گفتگو',
  notifyCritical: 'اعلان بحرانی',
  notifyHigh: 'اعلان بالا',
  notifyMedium: 'اعلان متوسط',
  webhookTitle: 'وب‌هوک (جایگزین موقت)',
  webhookDesc: 'فراخوان اچ‌تی‌تی‌پی برای سامانه پایش / تیکت',
  endpoint: 'آدرس نقطه انتهایی',
  webhookHint:
    'ارسال بستهٔ جسون حادثه برای شدت‌های مسیریابی‌شده. تأیید امضا و سیاست تلاش مجدد در اتصال‌دهندهٔ تولید پیکربندی می‌شود.',
  emailTitle: 'ایمیل (جایگزین موقت)',
  emailDesc: 'خلاصه روزانه و نامه شدت بالا',
  defaultRecipients: 'گیرندگان پیش‌فرض',
  emailHint:
    'ایمیل به‌طور پیش‌فرض برای شدت متوسط و به‌عنوان مسیر پشتیبان هنگام محدودیت نرخ تلگرام استفاده می‌شود. پیوست تصاویر شواهد اختیاری و وابسته به سیاست پروژه است.',
  severityRoutingTitle: 'مسیریابی شدت',
  severityRoutingDesc: 'فعال/غیرفعال کردن کانال‌ها برای هر باند شدت',
  colSeverity: 'شدت',
  colTelegram: 'تلگرام',
  colEmail: 'ایمیل',
  colWebhook: 'وب‌هوک',
  on: 'روشن',
  off: 'خاموش',
  historyTitle: 'تاریخچه هشدار',
  historyDesc: (n: number) => `${n} تحویل اخیر`,
  emptyLogs: 'گزارش هشداری نیست.',
  colTime: 'زمان',
  colChannel: 'کانال',
  colIncident: 'حادثه',
  colTarget: 'مقصد',
  colResult: 'نتیجه',
  colDetail: 'جزئیات',
} as const

export const HSE_INCIDENTS_COPY = {
  title: 'حوادث',
  description: 'فهرست قابل جستجوی همه تشخیص‌های ایمنی دوربین برای این پروژه.',
  panelTitle: 'ثبت حوادث',
  recordCount: (n: number) => `${n} رکورد`,
  searchPlaceholder: 'جستجوی کد، عنوان، زون…',
  empty: 'هیچ حادثه‌ای با پالایش فعلی مطابقت ندارد.',
} as const

export const HSE_INCIDENT_DETAIL_COPY = {
  backToSafety: 'بازگشت به ایمنی و اخطارها',
  back: 'بازگشت',
  notFoundTitle: 'حادثه یافت نشد',
  notFoundDesc: 'شناسه درخواست‌شده در مجموعه داده نمایشی نیست.',
  recordMissing: 'رکورد موجود نیست',
  noIncidentPrefix: 'حادثه‌ای با شناسه ',
  noIncidentSuffix: ' وجود ندارد.',
  exportReady: (code: string) => `خروجی گزارش برای ${code} آماده شد. جزئیات در کنسول مرورگر است.`,
  exportReport: 'خروجی گزارش',
  detected: 'تشخیص',
  updated: 'به‌روزرسانی',
  metadataTitle: 'فراداده',
  metadataDesc: 'زمینه این تشخیص',
  zone: 'زون',
  camera: 'دوربین',
  contractor: 'پیمانکار',
  unassignedTeam: 'تخصیص‌نشده / تیم کارگاهی',
  assignee: 'مسئول',
  edgeConfidence: 'اطمینان لبه / دستگاه لبه',
  falsePositive: 'مثبت کاذب',
  ruleTitle: 'قانون فعال‌شده',
  ruleDesc: 'سیاست تشخیصی که شلیک کرده است',
  thresholds: (confidencePct: number, durationSec: number, cooldownSec: number) =>
    `آستانه‌ها: اطمینان ≥ ${confidencePct}٪ · مدت ≥ ${durationSec}ث · دوره خنک‌سازی ${cooldownSec}ث`,
  noRule: 'رکورد قانون موجود نیست.',
  evidenceTitle: 'فریم‌های شواهد',
  evidenceDesc: 'تصاویر بافرشده از بسته لبه',
  clipTitle: 'بافر کلیپ',
  clipDesc: 'کلیپ کوتاه محلی ارجاع‌شده در بسته شواهد',
  aiTitle: 'خلاصه و رأی هوش مصنوعی',
  aiDesc: 'خروجی تأیید فهرست کوتاه',
  verdict: 'رأی',
  aiConfidence: 'اطمینان هوش مصنوعی',
  decisionTitle: 'گزارش تصمیم / مسیر حسابرسی',
  decisionDesc: 'اقدامات انسانی و سامانه‌ای به‌ترتیب زمان',
  noDecision: 'تصمیمی ثبت نشده است.',
  caTitle: 'اقدامات اصلاحی',
  caDesc: 'تعهدات پیگیری مرتبط با این حادثه',
  noCa: 'اقدام اصلاحی ثبت نشده است.',
  colAction: 'اقدام',
  colOwner: 'مالک',
  colDue: 'مهلت',
  colStatus: 'وضعیت',
} as const

export const HSE_LIVE_COPY = {
  assignNote: 'تخصیص به ناظر کشیک (نمایشی)',
  actionApplied: (label: string) => `${label} اعمال شد (نمایشی)`,
  demoAssignee: 'مرتضی بل',
  actorYou: 'شما (اپراتور)',
  title: 'عملیات زنده',
  description:
    'فهرست قابل پالایش حوادث با پیش‌نمایش شواهد و اقدامات ناظر. تغییرات فقط در وضعیت نشست محلی اعمال می‌شود.',
  lastActionPrefix: 'آخرین اقدام: ',
  listTitle: 'فهرست حوادث',
  matching: (n: number) => `${n} مورد مطابق`,
  empty: 'هیچ حادثه‌ای با پالایش فعلی مطابقت ندارد.',
  detailTitle: 'جزئیات حادثه',
  selectIncident: 'یک حادثه را انتخاب کنید',
  selectFromList: 'یک حادثه را از فهرست انتخاب کنید.',
  confidence: (pct: number) => `اطمینان ${pct}٪`,
  zonePrefix: 'زون: ',
  cameraPrefix: 'دوربین: ',
  detectedPrefix: 'تشخیص در ',
  evidencePreview: 'پیش‌نمایش شواهد',
  aiSummary: 'خلاصه / رأی هوش مصنوعی',
  verdictPrefix: 'رأی: ',
  actions: 'اقدامات',
} as const

export const HSE_CAMERAS_COPY = {
  savedNote: (code: string) => `کالیبراسیون ${code} ذخیره شد (فقط نشست محلی)`,
  title: 'دوربین‌ها',
  description:
    'اکنون دوربین‌های آزمایشی یو‌اس‌بی / لپ‌تاپ را وصل کنید، نقاط انتهایی مداربسته را برای لبهٔ تولید ثبت کنید و کالیبراسیون ناوگان را مدیریت کنید.',
  fleetTitle: 'ناوگان دوربین',
  fleetDesc: (cameras: number, bindings: number) =>
    `${cameras} دستگاه برنامه‌ریزی‌شده · ${bindings} متصل با یو‌اس‌بی`,
  colName: 'نام',
  colStatus: 'وضعیت',
  colSource: 'منبع',
  colLive: 'اتصال زنده',
  colLocation: 'محل',
  colHeartbeat: 'ضربان',
  colZones: 'زون‌ها',
  colFps: 'فریم بر ثانیه / وضوح',
  collapseAria: 'بستن کالیبراسیون',
  expandAria: 'باز کردن کالیبراسیون',
  nowUsb: 'همین الان (یو‌اس‌بی)',
  calibrationTitle: (code: string) => `کالیبراسیون — ${code}`,
  saveLocal: 'ذخیره محلی',
  tilt: 'شیب (درجه)',
  pan: 'چرخش افقی (درجه)',
  zoom: 'بزرگ‌نمایی',
  roiNotes: 'یادداشت ناحیه مورد نظر',
} as const

export const HSE_CAMERA_CONNECTION_COPY = {
  noLocalCameras: 'دوربین محلی یافت نشد. اجازهٔ دسترسی مرورگر را بدهید و دوباره تلاش کنید.',
  discovered: (n: number) => `${n} دوربین محلی کشف شد — مناسب برای نمایش و راه‌اندازی اولیه.`,
  discoverFailed: 'کشف دوربین ناموفق بود',
  previewNote:
    'پیش‌نمایش زنده فعال است (لپ‌تاپ / یو‌اس‌بی). در تولید، دریافت از لبه جایگزین این مسیر می‌شود.',
  openFailed: 'باز کردن دوربین ممکن نشد',
  selectFirst: 'ابتدا یک دوربین محلی و یک جایگاه دوربین ایمنی را انتخاب کنید.',
  localCameraFallback: 'دوربین محلی',
  boundNote: (label: string, slot: string) =>
    `«${label}» به ${slot} متصل شد. کارفرما این جایگاه را به‌صورت آزمایشی متصل می‌بیند.`,
  unbound: 'اتصال یو‌اس‌بی از جایگاه حذف شد.',
  nameUrlRequired: 'نام و آدرس استریم / کشف خودکار شبکه (یا میزبان) الزامی است.',
  unassigned: 'تخصیص‌نشده',
  ipRegistered: (code: string) =>
    `${code} برای همگام‌سازی با لبه ثبت شد. جریان تصویر را عامل لبهٔ کارگاه می‌کشد — نه مرورگر.`,
  title: 'مرکز اتصال دوربین',
  description:
    'دو مسیر: یو‌اس‌بی / لپ‌تاپ برای نمایش همین حالا · ثبت دوربین‌های شبکه برای اتصال تولید از لبه.',
  pathATitle: 'مسیر الف — آزمون زنده (همین حالا)',
  pathABody:
    'وب‌کم یا دوربین یو‌اس‌بی این رایانه را کشف کنید، جریان را ببینید و به یک جایگاه دوربین ایمنی وصل کنید تا کارفرما در نمایش، دستگاه واقعاً متصل را ببیند.',
  pathBTitle: 'مسیر ب — ثبت دوربین مداربسته (آماده برای لبه)',
  pathBBody:
    'نقاط انتهایی آدرس استریم / کشف خودکار شبکه / ضبط‌کننده شبکه را ثبت کنید. اعتبارنامه‌ها برای عامل لبهٔ آینده می‌مانند؛ مرکز کنترل نیت ناوگان را نشان می‌دهد بدون باز کردن جریان در مرورگر.',
  tabLive: 'زنده — یو‌اس‌بی / لپ‌تاپ',
  tabIp: 'ثبت دوربین شبکه / مداربسته',
  discover: 'کشف دوربین‌ها',
  startPreview: 'شروع پیش‌نمایش زنده',
  stop: 'توقف',
  localCamera: 'دوربین محلی',
  selectCamera: 'انتخاب دوربین',
  discoverFirst: 'ابتدا کشف کنید',
  bindSlot: 'اتصال به جایگاه دوربین ایمنی',
  selectFleetSlot: 'انتخاب جایگاه ناوگان',
  bindToSlot: 'اتصال به جایگاه',
  unbindSlot: 'قطع اتصال جایگاه',
  slotBoundPrefix: 'جایگاه به ',
  slotBoundSuffix: ' متصل است · ',
  activeUsb: 'اتصالات فعال یو‌اس‌بی',
  livePreview: 'پیش‌نمایش زنده',
  signal: '● سیگنال',
  ready: '○ آماده',
  previewHint: 'دوربین را کشف کنید، سپس پیش‌نمایش را شروع کنید',
  registerTitle: 'ثبت دوربین مداربسته / شبکه',
  registerHint:
    'نیت اتصال برای عامل لبه ذخیره می‌شود. مرورگر مستقیماً آدرس استریم را باز نمی‌کند — این رفتار به‌خاطر امنیت و پایداری عمداً طراحی شده است.',
  displayName: 'نام نمایشی',
  placeholderName: 'دوربین پی‌تی‌زد آپرون جنوبی',
  code: 'کد',
  placeholderCode: 'دوربین-09',
  source: 'منبع',
  host: 'آدرس / میزبان',
  placeholderHost: 'آدرس استریم روی شبکه داخلی کارگاه',
  location: 'محل',
  placeholderLocation: 'طبقه 2 — لبه شرقی',
  username: 'نام کاربری (اختیاری)',
  placeholderUser: 'مدیرسیستم',
  addToList: 'افزودن به فهرست',
  registeredTitle: (n: number) => `دوربین‌های شبکه ثبت‌شده (${n})`,
  emptyIp:
    'هنوز دوربین شبکه‌ای ثبت نشده است. نقاط انتهایی آدرس استریم / کشف خودکار شبکه را اضافه کنید تا کارفرما مسیر تولید را از پیش تعریف‌شده ببیند.',
  remove: 'حذف',
} as const

export const HSE_DOCS_COPY = {
  title: 'راهنمای عملیات ایمنی',
  description:
    'این راهنما نحوه استقرار، بهره‌برداری و نگهداری سامانه پایش هوشمند ایمنی MSA را توضیح می‌دهد.',
  toc: 'فهرست مطالب',
  audiencePrefix: 'مخاطب: ',
  audience: {
    all: 'همه',
    client: 'کارفرما',
    safetyOfficer: 'مسئول ایمنی',
    tech: 'تیم فنی',
  },
} as const

export const HSE_REPORTS_COPY = {
  csvHeaders: [
    'کد',
    'عنوان',
    'شدت',
    'وضعیت',
    'زون',
    'دوربین',
    'اطمینان',
    'زمان‌تشخیص',
    'مثبت‌کاذب',
  ] as const,
  title: 'گزارش‌ها',
  description: 'خلاصه حوادث فیلترشده بر اساس دوره برای بازبینی ایمنی پروژه و جلسه پیمانکاران.',
  today: 'امروز',
  last7: '7 روز اخیر',
  last30: '30 روز اخیر',
  exportTable: 'خروجی جدول',
  kpiIncidents: 'حوادث در دوره',
  kpiCritical: 'بحرانی',
  kpiConfirmed: 'تأیید / ارجاع‌شده',
  kpiFalsePositive: 'مثبت کاذب',
  panelTitle: 'حوادث در دوره',
  todayDesc: 'تشخیص‌شده از ابتدای روز نمایشی (ساعت آزمایشی)',
  periodDesc: (label: string) =>
    `فیلتر بر اساس زمان تشخیص نسبت به نقطه مرجع نمایشی (${label})`,
  days7: '7 روز',
  days30: '30 روز',
  empty: 'حادثه‌ای در این دوره نیست.',
} as const

export const HSE_RULES_COPY = {
  savedNote: (code: string) => `پیکربندی ${code} ذخیره شد (فقط نشست محلی)`,
  title: 'قوانین تشخیص',
  description: 'آستانه‌ها، دوره‌های خنک‌سازی و اتصال زون برای خط لوله لبه و تأیید.',
  tableTitle: 'جدول قوانین',
  policyCount: (n: number) => `${n} سیاست`,
  colRule: 'قانون',
  colSeverity: 'شدت',
  colConfidence: 'اطمینان',
  colDuration: 'مدت',
  colCooldown: 'خنک‌سازی',
  colEnabled: 'فعال',
  configTitle: 'پیکربندی قانون',
  selectRule: 'یک قانون را انتخاب کنید',
  empty: 'برای ویرایش آستانه‌ها و اتصال زون، یک قانون را انتخاب کنید.',
  severity: 'شدت',
  confidence: 'اطمینان (0–1)',
  duration: 'مدت (ثانیه)',
  cooldown: 'خنک‌سازی (ثانیه)',
  ruleEnabled: 'قانون فعال است',
  activeZones: 'زون‌های فعال',
  percent: '٪',
  sec: 'ث',
} as const

export const HSE_SETTINGS_COPY = {
  savedNote: 'تنظیمات سازمان ذخیره شد (فقط نشست محلی)',
  title: 'تنظیمات',
  description: 'هویت پروژه، نگهداری، تأیید هوش مصنوعی، و جایگاه نقش‌ها برای این ماژول ایمنی.',
  orgTitle: 'سازمان / پروژه',
  orgDesc: 'هویت فقط‌خواندنی از رکورد پروژه',
  projectName: 'نام پروژه',
  projectCode: 'کد پروژه',
  location: 'محل',
  retentionTitle: 'نگهداری و هوش مصنوعی',
  retentionDesc: 'پیش‌فرض‌های عملیاتی قابل ویرایش',
  retentionDays: 'نگهداری شواهد (روز)',
  retentionHint:
    'بافرهای لبه کلیپ‌های کوتاه را نگه می‌دارند؛ نگهداری ابری فریم‌ها، گزارش تصمیم و گزارش‌های قابل خروجی را برای بازه انتخاب‌شده پوشش می‌دهد.',
  aiEnable: 'فعال‌سازی تأیید فهرست کوتاه هوش مصنوعی پیش از صف بازبینی انسانی',
  notifyTitle: 'پیش‌فرض اعلان‌ها',
  notifyDesc: 'هنگام پیوستن کاربر جدید به پروژه اعمال می‌شود',
  notifyCritical: 'بحرانی به‌طور پیش‌فرض',
  notifyHigh: 'بالا به‌طور پیش‌فرض',
  notifyMedium: 'متوسط به‌طور پیش‌فرض',
  rolesTitle: 'نقش‌ها (جایگزین موقت)',
  rolesDesc: 'فهرست کاربران نگاشت‌شده به نقش‌های ایمنی',
  colName: 'نام',
  colRole: 'نقش',
  colEmail: 'ایمیل',
  rolesHint:
    'مجوز نقش‌ها (چه کسی می‌تواند تأیید، ارجاع یا تغییر قوانین کند) در تولید به کنترل دسترسی سازمانی سایت‌پایلوت متصل می‌شود. این جدول فهرست جایگزین برای ماژول نمایشی است.',
} as const

export const HSE_ZONES_COPY = {
  title: 'زون‌ها',
  description: 'مناطق کاری طبقه‌بندی‌شده بر اساس ریسک، متصل به دوربین‌ها و قوانین تشخیص.',
  panelTitle: 'ثبت زون‌ها',
  zoneCount: (n: number) => `${n} زون`,
  empty: 'زونی پیکربندی نشده است.',
  colZone: 'زون',
  colRisk: 'ریسک',
  colArea: 'محدوده',
  colCameras: 'دوربین‌ها',
  colRules: 'قوانین',
  colNotes: 'یادداشت‌ها',
  editorTitle: 'ویرایشگر زون (جایگزین موقت)',
  editorDesc:
    'ترسیم ناحیه مورد نظر چندضلعی به دستگاه لبه متصل می‌شود — هنوز در این پوسته رابط کاربری موجود نیست',
  editorHeading: 'ناحیه مورد نظر چندضلعی وابسته به لبه',
  editorBody:
    'هندسه زون روی نمای کالیبره‌شده دوربین ترسیم و به گره لبهٔ کارگاه ارسال می‌شود. مرکز کنترل فراداده زون (ریسک، دوربین‌های متصل، قوانین) را نگه می‌دارد؛ رأس‌های چندضلعی و ماسک‌های فضای پیکسل روی لبه می‌مانند تا اگر پیوند ابری قطع شد، استنتاج ادامه یابد.',
  editorLi1:
    'نصاب چندضلعی بسته‌ای روی فریم کالیبراسیون ثابت از دوربین انتخاب‌شده رسم یا وارد می‌کند.',
  editorLi2:
    'به‌روزرسانی ناحیه مورد نظر تا دریافت تأیید همگام‌سازی از لبه، قوانین آن زون با اطمینان کامل از سر گرفته نمی‌شوند.',
  editorLi3:
    'تا زمان عرضه ویرایشگر، یادداشت‌های موقت ناحیه مورد نظر را در فیلدهای کالیبراسیون هر دوربین ثبت کنید و علامت‌گذاری کارگاهی را با برچسب محدوده بالا هم‌راستا نگه دارید.',
} as const

export const HSE_SAFETY_ALERTS_COPY = {
  nav: {
    safety: 'ایمنی و اخطارها',
    overview: 'خلاصه وضعیت',
    workshop: 'لیست‌های کارگاه',
    drawings: 'نقشه‌ها',
    inspection: 'درخواست بازرسی',
    today: 'فعالیت‌های امروز',
    lookahead: 'نگاه به جلو',
    issues: 'مسائل و هشدارها',
    resources: 'منابع و مصالح',
    ai: 'اقدامات هوشمند',
  },
  filters: {
    all: 'همه',
    critical: 'بحرانی',
    my_action: 'نیازمند اقدام من',
    escalated: 'ارجاع بالا',
    ai_review: 'بازبینی هوشمند',
    resolved: 'حل‌شده',
  },
  openTitle: (count: number) => `${count.toLocaleString('en-US')} هشدار ایمنی باز`,
  minutesAgo: (minutes: number) => `${minutes} دقیقه پیش`,
  hoursAgo: (hours: number) => `${hours} ساعت پیش`,
  hoursMinutesAgo: (hours: number, minutes: number) =>
    `${hours} ساعت و ${minutes} دقیقه پیش`,
  softSeverity: {
    critical: 'بحرانی',
    high: 'هشدار',
    medium: 'متوسط',
    low: 'کم',
  },
  softStatus: {
    assigned: 'محول‌شده',
    escalated: 'ارجاع بالا',
    ai_review: 'بازبینی هوشمند',
    confirmed: 'تأیید تخلف',
    closed: 'حل‌شده',
  },
  summaryCritical: 'بحرانی',
  summaryNeedsReview: 'نیازمند بررسی',
  summarySolved: 'حل‌شده',
  ariaSummary: 'خلاصه وضعیت اخطارها',
  ariaFilter: 'فیلتر اخطارها',
  ariaSections: 'منوی بخش‌ها',
  sectionsList: 'فهرست بخش‌ها',
  closeMenu: 'بستن منو',
  close: 'بستن',
  confirmFieldAction: 'تایید اقدام میدانی',
  viewDetails: 'مشاهده جزئیات و شواهد',
  pageTitle: 'ایمنی و اخطارها',
  pageSubtitle: 'اعلان‌های تأییدشده برای اقدام میدانی',
  pageHint:
    'پس از تأیید مسئول ایمنی، موارد برای اقدام میدانی اینجا می‌آیند. روی هر مورد اقدام کنید یا جزئیات و شواهد را ببینید.',
  embeddedHint:
    'پس از تأیید مسئول ایمنی، موارد برای اقدام میدانی اینجا می‌آیند. با کلیک روی خلاصه بالا، فقط همان دسته را ببینید.',
  empty: 'موردی در این فیلتر نیست.',
} as const
