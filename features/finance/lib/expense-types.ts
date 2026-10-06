import type { FinancialCostType } from '@/features/finance/lib/types'

/** Document lifecycle — finalized+ are locked for direct edits. */
export const ACCOUNTING_DOCUMENT_STATUSES = [
  'draft',
  'submitted',
  'finalized',
  'corrected',
  'cancelled',
  'reversed',
] as const

export type AccountingDocumentStatus = (typeof ACCOUNTING_DOCUMENT_STATUSES)[number]

export const EDITABLE_DOCUMENT_STATUSES: AccountingDocumentStatus[] = ['draft']

export const LOCKED_DOCUMENT_STATUSES: AccountingDocumentStatus[] = [
  'submitted',
  'finalized',
  'corrected',
  'cancelled',
  'reversed',
]

export type DocumentRevisionAction =
  | 'create'
  | 'update'
  | 'submit'
  | 'finalize'
  | 'correct'
  | 'cancel'
  | 'reverse'
  | 'mark_duplicate'
  | 'import'

export type DocumentFileKind =
  | 'attachment'
  | 'export_pdf'
  | 'export_csv'
  | 'export_excel'
  | 'import_source'

export interface ExpenseCategory {
  id: string
  project_id: string | null
  key: string
  name_fa: string
  name_en: string
  cost_type: FinancialCostType
  is_active: boolean
  sort_order: number
}

export interface AccountingDocument {
  id: string
  project_id: string
  category_id: string | null
  document_no: string | null
  invoice_no: string | null
  supplier_name: string | null
  document_date: string
  amount: number
  description: string
  cost_type: FinancialCostType
  status: AccountingDocumentStatus
  correction_of_document_id: string | null
  reversal_of_document_id: string | null
  finalized_at: string | null
  finalized_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  reversed_at: string | null
  reversed_by: string | null
  reverse_reason: string | null
  is_duplicate: boolean
  duplicate_of_document_id: string | null
  duplicate_reason: string | null
  synced_cost_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  /** Joined category (optional) */
  expense_categories?: Pick<ExpenseCategory, 'id' | 'key' | 'name_fa' | 'name_en' | 'cost_type'> | null
  /** Line items when loaded with detail */
  expense_items?: ExpenseItem[]
}

export interface ExpenseItem {
  id: string
  document_id: string
  project_id: string
  category_id: string | null
  line_no: number
  item_code: string | null
  description: string
  quantity: number
  unit: string | null
  unit_price: number
  amount: number
  cost_type: FinancialCostType
  created_at: string
  updated_at: string
}

export interface AccountingDocumentRevision {
  id: string
  document_id: string
  project_id: string
  revision_no: number
  action: DocumentRevisionAction
  previous_status: string | null
  new_status: string | null
  snapshot: Record<string, unknown>
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface DocumentFile {
  id: string
  project_id: string
  document_id: string | null
  file_name: string
  file_type: string
  file_size: number | null
  storage_path: string
  storage_bucket: string
  kind: DocumentFileKind
  created_by: string | null
  created_at: string
}

export interface CreateExpenseDocumentInput {
  projectId: string
  categoryId?: string | null
  documentNo?: string
  invoiceNo?: string
  supplierName?: string
  documentDate: string
  amount: number
  description?: string
  costType: FinancialCostType
  createdBy?: string
  items?: CreateExpenseItemInput[]
  /** Skip duplicate check (import with force) */
  allowDuplicate?: boolean
}

export interface CreateExpenseItemInput {
  categoryId?: string | null
  lineNo?: number
  itemCode?: string
  description?: string
  quantity?: number
  unit?: string
  unitPrice?: number
  amount: number
  costType?: FinancialCostType
}

export interface UpdateExpenseDocumentInput {
  categoryId?: string | null
  documentNo?: string
  invoiceNo?: string
  supplierName?: string
  documentDate?: string
  amount?: number
  description?: string
  costType?: FinancialCostType
  updatedBy?: string
  items?: CreateExpenseItemInput[]
}

export interface ExpenseFilters {
  categoryId?: string | 'all'
  costType?: FinancialCostType | 'all'
  status?: AccountingDocumentStatus | 'all'
  supplier?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  projectId: string
}

export interface DuplicateMatch {
  document: AccountingDocument
  rule:
    | 'invoice_supplier_amount_date'
    | 'document_no'
    | 'project_cost_type_date_amount'
  message: string
  messageFa: string
}

export interface ExpenseImportRow {
  rowIndex: number
  documentNo?: string
  invoiceNo?: string
  supplierName?: string
  documentDate?: string
  amount?: number
  description?: string
  costType?: FinancialCostType
  categoryKey?: string
  errors: string[]
  duplicate?: DuplicateMatch | null
}

export interface ExpenseListResult {
  rows: AccountingDocument[]
  total: number
  page: number
  pageSize: number
}

export function isDocumentEditable(status: AccountingDocumentStatus): boolean {
  return EDITABLE_DOCUMENT_STATUSES.includes(status)
}

export function isDocumentLocked(status: AccountingDocumentStatus): boolean {
  return LOCKED_DOCUMENT_STATUSES.includes(status)
}
