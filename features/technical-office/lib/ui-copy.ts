/**
 * @file features/technical-office/lib/ui-copy.ts
 * @purpose برچسب‌ها و پیام‌های فارسی UI دفتر فنی
 * @safe-to-edit YES
 * @affects پیمانکاران، نقشه‌ها، فعالیت‌های پیمانکار
 * @depends-on nothing
 */

export const CONTRACTORS_COPY = {
  loadFailed: 'بارگذاری پیمانکاران ناموفق بود',
  fieldsRequired: 'همه فیلدهای مشخصات و تاریخ قرارداد الزامی هستند.',
  pdfOnly: 'اگر فایل می‌گذارید باید PDF باشد.',
  ceoNotes: (name: string) => `مدیرعامل: ${name}`,
  contractTitle: (company: string) => `قرارداد ${company}`,
  savedWithFile: 'پیمانکار و فایل قرارداد با موفقیت ثبت شد.',
  saved: 'پیمانکار ثبت شد.',
  saveFailed: 'ثبت پیمانکار ناموفق بود',
  downloadFailed: 'دانلود قرارداد ناموفق بود',
  editFieldsRequired: 'اطلاعات مدیرعامل، شرکت، شماره و تاریخ قرارداد را کامل کنید.',
  replacePdfOnly: 'فایل جایگزین قرارداد باید PDF باشد.',
  edited: 'اطلاعات پیمانکار ویرایش شد.',
  editFailed: 'ویرایش پیمانکار ناموفق بود',
  newTitle: 'ثبت پیمانکار جدید',
  ceoFirstName: 'نام مدیرعامل',
  firstNamePh: 'نام',
  ceoLastName: 'نام خانوادگی مدیرعامل',
  lastNamePh: 'نام خانوادگی',
  companyName: 'نام شرکت',
  companyPh: 'نام شرکت پیمانکار',
  contractDate: 'تاریخ قرارداد',
  contractNo: 'شماره قرارداد',
  uploadOptional: 'آپلود قرارداد (اختیاری)',
  submit: 'ثبت پیمانکار',
  listTitle: 'پیمانکاران ثبت‌شده',
  loading: 'در حال بارگذاری...',
  empty: 'هنوز پیمانکاری ثبت نشده است.',
  ceoFirstPh: 'نام مدیرعامل',
  ceoLastPh: 'نام خانوادگی مدیرعامل',
  companyPhShort: 'نام شرکت',
  replacePdf: 'تعویض فایل PDF (اختیاری)',
  saveEdit: 'ذخیره ویرایش',
  cancel: 'انصراف',
  edit: 'ویرایش',
  dash: '—',
  ceoPrefix: (name: string) => `مدیرعامل: ${name}`,
  contractMeta: (no: string, date: string) => `شماره قرارداد: ${no} · تاریخ: ${date}`,
  downloadPdf: 'دانلود قرارداد PDF',
  noContractFile: 'فایل قرارداد ثبت نشده',
  activities: 'فعالیت‌ها',
  contractorFallback: 'پیمانکار',
} as const

export const DRAWINGS_COPY = {
  otherTab: 'نقشه‌های سایر',
  tabPrefix: (label: string) => `نقشه‌های ${label}`,
  loadFailed: 'بارگذاری نقشه‌ها انجام نشد.',
  uploadFailed: 'آپلود انجام نشد.',
  uploaded: (n: number, extra: string) =>
    `${n} نقشه بارگذاری شد. سرپرست کارگاه می‌تواند ببیند و دانلود کند.${extra}`,
  downloadFailed: 'دانلود انجام نشد.',
  deleteFailed: 'حذف انجام نشد.',
  selectProject: 'ابتدا یک پروژه انتخاب کنید.',
  title: 'نقشه‌های پروژه',
  hint: 'PDF و DWG، تکی یا گروهی. سرپرست کارگاه همین نقشه‌ها را می‌بیند و می‌تواند دانلود کند.',
  discipline: 'رشته نقشه',
  titleOptional: 'عنوان (اختیاری)',
  titlePh: 'پیشوند یا عنوان نقشه',
  fileLabel: 'فایل نقشه',
  filesSelected: (n: number) => `${n} فایل انتخاب شد`,
  chooseFiles: 'انتخاب فایل',
  uploading: 'در حال آپلود...',
  uploadMany: (n: number) => `آپلود ${n} نقشه`,
  uploadOne: 'آپلود نقشه',
  removeFile: 'حذف فایل',
  loading: 'در حال بارگذاری...',
  empty: 'هنوز نقشه‌ای برای این پروژه بارگذاری نشده است.',
  categoriesAria: 'دسته نقشه‌ها',
  drawingsWord: 'نقشه‌های',
  emptyTab: (label: string) => `در دسته «${label}» نقشه‌ای ثبت نشده است.`,
  download: 'دانلود',
} as const

export const CONTRACTOR_QTY_KIND = {
  approx: 'حدودی',
  final: 'قطعی',
} as const

export type ContractorQtyKind = (typeof CONTRACTOR_QTY_KIND)[keyof typeof CONTRACTOR_QTY_KIND]

export const CONTRACTOR_ACTIVITIES_COPY = {
  loadFailed: 'بارگذاری فعالیت‌ها ناموفق بود',
  title: (name: string) => `فعالیت‌ها — ${name}`,
  readOnly: 'فقط مشاهده — از برنامه زمان‌بندی؛ قابل ویرایش نیست',
  close: 'بستن',
  mismatch: (n: string) =>
    `درصد صورت‌وضعیت ${n} فعالیت با پیشرفت فیزیکی گزارش روزانه فرق دارد. مبلغ کارکرد با همان درصد صورت‌وضعیت حساب می‌شود.`,
  loading: 'در حال بارگذاری فعالیت‌ها...',
  empty: 'فعالیت تخصیص‌یافته‌ای برای این پیمانکار وجود ندارد.',
  colItem: 'شرح آیتم',
  colQty: 'مقدار',
  colQtyStatus: 'وضعیت مقدار',
  colUnit: 'واحد',
  colUnitPrice: 'قیمت واحد',
  colStatement: 'پیشرفت صورت‌وضعیت',
  physicalTitle: 'آخرین درصد تجمعی ثبت‌شدهٔ سرپرست کارگاه',
  colPhysical: 'پیشرفت فیزیکی',
  colExecuted: 'کارکرد',
  mismatchTitle: 'با درصد صورت‌وضعیت فرق دارد',
  total: 'جمع',
  contractAmount: (amount: string) => `مبلغ قرارداد ${amount}`,
} as const
