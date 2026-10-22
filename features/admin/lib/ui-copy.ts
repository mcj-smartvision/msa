/**
 * @file features/admin/lib/ui-copy.ts
 * @purpose برچسب‌های UI باقی‌مانده صفحات ادمین
 * @safe-to-edit YES
 * @affects فرم‌ها، ناوبری، اعضا، اعلان‌ها و فهرست پروژه‌ها
 * @depends-on features/admin/lib/schedule-ui-copy.ts
 */

export {
  ADMIN_CATCH_UP_COPY,
  ADMIN_SCHEDULE_IMPORT_COPY,
  ADMIN_ACTUAL_START_COPY,
} from '@/features/admin/lib/schedule-ui-copy'

export function pickAdminLocale<TFa, TEn>(
  fa: boolean,
  pair: { readonly fa: TFa; readonly en: TEn }
): TFa | TEn {
  return fa ? pair.fa : pair.en
}

export const ADMIN_PROJECT_FORM_COPY = {
  saveFailed: 'ذخیره پروژه ناموفق بود',
  sectionBasics: 'مشخصات پایه',
  name: 'نام پروژه',
  code: 'کد پروژه',
  codePlaceholder: 'به‌صورت خودکار از نام ساخته می‌شود',
  description: 'توضیحات',
  status: 'وضعیت',
  statusPlanning: 'در حال برنامه‌ریزی',
  statusActive: 'فعال',
  statusCompleted: 'تکمیل‌شده',
  statusSuspended: 'متوقف',
  sectionParties: 'طرف‌های قرارداد',
  client: 'کارفرما',
  contractor: 'پیمانکار اصلی',
  manager: 'مدیر پروژه',
  sectionLocation: 'موقعیت',
  address: 'آدرس و موقعیت مکانی',
  addressPlaceholder: 'آدرس کامل، شهر، منطقه یا مختصات',
  sectionDates: 'زمان‌بندی قرارداد',
  startDate: 'تاریخ شروع پروژه',
  endDate: 'تاریخ پایان قرارداد',
  active: 'پروژه فعال',
  cancel: 'انصراف',
  saving: 'در حال ذخیره...',
} as const

export const ADMIN_PROJECT_CREATE_COPY = {
  saveFailed: 'ذخیره پروژه ناموفق بود',
  title: 'ایجاد پروژه جدید',
  description: 'مشخصات پایه پروژه را وارد کنید. پس از ایجاد می‌توانید اعضا و سمت‌ها را مدیریت کنید.',
  back: 'بازگشت',
  formTitle: 'فرم ایجاد پروژه',
  formHint: 'کارفرما، پیمانکار، مدیر پروژه، آدرس و تاریخ‌های قرارداد را تکمیل کنید.',
  exitFullscreen: 'خروج از حالت تمام‌صفحه',
  expandForm: 'بزرگ‌نمایی فرم',
  collapse: 'کوچک‌کردن',
  expand: 'بزرگ‌نمایی',
  submit: 'ایجاد پروژه',
} as const

export const ADMIN_NAV_COPY = {
  logout: 'خروج',
  project: 'پروژه',
  members: 'اعضا',
  positions: 'سمت‌ها',
  routing: 'اعلان‌ها',
  widgets: 'نمایش',
  fa: {
    controlCenter: 'کنترل سنتر',
    manager: 'مدیر',
    projects: 'پروژه‌ها',
    allProjects: 'همه پروژه‌ها',
    qualityControl: 'کنترل کیفیت',
    scheduleIntelligence: 'تحلیل زمان‌بندی',
    memberDashboards: 'داشبورد سمت‌ها',
    fullMemberList: 'فهرست کامل اعضا',
    supportMessages: 'ساپورت و پیام‌ها',
    criticalAlerts: 'هشدارهای بحرانی',
    settings: 'تنظیمات',
  },
  en: {
    controlCenter: 'Control Center',
    manager: 'Manager',
    projects: 'Projects',
    allProjects: 'All projects',
    qualityControl: 'Quality Control',
    scheduleIntelligence: 'Schedule Intelligence',
    memberDashboards: 'Position dashboards',
    fullMemberList: 'Full member list',
    supportMessages: 'Support & Messages',
    criticalAlerts: 'Critical Alerts',
    settings: 'Settings',
  },
} as const

export const ADMIN_SUPPORT_COPY = {
  status: {
    open: 'فوری',
    in_progress: 'اخیر',
    resolved: 'حل‌شده',
    closed: 'بسته‌شده',
  },
  priority: {
    low: 'کم',
    medium: 'متوسط',
    high: 'بالا',
    critical: 'بحرانی',
  },
  noTickets: 'هنوز پیامی ثبت نشده است.',
  noAlerts: 'در حال حاضر هشدار حل‌نشده‌ای وجود ندارد.',
  now: 'الان',
  ago: (time: string) => `${time} پیش`,
} as const

export const ADMIN_DIRECTORY_COPY = {
  fa: {
    none: 'ثبت نشده',
    empty: 'هنوز پروژه‌ای ثبت نشده است.',
    row: 'ردیف',
    project: 'پروژه',
    status: 'وضعیت',
    created: 'زمان ثبت پروژه',
    lastActivity: 'آخرین فعالیت',
    team: 'تیم',
    people: 'نفر',
    pageTitle: 'فهرست پروژه‌ها',
    pageHint: 'همه پروژه‌ها با شماره ردیف و مشخصات برای ادمین.',
  },
  en: {
    none: 'None',
    empty: 'No projects yet.',
    row: '#',
    project: 'Project',
    status: 'Status',
    created: 'Created',
    lastActivity: 'Last activity',
    team: 'Team',
    people: '',
    pageTitle: 'Project directory',
    pageHint: 'All projects with row numbers and details.',
  },
} as const

export const ADMIN_ROUTE_EDITOR_COPY = {
  saveFailed: 'ذخیره مسیر ناموفق بود',
  addTitle: 'افزودن مسیر اعلان',
  eventType: 'نوع رویداد',
  targetPosition: 'سمت هدف',
  emailEnabled: 'ایمیل فعال',
  saving: 'در حال ذخیره...',
  saveRoute: 'ذخیره مسیر',
  configuredTitle: 'مسیرهای پیکربندی‌شده',
  none: 'هنوز مسیر اعلانی پیکربندی نشده است.',
  eventFallback: 'رویداد',
  positionPrefix: 'سمت: ',
  remove: 'حذف',
  matrixTitle: 'ماتریس مسیریابی',
  eventCol: 'رویداد',
  email: 'ایمیل',
  silent: 'بی‌صدا',
} as const

export const ADMIN_PASSWORD_COPY = {
  updated: 'رمز عبور با موفقیت به‌روزرسانی شد.',
  resetFailed: 'بازنشانی رمز عبور ناموفق بود',
  title: 'اطلاعات ورود (نمای ادمین)',
  username: 'نام کاربری:',
  email: 'ایمیل:',
  noRealEmail: 'ایمیل واقعی هنوز ثبت نشده — برای اعلان ورود/خروج در فرم پایین ایمیل بگذارید.',
  lastVisiblePassword: 'آخرین رمز قابل‌مشاهده برای ادمین:',
  memberChangedPassword:
    'این عضو رمز خود را در تنظیمات تغییر داده است. ادمین آخرین رمزی را می‌بیند که خودش تنظیم کرده.',
  memberNotChanged: 'عضو هنوز رمز عبور را تغییر نداده است.',
  setNewPassword: 'تنظیم رمز جدید',
  newPasswordPlaceholder: 'رمز جدید برای این عضو',
  updating: 'در حال به‌روزرسانی...',
  updatePassword: 'به‌روزرسانی رمز عبور',
} as const

export const ADMIN_POSITION_FORM_COPY = {
  saveFailed: 'ذخیره سمت ناموفق بود',
  title: 'عنوان',
  key: 'کلید',
  description: 'توضیحات',
  active: 'سمت فعال',
  saving: 'در حال ذخیره...',
} as const

export const ADMIN_ADD_MEMBER_COPY = {
  hseTitle: 'مسئول ایمنی',
  addHse: 'افزودن مسئول ایمنی',
  loadFailed: 'بارگذاری اطلاعات عضو ناموفق بود',
  createFailed: 'ایجاد عضو ناموفق بود',
} as const

export const ADMIN_WIDGET_COPY = {
  titleByPosition: 'نمایش ویجت بر اساس سمت',
  position: 'سمت',
  visible: 'قابل‌نمایش',
  matrix: 'ماتریس نمایش',
  widget: 'ویجت',
  yes: 'بله',
  no: 'خیر',
} as const

export const ADMIN_MEMBERS_PAGE_COPY = {
  loadFailed: 'بارگذاری اعضا ناموفق بود',
  hseMissingTitle: 'مسئول ایمنی تعریف نشده',
  hseMissingHint: 'نقش «مسئول ایمنی» را به یک عضو اختصاص دهید تا داشبورد HSE برای او فعال شود.',
  defineHse: 'تعریف مسئول ایمنی',
  status: 'وضعیت',
  actions: 'عملیات',
  edit: 'ویرایش',
} as const

export const ADMIN_ONLINE_USERS_COPY = {
  online: 'حاضر',
  idle: 'خارج‌شده امروز',
  offline: 'غایب',
  empty: 'عضوی برای نمایش حضور وجود ندارد.',
} as const

export const ADMIN_MEMBER_FORM_COPY = {
  personnelCode: 'کد پرسنلی',
  personnelPlaceholder: 'مثلاً 1403-012',
} as const

export const ADMIN_PROJECT_ROW_COPY = {
  enabled: 'فعال در سامانه',
  disabled: 'غیرفعال',
  orgOwnerPrefix: 'سازمان / مالک:',
  memberWord: 'عضو',
  createdPrefix: 'ایجاد:',
  open: 'باز کردن',
  emptyTitle: 'هنوز پروژه‌ای نیست',
  emptyHint: 'اولین پروژه را بسازید تا اعضا، دسترسی‌ها و تنظیمات سامانه را از اینجا مدیریت کنید.',
  create: 'ایجاد پروژه',
} as const

export const ADMIN_CONTROL_CHROME_COPY = {
  helpAria: (label: string) => `راهنمای ${label}`,
} as const

export const ADMIN_CONTEXT_COPY = {
  loadDashboardFailed: 'بارگذاری داشبورد ناموفق بود',
} as const

export const ADMIN_CONSTRUCTION_ROLE_COPY = {
  hseMissing:
    'نقش «مسئول ایمنی» در این پروژه تعریف نشده. نقش‌های پیش‌فرض را به‌روز کنید تا در لیست ظاهر شود.',
} as const
