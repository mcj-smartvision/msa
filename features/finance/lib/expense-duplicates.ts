import type { AccountingDocument, DuplicateMatch } from '@/features/finance/lib/expense-types'

export interface DuplicateCandidateInput {
  projectId: string
  documentNo?: string | null
  invoiceNo?: string | null
  supplierName?: string | null
  documentDate: string
  amount: number
  costType: string
  /** Exclude self when updating / re-checking */
  excludeId?: string
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.005
}

/**
 * Client-side duplicate rules (also applied server-side before insert).
 * Rules:
 *  1) same invoice_no + supplier + amount + date
 *  2) same document_no (active docs)
 *  3) same project + cost_type + date + amount
 */
export function findDuplicateMatches(
  existing: AccountingDocument[],
  input: DuplicateCandidateInput
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = []
  const active = existing.filter(
    (d) =>
      d.id !== input.excludeId &&
      d.status !== 'cancelled' &&
      d.status !== 'reversed' &&
      !d.is_duplicate
  )

  const invoiceNo = norm(input.invoiceNo)
  const supplier = norm(input.supplierName)
  const documentNo = norm(input.documentNo)

  for (const doc of active) {
    if (
      invoiceNo &&
      supplier &&
      norm(doc.invoice_no) === invoiceNo &&
      norm(doc.supplier_name) === supplier &&
      amountsEqual(doc.amount, input.amount) &&
      doc.document_date === input.documentDate
    ) {
      matches.push({
        document: doc,
        rule: 'invoice_supplier_amount_date',
        message: `Possible duplicate: same invoice, supplier, amount and date as ${doc.document_no ?? doc.id.slice(0, 8)}`,
        messageFa: `احتمال تکراری: همان فاکتور، تأمین‌کننده، مبلغ و تاریخ با سند ${doc.document_no ?? doc.id.slice(0, 8)}`,
      })
      continue
    }

    if (documentNo && norm(doc.document_no) === documentNo) {
      matches.push({
        document: doc,
        rule: 'document_no',
        message: `Duplicate document number: ${doc.document_no}`,
        messageFa: `شماره سند تکراری: ${doc.document_no}`,
      })
      continue
    }

    if (
      doc.project_id === input.projectId &&
      doc.cost_type === input.costType &&
      doc.document_date === input.documentDate &&
      amountsEqual(doc.amount, input.amount)
    ) {
      matches.push({
        document: doc,
        rule: 'project_cost_type_date_amount',
        message: `Possible duplicate: same project, cost type, date and amount as ${doc.document_no ?? doc.id.slice(0, 8)}`,
        messageFa: `احتمال تکراری: همان پروژه، نوع هزینه، تاریخ و مبلغ با سند ${doc.document_no ?? doc.id.slice(0, 8)}`,
      })
    }
  }

  return matches
}
