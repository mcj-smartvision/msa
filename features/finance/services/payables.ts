import type { SupabaseClient } from '@supabase/supabase-js'
import type {
ContractorPayablePayment,
CreatePayableInput,
PayableSummary,
PayableType,
RecordPayablePaymentInput,
VendorBillRow,
} from '@/features/finance/lib/payable-types'
import {
normalizePayableStatus,
remainingOf,
} from '@/features/finance/lib/payable-types'

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapBill(row: Record<string, unknown>): VendorBillRow {
  const amount = toNumber(row.amount)
  const paid = toNumber(row.paid_amount)
  const remaining =
    row.remaining_amount != null ? toNumber(row.remaining_amount) : Math.max(0, amount - paid)
  const status = normalizePayableStatus(String(row.status ?? 'open'), (row.due_date as string) ?? null, remaining)

  return {
    id: String(row.id),
    project_id: String(row.project_id),
    vendor_name: String(row.vendor_name ?? ''),
    amount,
    paid_amount: paid,
    remaining_amount: remaining,
    status,
    due_date: (row.due_date as string) ?? null,
    bill_date: String(row.bill_date ?? ''),
    description: String(row.description ?? ''),
    payable_type: (row.payable_type as PayableType) ?? 'payable',
    related_document_id: (row.related_document_id as string) ?? null,
    related_document_type: (row.related_document_type as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

const BILL_SELECT =
  'id, project_id, vendor_name, amount, paid_amount, remaining_amount, status, due_date, bill_date, description, payable_type, related_document_id, related_document_type, created_at, updated_at'

export async function fetchContractorPayables(
  supabase: SupabaseClient,
  projectId: string,
  filters?: {
    status?: string | 'all'
    search?: string
  }
): Promise<VendorBillRow[]> {
  let query = supabase
    .from('vendor_bills')
    .select(BILL_SELECT)
    .eq('project_id', projectId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('bill_date', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters?.search?.trim()) {
    const q = filters.search.trim()
    query = query.or(`vendor_name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) {
    // Fallback if migration 41 columns not applied yet
    const legacy = await supabase
      .from('vendor_bills')
      .select('id, project_id, vendor_name, amount, paid_amount, status, due_date, bill_date, created_at')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true, nullsFirst: false })
    if (legacy.error) throw new Error(error.message)
    return (legacy.data ?? []).map((r) => mapBill(r as Record<string, unknown>))
  }

  return (data ?? []).map((r) => mapBill(r as Record<string, unknown>))
}

/** @deprecated use fetchContractorPayables */
export async function fetchVendorBills(
  supabase: SupabaseClient,
  projectId: string
): Promise<VendorBillRow[]> {
  return fetchContractorPayables(supabase, projectId)
}

export function buildPayableSummary(bills: VendorBillRow[]): PayableSummary {
  let totalRecognized = 0
  let totalOpen = 0
  let totalPaid = 0
  let overdueAmount = 0
  let overdueCount = 0
  let openCount = 0

  for (const bill of bills) {
    if (bill.status === 'cancelled') continue
    totalRecognized += bill.amount
    totalPaid += bill.paid_amount
    const rem = remainingOf(bill)
    if (rem > 0) {
      totalOpen += rem
      openCount += 1
    }
    if (bill.status === 'overdue' || (rem > 0 && bill.due_date && new Date(bill.due_date) < startOfToday())) {
      overdueAmount += rem
      overdueCount += 1
    }
  }

  return { totalRecognized, totalOpen, totalPaid, overdueAmount, overdueCount, openCount }
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function buildVendorBillKpis(bills: VendorBillRow[]): {
  unpaidVendorBills: number
  overdueCount: number
} {
  const s = buildPayableSummary(bills)
  return { unpaidVendorBills: s.totalOpen, overdueCount: s.overdueCount }
}

export function getUnpaidVendorBills(bills: VendorBillRow[]): VendorBillRow[] {
  return bills.filter((b) => remainingOf(b) > 0 && b.status !== 'cancelled')
}

export async function createContractorPayable(
  supabase: SupabaseClient,
  input: CreatePayableInput
): Promise<VendorBillRow> {
  const paid = input.paidAmount ?? 0
  const payload: Record<string, unknown> = {
    project_id: input.projectId,
    vendor_name: input.contractorName.trim(),
    amount: input.amount,
    paid_amount: paid,
    due_date: input.dueDate ?? null,
    bill_date: input.billDate ?? new Date().toISOString().slice(0, 10),
    description: input.description?.trim() || '',
    payable_type: input.payableType ?? 'payable',
    related_document_id: input.relatedDocumentId ?? null,
    related_document_type: input.relatedDocumentType ?? null,
    created_by: input.createdBy ?? null,
    status: paid <= 0 ? 'open' : paid < input.amount ? 'partial' : 'settled',
  }

  const { data, error } = await supabase
    .from('vendor_bills')
    .insert(payload)
    .select(BILL_SELECT)
    .single()

  if (error) {
    // Retry without new columns if migration not applied
    const { data: legacy, error: legacyErr } = await supabase
      .from('vendor_bills')
      .insert({
        project_id: input.projectId,
        vendor_name: input.contractorName.trim(),
        amount: input.amount,
        paid_amount: paid,
        due_date: input.dueDate ?? null,
        bill_date: input.billDate ?? new Date().toISOString().slice(0, 10),
        created_by: input.createdBy ?? null,
        status: paid <= 0 ? 'Unpaid' : paid < input.amount ? 'PartiallyPaid' : 'Paid',
      })
      .select('id, project_id, vendor_name, amount, paid_amount, status, due_date, bill_date, created_at')
      .single()
    if (legacyErr) throw new Error(error.message)
    return mapBill(legacy as Record<string, unknown>)
  }

  return mapBill(data as Record<string, unknown>)
}

/**
 * Record a cash/check payment against a payable.
 * Does NOT delete the expense — only reduces the liability balance.
 */
export async function recordPayablePayment(
  supabase: SupabaseClient,
  input: RecordPayablePaymentInput
): Promise<VendorBillRow> {
  if (input.amount <= 0) throw new Error('Payment amount must be greater than zero')

  const { data: bill, error: fetchErr } = await supabase
    .from('vendor_bills')
    .select(BILL_SELECT)
    .eq('id', input.vendorBillId)
    .single()

  if (fetchErr || !bill) throw new Error(fetchErr?.message ?? 'Payable not found')

  const current = mapBill(bill as Record<string, unknown>)
  if (current.status === 'cancelled') throw new Error('Cannot pay a cancelled payable')
  const rem = remainingOf(current)
  if (input.amount > rem + 0.001) {
    throw new Error('Payment exceeds remaining balance')
  }

  const newPaid = current.paid_amount + input.amount

  // Payment ledger row (best-effort if table exists)
  await supabase.from('contractor_payable_payments').insert({
    project_id: input.projectId,
    vendor_bill_id: input.vendorBillId,
    amount: input.amount,
    payment_date: input.paymentDate,
    method: input.method ?? 'cash',
    reference: input.reference?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: input.createdBy ?? null,
  })

  const { data, error } = await supabase
    .from('vendor_bills')
    .update({
      paid_amount: newPaid,
      updated_by: input.createdBy ?? null,
    })
    .eq('id', input.vendorBillId)
    .select(BILL_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapBill(data as Record<string, unknown>)
}

export async function cancelContractorPayable(
  supabase: SupabaseClient,
  billId: string,
  userId?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('vendor_bills')
    .update({ status: 'cancelled', updated_by: userId ?? null })
    .eq('id', billId)
  if (error) throw new Error(error.message)
}

export async function fetchPayablePayments(
  supabase: SupabaseClient,
  vendorBillId: string
): Promise<ContractorPayablePayment[]> {
  const { data, error } = await supabase
    .from('contractor_payable_payments')
    .select('*')
    .eq('vendor_bill_id', vendorBillId)
    .order('payment_date', { ascending: false })

  if (error) return []
  return (data ?? []).map((r) => ({
    ...r,
    amount: toNumber(r.amount),
  })) as ContractorPayablePayment[]
}

/**
 * When a subcontractor expense is finalized without full payment,
 * create an open payable so the liability does not disappear.
 */
export async function ensurePayableForFinalizedExpense(
  supabase: SupabaseClient,
  input: {
    projectId: string
    documentId: string
    contractorName: string
    amount: number
    dueDate?: string | null
    description?: string
    createdBy?: string | null
    billDate?: string
  }
): Promise<VendorBillRow | null> {
  if (input.amount <= 0) return null

  const { data: existing } = await supabase
    .from('vendor_bills')
    .select('id')
    .eq('related_document_id', input.documentId)
    .maybeSingle()

  if (existing?.id) return null

  return createContractorPayable(supabase, {
    projectId: input.projectId,
    contractorName: input.contractorName || 'پیمانکار',
    amount: input.amount,
    paidAmount: 0,
    dueDate: input.dueDate ?? null,
    billDate: input.billDate,
    description: input.description,
    payableType: 'payable',
    relatedDocumentId: input.documentId,
    relatedDocumentType: 'accounting_document',
    createdBy: input.createdBy,
  })
}
