/** Contractor / vendor payables — expense ≠ cash payment. */

export const PAYABLE_TYPES = ['payable', 'check_payable', 'accrued_expense'] as const
export type PayableType = (typeof PAYABLE_TYPES)[number]

export const PAYABLE_STATUSES = [
  'open',
  'partial',
  'settled',
  'overdue',
  'cancelled',
  'check_issued',
] as const
export type PayableStatus = (typeof PAYABLE_STATUSES)[number]

/** Legacy DB values still accepted until fully migrated. */
export type LegacyVendorBillStatus = 'Unpaid' | 'PartiallyPaid' | 'Paid'

export type VendorBillStatus = PayableStatus | LegacyVendorBillStatus

export const PAYMENT_METHODS = ['cash', 'transfer', 'check', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface VendorBillRow {
  id: string
  project_id: string
  vendor_name: string
  amount: number
  paid_amount: number
  remaining_amount?: number
  status: VendorBillStatus
  due_date: string | null
  bill_date: string
  description?: string
  payable_type?: PayableType
  related_document_id?: string | null
  related_document_type?: string | null
  created_at: string
  updated_at?: string
}

export interface ContractorPayablePayment {
  id: string
  project_id: string
  vendor_bill_id: string
  amount: number
  payment_date: string
  method: PaymentMethod
  reference: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface CreatePayableInput {
  projectId: string
  contractorName: string
  amount: number
  paidAmount?: number
  dueDate?: string | null
  billDate?: string
  description?: string
  payableType?: PayableType
  relatedDocumentId?: string | null
  relatedDocumentType?: string | null
  createdBy?: string | null
}

export interface RecordPayablePaymentInput {
  vendorBillId: string
  projectId: string
  amount: number
  paymentDate: string
  method?: PaymentMethod
  reference?: string
  notes?: string
  createdBy?: string | null
}

export interface PayableSummary {
  totalRecognized: number
  totalOpen: number
  totalPaid: number
  overdueAmount: number
  overdueCount: number
  openCount: number
}

export function normalizePayableStatus(status: string, dueDate: string | null, remaining: number): PayableStatus {
  if (status === 'cancelled' || status === 'check_issued') return status
  if (status === 'Paid' || status === 'settled' || remaining <= 0) return 'settled'
  if (status === 'PartiallyPaid' || status === 'partial') {
    if (dueDate && new Date(dueDate) < startOfToday() && remaining > 0) return 'overdue'
    return 'partial'
  }
  if (status === 'overdue') return 'overdue'
  if (dueDate && new Date(dueDate) < startOfToday() && remaining > 0) return 'overdue'
  return 'open'
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function remainingOf(bill: Pick<VendorBillRow, 'amount' | 'paid_amount' | 'remaining_amount'>): number {
  if (typeof bill.remaining_amount === 'number' && Number.isFinite(bill.remaining_amount)) {
    return bill.remaining_amount
  }
  return Math.max(0, Number(bill.amount) - Number(bill.paid_amount))
}
