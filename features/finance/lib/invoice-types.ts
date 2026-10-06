export const FINANCIAL_INVOICE_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'paid',
] as const

export type FinancialInvoiceStatus = (typeof FINANCIAL_INVOICE_STATUSES)[number]

/** @deprecated prefer PAYABLE_STATUSES from payable-types */
export const VENDOR_BILL_STATUSES = ['Unpaid', 'PartiallyPaid', 'Paid'] as const

export type {
  VendorBillStatus,
  VendorBillRow,
  PayableStatus,
  PayableType,
} from '@/features/finance/lib/payable-types'

export { PAYABLE_STATUSES, PAYABLE_TYPES } from '@/features/finance/lib/payable-types'

export interface FinancialInvoiceRow {
  id: string
  project_id: string
  invoice_no: string | null
  period_start: string | null
  period_end: string | null
  invoice_date: string | null
  total_amount: number
  approved_amount: number
  paid_amount: number
  retention_held: number
  status: FinancialInvoiceStatus
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface AccountantKpis {
  totalInvoiced: number
  totalPaid: number
  outstandingReceivables: number
  unpaidVendorBills: number
  stockValuation: number
}

export interface FinancialAlert {
  id: string
  kind: 'approved_unpaid' | 'under_review_stale' | 'vendor_overdue'
  title: string
  detail: string
  severity: 'warning' | 'danger'
}

export interface CreateInvoiceInput {
  projectId: string
  invoiceNo: string
  periodStart: string
  periodEnd: string
  amount: number
  status: FinancialInvoiceStatus
  invoiceDate?: string
  dueDate?: string
  createdBy?: string
}

export interface UpdateInvoiceFinancialInput {
  id: string
  status?: FinancialInvoiceStatus
  approvedAmount?: number
  paidAmount?: number
  retentionHeld?: number
  dueDate?: string
}

export interface RecordPaymentInput {
  invoiceId: string
  additionalPaid: number
}
