/**
 * @file features/finance/config.ts
 * @purpose برچسب داشبورد هزینه و صفحات مالی
 * @safe-to-edit YES
 * @affects /finance/costs و داشبورد حسابدار
 * @depends-on features/finance/lib/ui-copy
 */

export const COSTS_DASHBOARD_COPY = {
  title: 'داشبورد هزینه‌ها',
  emptyAssign: 'از ادمین بخواهید شما را به‌عنوان حسابدار پروژه روی یک پروژه منصوب کند.',
  description: 'ثبت و بررسی هزینه‌های واقعی پروژه (AC) — مصالح، نیروی کار، تجهیزات، پیمانکاران، سربار.',
  totalAc: 'جمع AC',
  filters: 'فیلترها',
  addCost: 'افزودن هزینه',
  closeForm: 'بستن فرم',
  latest: 'آخرین رکوردهای هزینه',
  deleteFailed: 'حذف ناموفق بود',
  loading: 'در حال بارگذاری هزینه‌ها…',
  empty: 'هنوز رکورد هزینه‌ای ثبت نشده است.',
  type: 'نوع',
  allTypes: 'همه انواع',
  itemCode: 'کد آیتم',
  itemCodePlaceholder: 'مثلاً ELEV-01',
  dateFrom: 'از تاریخ',
  dateTo: 'تا تاریخ',
  newRecord: 'رکورد هزینه جدید',
  date: 'تاریخ',
  amount: 'مبلغ',
  invoice: 'شماره فاکتور',
  descriptionLabel: 'شرح',
  saveCost: 'ذخیره هزینه',
  item: 'آیتم',
  invoiceCol: 'فاکتور',
  deleteAria: 'حذف',
  loadFailed: 'بارگذاری هزینه‌ها ناموفق بود',
  amountPositive: 'مبلغ باید بیشتر از صفر باشد.',
  saveFailed: 'ذخیره هزینه ناموفق بود',
  confirmDelete: 'این رکورد هزینه حذف شود؟',
  perCapitaFailed: (error: string) => `جدول سرانه بالا نیامد: ${error}`,
  perCapitaFailedEn: (error: string) => `Per-capita table failed: ${error}`,
} as const

export {
  JALALI_MONTHS_FA,
  OVERHEAD_MATRIX_COPY,
  MONTH_COLUMN_HEADER_COPY,
  EMPLOYER_PURCHASES_COPY,
  LIVE_WORKSHOP_COPY,
  SALES_INVOICE_COPY,
  WORKSHOP_COST_CHART_COPY,
  EXPENSE_MANAGEMENT_COPY,
  CONTRACTOR_WORKSHOP_COPY,
  OVERHEAD_PER_CAPITA_COPY,
  ACCOUNTANT_SHELL_COPY,
  ACCOUNTANT_NATIVE_COPY,
  CONTRACTOR_PAYABLES_COPY,
} from './lib/ui-copy'

/** Default overhead matrix column count and Jalali year when a month label has no year. */
export const OVERHEAD_MATRIX_DEFAULTS = {
  monthCount: 6,
  jalaliYear: 1404,
} as const

/** Employer purchase allocation must sum to this percent (within tolerance). */
export const EMPLOYER_PURCHASE_SHARE = {
  totalPercent: 100,
  tolerance: 0.01,
} as const
