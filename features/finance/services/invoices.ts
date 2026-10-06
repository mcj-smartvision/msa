import type { SupabaseClient } from '@supabase/supabase-js'
import type {
AccountantKpis,
CreateInvoiceInput,
FinancialAlert,
FinancialInvoiceRow,
RecordPaymentInput,
UpdateInvoiceFinancialInput,
} from '@/features/finance/lib/invoice-types'

const APPROVED_UNPAID_DAYS = 14
const UNDER_REVIEW_STALE_DAYS = 30

function daysSince(dateIso: string): number {
  const d = new Date(dateIso)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export async function fetchFinancialInvoices(
  supabase: SupabaseClient,
  projectId: string
): Promise<FinancialInvoiceRow[]> {
  const { data, error } = await supabase
    .from('financial_invoices')
    .select(
      'id, project_id, invoice_no, period_start, period_end, invoice_date, total_amount, approved_amount, paid_amount, retention_held, status, due_date, created_at, updated_at'
    )
    .eq('project_id', projectId)
    .order('invoice_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...row,
    total_amount: Number(row.total_amount) || 0,
    approved_amount: Number(row.approved_amount) || 0,
    paid_amount: Number(row.paid_amount) || 0,
    retention_held: Number(row.retention_held) || 0,
  })) as FinancialInvoiceRow[]
}

export function buildInvoiceKpis(invoices: FinancialInvoiceRow[]): Pick<
  AccountantKpis,
  'totalInvoiced' | 'totalPaid' | 'outstandingReceivables'
> {
  let totalInvoiced = 0
  let totalPaid = 0
  let outstandingReceivables = 0

  for (const inv of invoices) {
    totalInvoiced += inv.total_amount
    totalPaid += inv.paid_amount
    if (inv.approved_amount > inv.paid_amount) {
      outstandingReceivables += inv.approved_amount - inv.paid_amount
    }
  }

  return { totalInvoiced, totalPaid, outstandingReceivables }
}

export function buildFinancialAlerts(
  invoices: FinancialInvoiceRow[],
  vendorOverdueCount: number,
  locale: 'fa' | 'en' = 'fa'
): FinancialAlert[] {
  const alerts: FinancialAlert[] = []
  const isFa = locale === 'fa'

  for (const inv of invoices) {
    const ref = inv.invoice_no ?? inv.id.slice(0, 8)
    const anchor = inv.updated_at ?? inv.invoice_date ?? inv.created_at

    if (
      inv.status === 'approved' &&
      inv.paid_amount < inv.approved_amount &&
      daysSince(anchor) > APPROVED_UNPAID_DAYS
    ) {
      const remaining = inv.approved_amount - inv.paid_amount
      alerts.push({
        id: `approved-${inv.id}`,
        kind: 'approved_unpaid',
        title: isFa
          ? `${ref}: صورت‌وضعیت تأییدشده — ${daysSince(anchor)} روز بدون تسویه کامل`
          : `${ref}: Approved invoice unpaid for ${daysSince(anchor)} days`,
        detail: isFa
          ? `مانده ${remaining.toLocaleString('fa-IR')} ریال`
          : `Remaining ${remaining.toLocaleString('en-US')} Rial`,
        severity: 'danger',
      })
    }

    if (inv.status === 'under_review' && daysSince(inv.created_at) > UNDER_REVIEW_STALE_DAYS) {
      alerts.push({
        id: `review-${inv.id}`,
        kind: 'under_review_stale',
        title: isFa
          ? `${ref}: بیش از ${UNDER_REVIEW_STALE_DAYS} روز در حال بررسی`
          : `${ref}: Under review for over ${UNDER_REVIEW_STALE_DAYS} days`,
        detail: isFa ? 'پیگیری با کارفرما توصیه می‌شود' : 'Follow up with client recommended',
        severity: 'warning',
      })
    }
  }

  if (vendorOverdueCount > 0) {
    alerts.push({
      id: 'vendor-overdue',
      kind: 'vendor_overdue',
      title: isFa
        ? `${vendorOverdueCount} قبض تأمین‌کننده سررسید گذشته`
        : `${vendorOverdueCount} overdue vendor bill(s)`,
      detail: isFa ? 'پرداخت فوری یا تمدید سررسید' : 'Pay immediately or negotiate extension',
      severity: 'danger',
    })
  }

  return alerts
}

export function isInvoiceOverdue(inv: FinancialInvoiceRow): boolean {
  if (!inv.due_date) return false
  if (inv.status === 'paid') return false
  const due = new Date(inv.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today && inv.paid_amount < inv.approved_amount
}

export async function createFinancialInvoice(
  supabase: SupabaseClient,
  input: CreateInvoiceInput
): Promise<void> {
  const { error } = await supabase.from('financial_invoices').insert({
    project_id: input.projectId,
    invoice_no: input.invoiceNo.trim(),
    period_start: input.periodStart,
    period_end: input.periodEnd,
    invoice_date: input.invoiceDate ?? input.periodEnd,
    total_amount: input.amount,
    approved_amount: 0,
    paid_amount: 0,
    retention_held: 0,
    status: input.status,
    due_date: input.dueDate ?? null,
    created_by: input.createdBy ?? null,
  })

  if (error) throw new Error(error.message)
}

export async function updateInvoiceFinancial(
  supabase: SupabaseClient,
  input: UpdateInvoiceFinancialInput
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.status !== undefined) patch.status = input.status
  if (input.approvedAmount !== undefined) patch.approved_amount = input.approvedAmount
  if (input.paidAmount !== undefined) patch.paid_amount = input.paidAmount
  if (input.retentionHeld !== undefined) patch.retention_held = input.retentionHeld
  if (input.dueDate !== undefined) patch.due_date = input.dueDate || null

  if (input.status === 'paid' && input.paidAmount === undefined && input.approvedAmount !== undefined) {
    patch.paid_amount = input.approvedAmount
  }

  const { error } = await supabase.from('financial_invoices').update(patch).eq('id', input.id)
  if (error) throw new Error(error.message)
}

export async function recordInvoicePayment(
  supabase: SupabaseClient,
  input: RecordPaymentInput,
  currentPaid: number,
  approvedAmount: number
): Promise<void> {
  const newPaid = currentPaid + input.additionalPaid
  const status = newPaid >= approvedAmount && approvedAmount > 0 ? 'paid' : undefined

  const patch: Record<string, unknown> = { paid_amount: newPaid }
  if (status) patch.status = status

  const { error } = await supabase.from('financial_invoices').update(patch).eq('id', input.invoiceId)
  if (error) throw new Error(error.message)
}
