import type { SupabaseClient } from '@supabase/supabase-js'
import { findDuplicateMatches } from '@/features/finance/lib/expense-duplicates'
import type {
AccountingDocument,
AccountingDocumentRevision,
AccountingDocumentStatus,
CreateExpenseDocumentInput,
CreateExpenseItemInput,
DocumentFile,
DuplicateMatch,
ExpenseCategory,
ExpenseFilters,
ExpenseItem,
ExpenseListResult,
UpdateExpenseDocumentInput,
} from '@/features/finance/lib/expense-types'
import { isDocumentEditable } from '@/features/finance/lib/expense-types'
import type { FinancialCost, FinancialCostType } from '@/features/finance/lib/types'
import { fetchFinancialCosts } from '@/features/finance/services/costs'
import { ensurePayableForFinalizedExpense } from '@/features/finance/services/payables'

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapDocument(row: Record<string, unknown>): AccountingDocument {
  return {
    ...(row as unknown as AccountingDocument),
    amount: toNumber(row.amount),
    is_duplicate: Boolean(row.is_duplicate),
  }
}

async function writeFinanceAudit(
  supabase: SupabaseClient,
  input: {
    userId?: string | null
    projectId: string
    action: string
    entityType: string
    entityId: string
    oldValues?: Record<string, unknown> | null
    newValues?: Record<string, unknown> | null
    reason?: string | null
  }
) {
  await supabase.from('finance_audit_logs').insert({
    user_id: input.userId ?? null,
    project_id: input.projectId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
    reason: input.reason ?? null,
  })
}

async function appendRevision(
  supabase: SupabaseClient,
  input: {
    documentId: string
    projectId: string
    action: string
    previousStatus?: string | null
    newStatus?: string | null
    snapshot: Record<string, unknown>
    reason?: string | null
    createdBy?: string | null
  }
) {
  const { data: last } = await supabase
    .from('accounting_document_revisions')
    .select('revision_no')
    .eq('document_id', input.documentId)
    .order('revision_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  const revisionNo = (last?.revision_no ?? 0) + 1
  await supabase.from('accounting_document_revisions').insert({
    document_id: input.documentId,
    project_id: input.projectId,
    revision_no: revisionNo,
    action: input.action,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
    snapshot: input.snapshot,
    reason: input.reason ?? null,
    created_by: input.createdBy ?? null,
  })
}

export async function fetchExpenseCategories(
  supabase: SupabaseClient,
  projectId?: string | null
): Promise<ExpenseCategory[]> {
  let query = supabase
    .from('expense_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Global + project-specific
  if (projectId) {
    query = query.or(`project_id.is.null,project_id.eq.${projectId}`)
  } else {
    query = query.is('project_id', null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as ExpenseCategory[]
}

export async function detectExpenseDuplicates(
  supabase: SupabaseClient,
  input: {
    projectId: string
    documentNo?: string | null
    invoiceNo?: string | null
    supplierName?: string | null
    documentDate: string
    amount: number
    costType: string
    excludeId?: string
  }
): Promise<DuplicateMatch[]> {
  const { data, error } = await supabase
    .from('accounting_documents')
    .select('*')
    .eq('project_id', input.projectId)
    .not('status', 'in', '("cancelled","reversed")')
    .limit(500)

  if (error) throw new Error(error.message)
  const docs = (data ?? []).map((r) => mapDocument(r as Record<string, unknown>))
  return findDuplicateMatches(docs, input)
}

export async function fetchExpenseDocuments(
  supabase: SupabaseClient,
  filters: ExpenseFilters,
  options?: {
    page?: number
    pageSize?: number
    sortBy?: 'document_date' | 'amount' | 'created_at' | 'status' | 'supplier_name'
    sortAsc?: boolean
  }
): Promise<ExpenseListResult> {
  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, options?.pageSize ?? 10))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortBy = options?.sortBy ?? 'document_date'
  const sortAsc = options?.sortAsc ?? false

  let query = supabase
    .from('accounting_documents')
    .select('*, expense_categories(id, key, name_fa, name_en, cost_type)', { count: 'exact' })
    .eq('project_id', filters.projectId)
    .order(sortBy, { ascending: sortAsc })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.categoryId && filters.categoryId !== 'all') {
    query = query.eq('category_id', filters.categoryId)
  }
  if (filters.costType && filters.costType !== 'all') {
    query = query.eq('cost_type', filters.costType)
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters.supplier?.trim()) {
    query = query.ilike('supplier_name', `%${filters.supplier.trim()}%`)
  }
  if (filters.dateFrom) query = query.gte('document_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('document_date', filters.dateTo)
  if (filters.search?.trim()) {
    const q = filters.search.trim()
    query = query.or(
      `description.ilike.%${q}%,document_no.ilike.%${q}%,invoice_no.ilike.%${q}%,supplier_name.ilike.%${q}%`
    )
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    rows: (data ?? []).map((r) => mapDocument(r as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize,
  }
}

export async function fetchExpenseDocumentDetail(
  supabase: SupabaseClient,
  documentId: string
): Promise<AccountingDocument | null> {
  const { data, error } = await supabase
    .from('accounting_documents')
    .select(
      '*, expense_categories(id, key, name_fa, name_en, cost_type), expense_items(*)'
    )
    .eq('id', documentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const doc = mapDocument(data as Record<string, unknown>)
  if (Array.isArray(data.expense_items)) {
    doc.expense_items = (data.expense_items as ExpenseItem[]).map((item) => ({
      ...item,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      amount: toNumber(item.amount),
    }))
  }
  return doc
}

async function insertItems(
  supabase: SupabaseClient,
  documentId: string,
  projectId: string,
  items: CreateExpenseItemInput[],
  fallbackCostType: FinancialCostType
) {
  if (items.length === 0) return
  const payload = items.map((item, idx) => ({
    document_id: documentId,
    project_id: projectId,
    category_id: item.categoryId ?? null,
    line_no: item.lineNo ?? idx + 1,
    item_code: item.itemCode?.trim() || null,
    description: item.description?.trim() || '',
    quantity: item.quantity ?? 1,
    unit: item.unit?.trim() || null,
    unit_price: item.unitPrice ?? item.amount,
    amount: item.amount,
    cost_type: item.costType ?? fallbackCostType,
  }))
  const { error } = await supabase.from('expense_items').insert(payload)
  if (error) throw new Error(error.message)
}

export class DuplicateExpenseError extends Error {
  duplicates: DuplicateMatch[]
  constructor(duplicates: DuplicateMatch[]) {
    super('DUPLICATE_DETECTED')
    this.name = 'DuplicateExpenseError'
    this.duplicates = duplicates
  }
}

export async function createExpenseDocument(
  supabase: SupabaseClient,
  input: CreateExpenseDocumentInput
): Promise<AccountingDocument> {
  const duplicates = await detectExpenseDuplicates(supabase, {
    projectId: input.projectId,
    documentNo: input.documentNo,
    invoiceNo: input.invoiceNo,
    supplierName: input.supplierName,
    documentDate: input.documentDate,
    amount: input.amount,
    costType: input.costType,
  })

  if (duplicates.length > 0 && !input.allowDuplicate) {
    // Caller must show duplicate warning UI; nothing was inserted.
    throw new DuplicateExpenseError(duplicates)
  }

  const { data, error } = await supabase
    .from('accounting_documents')
    .insert({
      project_id: input.projectId,
      category_id: input.categoryId ?? null,
      document_no: input.documentNo?.trim() || null,
      invoice_no: input.invoiceNo?.trim() || null,
      supplier_name: input.supplierName?.trim() || null,
      document_date: input.documentDate,
      amount: input.amount,
      description: input.description?.trim() || '',
      cost_type: input.costType,
      status: 'draft',
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
      is_duplicate: duplicates.length > 0,
      duplicate_of_document_id: duplicates[0]?.document.id ?? null,
      duplicate_reason: duplicates[0]?.message ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const document = mapDocument(data as Record<string, unknown>)

  if (input.items?.length) {
    await insertItems(supabase, document.id, input.projectId, input.items, input.costType)
  }

  await appendRevision(supabase, {
    documentId: document.id,
    projectId: input.projectId,
    action: 'create',
    previousStatus: null,
    newStatus: 'draft',
    snapshot: document as unknown as Record<string, unknown>,
    createdBy: input.createdBy,
  })

  await writeFinanceAudit(supabase, {
    userId: input.createdBy,
    projectId: input.projectId,
    action: 'create',
    entityType: 'accounting_document',
    entityId: document.id,
    newValues: document as unknown as Record<string, unknown>,
  })

  return document
}

export async function updateExpenseDocument(
  supabase: SupabaseClient,
  documentId: string,
  patch: UpdateExpenseDocumentInput
): Promise<AccountingDocument> {
  const existing = await fetchExpenseDocumentDetail(supabase, documentId)
  if (!existing) throw new Error('Document not found')
  // Financial constraint: only draft documents may be edited directly
  if (!isDocumentEditable(existing.status)) {
    throw new Error(
      `Document is locked (status=${existing.status}). Use correction, reversal, or cancellation.`
    )
  }

  const payload: Record<string, unknown> = {
    updated_by: patch.updatedBy ?? null,
  }
  if (patch.categoryId !== undefined) payload.category_id = patch.categoryId
  if (patch.documentNo !== undefined) payload.document_no = patch.documentNo.trim() || null
  if (patch.invoiceNo !== undefined) payload.invoice_no = patch.invoiceNo.trim() || null
  if (patch.supplierName !== undefined) payload.supplier_name = patch.supplierName.trim() || null
  if (patch.documentDate !== undefined) payload.document_date = patch.documentDate
  if (patch.amount !== undefined) payload.amount = patch.amount
  if (patch.description !== undefined) payload.description = patch.description.trim()
  if (patch.costType !== undefined) payload.cost_type = patch.costType

  const { data, error } = await supabase
    .from('accounting_documents')
    .update(payload)
    .eq('id', documentId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const document = mapDocument(data as Record<string, unknown>)

  if (patch.items) {
    await supabase.from('expense_items').delete().eq('document_id', documentId)
    await insertItems(
      supabase,
      documentId,
      existing.project_id,
      patch.items,
      (patch.costType ?? existing.cost_type) as FinancialCostType
    )
  }

  await appendRevision(supabase, {
    documentId,
    projectId: existing.project_id,
    action: 'update',
    previousStatus: existing.status,
    newStatus: existing.status,
    snapshot: document as unknown as Record<string, unknown>,
    createdBy: patch.updatedBy,
  })

  await writeFinanceAudit(supabase, {
    userId: patch.updatedBy,
    projectId: existing.project_id,
    action: 'update',
    entityType: 'accounting_document',
    entityId: documentId,
    oldValues: existing as unknown as Record<string, unknown>,
    newValues: document as unknown as Record<string, unknown>,
  })

  return document
}

async function transitionStatus(
  supabase: SupabaseClient,
  documentId: string,
  nextStatus: AccountingDocumentStatus,
  action: string,
  userId?: string | null,
  reason?: string | null,
  extra?: Record<string, unknown>
): Promise<AccountingDocument> {
  const existing = await fetchExpenseDocumentDetail(supabase, documentId)
  if (!existing) throw new Error('Document not found')

  const payload: Record<string, unknown> = {
    status: nextStatus,
    updated_by: userId ?? null,
    ...(extra ?? {}),
  }

  const { data, error } = await supabase
    .from('accounting_documents')
    .update(payload)
    .eq('id', documentId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const document = mapDocument(data as Record<string, unknown>)

  await appendRevision(supabase, {
    documentId,
    projectId: existing.project_id,
    action,
    previousStatus: existing.status,
    newStatus: nextStatus,
    snapshot: document as unknown as Record<string, unknown>,
    reason,
    createdBy: userId,
  })

  await writeFinanceAudit(supabase, {
    userId,
    projectId: existing.project_id,
    action,
    entityType: 'accounting_document',
    entityId: documentId,
    oldValues: { status: existing.status },
    newValues: { status: nextStatus, ...(extra ?? {}) },
    reason,
  })

  return document
}

export async function submitExpenseDocument(
  supabase: SupabaseClient,
  documentId: string,
  userId?: string | null
): Promise<AccountingDocument> {
  const existing = await fetchExpenseDocumentDetail(supabase, documentId)
  if (!existing) throw new Error('Document not found')
  if (existing.status !== 'draft') {
    throw new Error('Only draft documents can be submitted')
  }
  return transitionStatus(supabase, documentId, 'submitted', 'submit', userId)
}

/**
 * Finalize locks the document. Syncs a financial_costs row for dashboard AC KPI.
 * After finalize, direct edits are blocked by DB trigger + app checks.
 */
export async function finalizeExpenseDocument(
  supabase: SupabaseClient,
  documentId: string,
  userId?: string | null
): Promise<AccountingDocument> {
  const existing = await fetchExpenseDocumentDetail(supabase, documentId)
  if (!existing) throw new Error('Document not found')
  if (existing.status !== 'draft' && existing.status !== 'submitted') {
    throw new Error('Only draft or submitted documents can be finalized')
  }

  // Reversal documents must not create a second positive AC line
  let syncedCostId = existing.synced_cost_id
  if (!syncedCostId && !existing.reversal_of_document_id) {
    // If this is a correction, retire the original's AC line first
    if (existing.correction_of_document_id) {
      const original = await fetchExpenseDocumentDetail(
        supabase,
        existing.correction_of_document_id
      )
      if (original?.synced_cost_id) {
        await supabase.from('financial_costs').delete().eq('id', original.synced_cost_id)
        await supabase
          .from('accounting_documents')
          .update({ synced_cost_id: null, updated_by: userId ?? null })
          .eq('id', original.id)
      }
    }

    const { data: cost, error: costError } = await supabase
      .from('financial_costs')
      .insert({
        project_id: existing.project_id,
        date: existing.document_date,
        type: existing.cost_type,
        description: existing.description || existing.document_no || 'Expense document',
        amount: existing.amount,
        invoice_reference: existing.invoice_no ?? existing.document_no,
        created_by: userId ?? null,
      })
      .select('id')
      .single()
    if (costError) throw new Error(costError.message)
    syncedCostId = cost.id
  }

  const finalized = await transitionStatus(
    supabase,
    documentId,
    'finalized',
    'finalize',
    userId,
    null,
    {
      finalized_at: new Date().toISOString(),
      finalized_by: userId ?? null,
      synced_cost_id: syncedCostId,
    }
  )

  // Expense ≠ payment: subcontractor costs create an open payable until cash is paid
  if (
    !existing.reversal_of_document_id &&
    (existing.cost_type === 'subcontractor' || Boolean(existing.supplier_name?.trim()))
  ) {
    try {
      await ensurePayableForFinalizedExpense(supabase, {
        projectId: existing.project_id,
        documentId: existing.id,
        contractorName: existing.supplier_name?.trim() || 'پیمانکار / تأمین‌کننده',
        amount: existing.amount,
        billDate: existing.document_date,
        description: existing.description || existing.document_no || undefined,
        createdBy: userId,
      })
    } catch {
      // Payable creation is best-effort; expense finalize must not fail
    }
  }

  return finalized
}

/** Soft-cancel — never hard-delete finalized documents. */
export async function cancelExpenseDocument(
  supabase: SupabaseClient,
  documentId: string,
  reason: string,
  userId?: string | null
): Promise<AccountingDocument> {
  const existing = await fetchExpenseDocumentDetail(supabase, documentId)
  if (!existing) throw new Error('Document not found')
  if (existing.status === 'cancelled' || existing.status === 'reversed') {
    throw new Error('Document already cancelled/reversed')
  }
  if (!reason.trim()) throw new Error('Cancel reason is required')

  if (existing.synced_cost_id) {
    await supabase.from('financial_costs').delete().eq('id', existing.synced_cost_id)
  }

  return transitionStatus(supabase, documentId, 'cancelled', 'cancel', userId, reason, {
    cancelled_at: new Date().toISOString(),
    cancelled_by: userId ?? null,
    cancel_reason: reason.trim(),
    synced_cost_id: null,
  })
}

/**
 * Create a linked correction document (new draft) and mark original as corrected.
 * Original remains immutable; correction carries correction_of_document_id.
 */
export async function createCorrectionDocument(
  supabase: SupabaseClient,
  originalId: string,
  input: Omit<CreateExpenseDocumentInput, 'projectId'> & { projectId?: string },
  userId?: string | null,
  reason?: string | null
): Promise<AccountingDocument> {
  const original = await fetchExpenseDocumentDetail(supabase, originalId)
  if (!original) throw new Error('Original document not found')
  if (original.status !== 'finalized' && original.status !== 'submitted') {
    throw new Error('Only submitted/finalized documents can be corrected')
  }

  const { data, error } = await supabase
    .from('accounting_documents')
    .insert({
      project_id: original.project_id,
      category_id: input.categoryId ?? original.category_id,
      document_no: input.documentNo?.trim() || `${original.document_no ?? 'DOC'}-COR`,
      invoice_no: input.invoiceNo?.trim() || original.invoice_no,
      supplier_name: input.supplierName?.trim() || original.supplier_name,
      document_date: input.documentDate || original.document_date,
      amount: input.amount,
      description: input.description?.trim() || original.description,
      cost_type: input.costType || original.cost_type,
      status: 'draft',
      correction_of_document_id: original.id,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const correction = mapDocument(data as Record<string, unknown>)

  if (input.items?.length) {
    await insertItems(
      supabase,
      correction.id,
      original.project_id,
      input.items,
      correction.cost_type
    )
  }

  // Original AC line is superseded by the correction once the correction is finalized.
  // Keep original synced_cost until correction finalize; mark status only here.
  await transitionStatus(
    supabase,
    original.id,
    'corrected',
    'correct',
    userId,
    reason ?? 'Correction document created'
  )

  await appendRevision(supabase, {
    documentId: correction.id,
    projectId: original.project_id,
    action: 'create',
    previousStatus: null,
    newStatus: 'draft',
    snapshot: {
      ...(correction as unknown as Record<string, unknown>),
      correction_of: original.id,
    },
    reason,
    createdBy: userId,
  })

  return correction
}

/** Create a reversal document and mark original as reversed. */
export async function reverseExpenseDocument(
  supabase: SupabaseClient,
  originalId: string,
  reason: string,
  userId?: string | null
): Promise<AccountingDocument> {
  const original = await fetchExpenseDocumentDetail(supabase, originalId)
  if (!original) throw new Error('Original document not found')
  if (original.status !== 'finalized' && original.status !== 'corrected') {
    throw new Error('Only finalized/corrected documents can be reversed')
  }
  if (!reason.trim()) throw new Error('Reversal reason is required')

  const { data, error } = await supabase
    .from('accounting_documents')
    .insert({
      project_id: original.project_id,
      category_id: original.category_id,
      document_no: `${original.document_no ?? 'DOC'}-REV`,
      invoice_no: original.invoice_no,
      supplier_name: original.supplier_name,
      document_date: original.document_date,
      amount: original.amount,
      description: `REVERSAL: ${original.description}`,
      cost_type: original.cost_type,
      status: 'draft',
      reversal_of_document_id: original.id,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const reversal = mapDocument(data as Record<string, unknown>)

  // Remove original AC sync so dashboard totals stay correct (soft status on document)
  if (original.synced_cost_id) {
    await supabase.from('financial_costs').delete().eq('id', original.synced_cost_id)
  }

  await transitionStatus(supabase, original.id, 'reversed', 'reverse', userId, reason, {
    reversed_at: new Date().toISOString(),
    reversed_by: userId ?? null,
    reverse_reason: reason.trim(),
    synced_cost_id: null,
  })

  // Finalize reversal as locked audit record (no second AC line)
  await finalizeExpenseDocument(supabase, reversal.id, userId)

  return (await fetchExpenseDocumentDetail(supabase, reversal.id)) as AccountingDocument
}

/** Soft-cancel a duplicate after insertion — never hard-delete. */
export async function markDocumentAsDuplicate(
  supabase: SupabaseClient,
  documentId: string,
  duplicateOfId: string,
  reason: string,
  userId?: string | null
): Promise<AccountingDocument> {
  return transitionStatus(supabase, documentId, 'cancelled', 'mark_duplicate', userId, reason, {
    is_duplicate: true,
    duplicate_of_document_id: duplicateOfId,
    duplicate_reason: reason,
    cancelled_at: new Date().toISOString(),
    cancelled_by: userId ?? null,
    cancel_reason: reason,
  })
}

export async function fetchDocumentRevisions(
  supabase: SupabaseClient,
  documentId: string
): Promise<AccountingDocumentRevision[]> {
  const { data, error } = await supabase
    .from('accounting_document_revisions')
    .select('*')
    .eq('document_id', documentId)
    .order('revision_no', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AccountingDocumentRevision[]
}

export async function registerDocumentFile(
  supabase: SupabaseClient,
  input: {
    projectId: string
    documentId?: string | null
    fileName: string
    fileType: string
    fileSize?: number
    storagePath: string
    kind: DocumentFile['kind']
    createdBy?: string | null
  }
): Promise<DocumentFile> {
  const { data, error } = await supabase
    .from('document_files')
    .insert({
      project_id: input.projectId,
      document_id: input.documentId ?? null,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize ?? null,
      storage_path: input.storagePath,
      storage_bucket: 'accounting-documents',
      kind: input.kind,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as DocumentFile
}

export async function uploadExpenseExport(
  supabase: SupabaseClient,
  input: {
    projectId: string
    documentId?: string | null
    fileName: string
    content: string | Blob
    mime: string
    kind: DocumentFile['kind']
    createdBy?: string | null
  }
): Promise<DocumentFile> {
  const path = `${input.projectId}/${Date.now()}-${input.fileName}`
  const blob =
    typeof input.content === 'string'
      ? new Blob([input.content], { type: input.mime })
      : input.content

  const { error: uploadError } = await supabase.storage
    .from('accounting-documents')
    .upload(path, blob, { contentType: input.mime, upsert: false })

  if (uploadError) throw new Error(uploadError.message)

  return registerDocumentFile(supabase, {
    projectId: input.projectId,
    documentId: input.documentId,
    fileName: input.fileName,
    fileType: input.mime,
    fileSize: blob.size,
    storagePath: path,
    kind: input.kind,
    createdBy: input.createdBy,
  })
}

export function buildExpenseSummary(docs: AccountingDocument[]) {
  let total = 0
  let draft = 0
  let finalized = 0
  let cancelled = 0
  for (const d of docs) {
    if (d.status === 'cancelled' || d.status === 'reversed') {
      cancelled += 1
      continue
    }
    total += toNumber(d.amount)
    if (d.status === 'draft') draft += 1
    if (d.status === 'finalized') finalized += 1
  }
  return { total, draft, finalized, cancelled, count: docs.length }
}

/**
 * Legacy costs entered via the old accountant "Register Cost" modal
 * live in `financial_costs` and are not yet accounting_documents.
 * Returns rows that have not been linked via synced_cost_id.
 */
export async function fetchUnmigratedLegacyCosts(
  supabase: SupabaseClient,
  projectId: string
): Promise<FinancialCost[]> {
  const [costs, docs] = await Promise.all([
    fetchFinancialCosts(supabase, projectId),
    supabase
      .from('accounting_documents')
      .select('synced_cost_id')
      .eq('project_id', projectId)
      .not('synced_cost_id', 'is', null),
  ])

  if (docs.error) throw new Error(docs.error.message)
  const linked = new Set(
    (docs.data ?? []).map((r) => r.synced_cost_id as string).filter(Boolean)
  )
  return costs.filter((c) => !linked.has(c.id))
}

/** One-time import: convert a legacy financial_costs row into a finalized accounting document. */
export async function migrateLegacyCostToDocument(
  supabase: SupabaseClient,
  cost: FinancialCost,
  userId?: string | null
): Promise<AccountingDocument> {
  // Unique document_no per migration row (invoice_reference alone may collide)
  const documentNo = `LEGACY-${cost.id.slice(0, 8)}`

  const { data, error } = await supabase
    .from('accounting_documents')
    .insert({
      project_id: cost.project_id,
      document_no: documentNo,
      invoice_no: cost.invoice_reference,
      supplier_name: null,
      document_date: cost.date,
      amount: cost.amount,
      description: cost.description || '',
      cost_type: cost.type,
      status: 'finalized',
      finalized_at: new Date().toISOString(),
      finalized_by: userId ?? null,
      synced_cost_id: cost.id,
      created_by: userId ?? cost.created_by,
      updated_by: userId ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const document = mapDocument(data as Record<string, unknown>)

  await appendRevision(supabase, {
    documentId: document.id,
    projectId: cost.project_id,
    action: 'import',
    previousStatus: null,
    newStatus: 'finalized',
    snapshot: document as unknown as Record<string, unknown>,
    reason: 'Migrated from legacy financial_costs',
    createdBy: userId,
  })

  await writeFinanceAudit(supabase, {
    userId,
    projectId: cost.project_id,
    action: 'migrate_legacy_cost',
    entityType: 'accounting_document',
    entityId: document.id,
    newValues: { legacy_cost_id: cost.id },
    reason: 'Migrated from legacy financial_costs',
  })

  return document
}

export async function migrateAllLegacyCosts(
  supabase: SupabaseClient,
  projectId: string,
  userId?: string | null
): Promise<number> {
  const legacy = await fetchUnmigratedLegacyCosts(supabase, projectId)
  for (const cost of legacy) {
    await migrateLegacyCostToDocument(supabase, cost, userId)
  }
  return legacy.length
}
