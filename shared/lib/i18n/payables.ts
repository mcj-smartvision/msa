import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import type { PayableStatus, PayableType, PaymentMethod } from '@/features/finance/lib/payable-types'

const EN = {
  title: 'Contractor Payables',
  pageDescription:
    'Track unpaid contractor liabilities separately from expenses. Payment reduces the payable — it does not erase the recognized cost.',
  backToDashboard: 'Accountant Dashboard',
  manageExpenses: 'Expense Management',
  selectProject: 'Project',
  noProject: 'No active project assigned.',
  loadError: 'Failed to load payables.',
  saveError: 'Failed to save.',
  successSaved: 'Saved successfully.',
  successPayment: 'Payment recorded. Liability balance updated.',
  // Summary
  totalRecognized: 'Recognized contractor costs',
  totalOpen: 'Open liabilities',
  totalPaid: 'Paid to contractors',
  overdueAmount: 'Overdue balance',
  // Table
  tableTitle: 'Payables list',
  contractor: 'Contractor',
  amount: 'Amount (Rial)',
  paidAmount: 'Paid',
  remaining: 'Remaining',
  dueDate: 'Due date',
  status: 'Status',
  description: 'Description',
  relatedDoc: 'Related document',
  billDate: 'Bill date',
  type: 'Type',
  actions: 'Actions',
  empty: 'No contractor payables yet.',
  // Actions
  addPayable: 'New payable',
  recordPayment: 'Record payment',
  cancelPayable: 'Cancel',
  viewPayments: 'Payments',
  // Form
  formTitle: 'Register contractor payable',
  paymentTitle: 'Record payment against payable',
  paymentAmount: 'Payment amount (Rial)',
  paymentDate: 'Payment date',
  paymentMethod: 'Method',
  reference: 'Reference',
  notes: 'Notes',
  save: 'Save',
  cancel: 'Cancel',
  saving: 'Saving…',
  search: 'Search contractor / description',
  allStatuses: 'All statuses',
  ruleHint:
    'Example: plaster contractor owed 50,000,000 — stays as an open payable until cash is paid, even if the expense is already recognized.',
} as const

const FA = {
  title: 'بدهی پیمانکاران',
  pageDescription:
    'بدهی پیمانکار جدا از هزینه ثبت می‌شود. پرداخت فقط مانده بدهی را کم می‌کند — هزینهٔ شناسایی‌شده پاک نمی‌شود.',
  backToDashboard: 'داشبورد حسابداری',
  manageExpenses: 'مدیریت هزینه‌ها',
  selectProject: 'پروژه',
  noProject: 'پروژه فعالی تخصیص داده نشده است.',
  loadError: 'بارگذاری بدهی‌ها ناموفق بود.',
  saveError: 'ذخیره ناموفق بود.',
  successSaved: 'با موفقیت ذخیره شد.',
  successPayment: 'پرداخت ثبت شد. مانده بدهی به‌روز شد.',
  totalRecognized: 'هزینه شناسایی‌شده پیمانکاران',
  totalOpen: 'بدهی باز',
  totalPaid: 'پرداخت‌شده به پیمانکاران',
  overdueAmount: 'مانده سررسید گذشته',
  tableTitle: 'فهرست بدهی‌ها',
  contractor: 'پیمانکار',
  amount: 'مبلغ (ریال)',
  paidAmount: 'پرداخت‌شده',
  remaining: 'مانده',
  dueDate: 'سررسید',
  status: 'وضعیت',
  description: 'شرح',
  relatedDoc: 'سند مرتبط',
  billDate: 'تاریخ سند',
  type: 'نوع',
  actions: 'عملیات',
  empty: 'هنوز بدهی پیمانکاری ثبت نشده است.',
  addPayable: 'بدهی جدید',
  recordPayment: 'ثبت پرداخت',
  cancelPayable: 'لغو',
  viewPayments: 'پرداخت‌ها',
  formTitle: 'ثبت بدهی پیمانکار',
  paymentTitle: 'ثبت پرداخت روی بدهی',
  paymentAmount: 'مبلغ پرداخت (ریال)',
  paymentDate: 'تاریخ پرداخت',
  paymentMethod: 'روش پرداخت',
  reference: 'شماره پیگیری',
  notes: 'یادداشت',
  save: 'ذخیره',
  cancel: 'انصراف',
  saving: 'در حال ذخیره…',
  search: 'جستجوی پیمانکار / شرح',
  allStatuses: 'همه وضعیت‌ها',
  ruleHint:
    'مثال: بدهی گچ‌کار 50,000,000 — تا زمان پرداخت نقدی به‌صورت بدهی باز می‌ماند، حتی اگر هزینه قبلاً شناسایی شده باشد.',
} as const

const STATUS_FA: Record<PayableStatus, string> = {
  open: 'باز',
  partial: 'پرداخت جزئی',
  settled: 'تسویه‌شده',
  overdue: 'سررسید گذشته',
  cancelled: 'لغو‌شده',
  check_issued: 'چک صادر شده',
}

const STATUS_EN: Record<PayableStatus, string> = {
  open: 'Open',
  partial: 'Partial',
  settled: 'Settled',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  check_issued: 'Check issued',
}

const TYPE_FA: Record<PayableType, string> = {
  payable: 'بدهی',
  check_payable: 'بدهی چکی',
  accrued_expense: 'هزینه تعهدی',
}

const TYPE_EN: Record<PayableType, string> = {
  payable: 'Payable',
  check_payable: 'Check payable',
  accrued_expense: 'Accrued expense',
}

const METHOD_FA: Record<PaymentMethod, string> = {
  cash: 'نقد',
  transfer: 'حواله',
  check: 'چک',
  other: 'سایر',
}

const METHOD_EN: Record<PaymentMethod, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
  check: 'Check',
  other: 'Other',
}

export function getPayableMessages(locale: FormLocale) {
  if (locale === 'fa' || locale === 'ar') return FA
  return EN
}

export type PayableMessages = typeof EN

export function getPayableStatusLabel(status: string, locale: FormLocale): string {
  const map = locale === 'fa' || locale === 'ar' ? STATUS_FA : STATUS_EN
  if (status in map) return map[status as PayableStatus]
  // Legacy
  if (status === 'Unpaid') return map.open
  if (status === 'PartiallyPaid') return map.partial
  if (status === 'Paid') return map.settled
  return status
}

export function getPayableTypeLabel(type: PayableType, locale: FormLocale): string {
  if (locale === 'fa' || locale === 'ar') return TYPE_FA[type]
  return TYPE_EN[type]
}

export function getPaymentMethodLabel(method: PaymentMethod, locale: FormLocale): string {
  if (locale === 'fa' || locale === 'ar') return METHOD_FA[method]
  return METHOD_EN[method]
}
