'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
AlertTriangle,
Camera,
Download,
FileSpreadsheet,
FileText,
Lock,
Loader2,
Plus,
Search,
Sparkles,
Upload,
X,
} from 'lucide-react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import {
PageHeader,
LoadingBlock,
ErrorBlock,
SectionCard,
EmptyState,
} from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { ModalOverlay } from '@/shared/components/common/modal-overlay'
import { ExpenseStatusBadge } from '@/features/finance/components/expense-status-badge'
import { SalesInvoiceView } from '@/features/finance/components/sales-invoice-view'
import {
MoneyInput,
parseMoneyInput,
formatMoneyFromNumber,
} from '@/features/finance/components/money-input'
import { formatRial } from '@/features/finance/lib/format-currency'
import {
ACCOUNTING_DOCUMENT_STATUSES,
isDocumentEditable,
isDocumentLocked,
type AccountingDocument,
type AccountingDocumentRevision,
type AccountingDocumentStatus,
type CreateExpenseItemInput,
type DuplicateMatch,
type ExpenseCategory,
type ExpenseImportRow,
} from '@/features/finance/lib/expense-types'
import {
buildExpenseCsv,
buildExpenseDocumentHtml,
downloadTextFile,
openPrintableHtml,
parseCsvText,
} from '@/features/finance/lib/expense-export'
import { findDuplicateMatches } from '@/features/finance/lib/expense-duplicates'
import {
FINANCIAL_COST_TYPES,
FINANCIAL_COST_TYPE_LABELS,
type FinancialCostType,
} from '@/features/finance/lib/types'
import { getExpenseMessages } from '@/shared/lib/i18n/expenses'
import { cn } from '@/shared/lib/utils'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import {
cancelExpenseDocument,
createCorrectionDocument,
createExpenseDocument,
detectExpenseDuplicates,
DuplicateExpenseError,
fetchDocumentRevisions,
fetchExpenseCategories,
fetchExpenseDocumentDetail,
fetchExpenseDocuments,
fetchUnmigratedLegacyCosts,
finalizeExpenseDocument,
migrateAllLegacyCosts,
reverseExpenseDocument,
submitExpenseDocument,
updateExpenseDocument,
uploadExpenseExport,
} from '@/features/finance/services/expenses'
import type { FinancialCost } from '@/features/finance/lib/types'
import { mapAiItemsToExpenseItems } from '@/features/finance/lib/expense-ai-types'
import {
analyzeExpenseDocumentImage,
uploadExpenseAttachment,
} from '@/features/finance/services/expense-ai'

interface ExpenseManagementProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  canEdit?: boolean
  /** Hide desktop chrome when shown inside the mobile accountant shell. */
  embedded?: boolean
}

type SortKey = 'document_date' | 'amount' | 'created_at' | 'status' | 'supplier_name'

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10)
}

const IMPORT_FIELDS = [
  'documentNo',
  'invoiceNo',
  'supplierName',
  'documentDate',
  'amount',
  'description',
  'costType',
  'skip',
] as const

type ImportField = (typeof IMPORT_FIELDS)[number]

export function ExpenseManagement({
  initialContext,
  projectOptions,
  initialProjectId,
  canEdit = false,
  embedded = false,
}: ExpenseManagementProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const { calendar } = useScheduleCalendar()
  const t = getExpenseMessages(locale)
  const isRtl = dir === 'rtl'
  const isFa = locale === 'fa' || locale === 'ar'
  const money = (n: number) => formatRial(n, isFa ? 'fa' : 'en')

  const projectId = useSyncedProjectId(initialProjectId)
  const [rows, setRows] = useState<AccountingDocument[]>([])
  const [legacyCosts, setLegacyCosts] = useState<FinancialCost[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<SortKey>('document_date')
  const [sortAsc, setSortAsc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState<AccountingDocumentStatus | 'all'>('all')
  const [filterCostType, setFilterCostType] = useState<FinancialCostType | 'all'>('all')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [editDoc, setEditDoc] = useState<AccountingDocument | null>(null)
  const [detailDoc, setDetailDoc] = useState<AccountingDocument | null>(null)
  const [revisions, setRevisions] = useState<AccountingDocumentRevision[]>([])
  const [reasonModal, setReasonModal] = useState<{
    kind: 'cancel' | 'reverse' | 'correction'
    doc: AccountingDocument
  } | null>(null)
  const [reasonText, setReasonText] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [forceDuplicate, setForceDuplicate] = useState(false)

  // Form fields
  const [formDocumentNo, setFormDocumentNo] = useState('')
  const [formInvoiceNo, setFormInvoiceNo] = useState('')
  const [formSupplier, setFormSupplier] = useState('')
  const [formDate, setFormDate] = useState(todayDateInputValue)
  const [formAmount, setFormAmount] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCostType, setFormCostType] = useState<FinancialCostType>('materials')
  const [formCategoryId, setFormCategoryId] = useState<string>('')
  const [formItems, setFormItems] = useState<CreateExpenseItemInput[]>([])

  // AI scan (photo → pre-fill → user confirms)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiPrefill, setAiPrefill] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importRawRows, setImportRawRows] = useState<string[][]>([])
  const [importMapping, setImportMapping] = useState<Record<number, ImportField>>({})
  const [importPreview, setImportPreview] = useState<ExpenseImportRow[]>([])
  const [existingForDup, setExistingForDup] = useState<AccountingDocument[]>([])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const activeProjectName =
    projectOptions.find((p) => p.id === projectId)?.name ?? null

  /** Live invoice preview from current form values (for AI / manual review before save). */
  const formInvoicePreview = useMemo((): AccountingDocument | null => {
    const amount = parseMoneyInput(formAmount) ?? 0
    const hasContent =
      formItems.length > 0 ||
      Boolean(formInvoiceNo.trim()) ||
      Boolean(formSupplier.trim()) ||
      Boolean(formDescription.trim()) ||
      amount > 0
    if (!hasContent) return null

    const now = new Date().toISOString()
    const items = formItems.map((item, idx) => {
      const qty =
        Number.isFinite(item.quantity) && (item.quantity ?? 0) > 0 ? Number(item.quantity) : 1
      const lineAmount = Number(item.amount) || 0
      const unitPrice =
        item.unitPrice != null && Number.isFinite(item.unitPrice)
          ? Number(item.unitPrice)
          : qty > 0
            ? lineAmount / qty
            : lineAmount
      return {
        id: `draft-${idx}`,
        document_id: editDoc?.id ?? 'draft',
        project_id: projectId ?? '',
        category_id: item.categoryId ?? (formCategoryId || null),
        line_no: item.lineNo ?? idx + 1,
        item_code: item.itemCode ?? null,
        description: item.description ?? '',
        quantity: qty,
        unit: item.unit ?? null,
        unit_price: unitPrice,
        amount: lineAmount,
        cost_type: item.costType ?? formCostType,
        created_at: now,
        updated_at: now,
      }
    })

    return {
      id: editDoc?.id ?? 'draft',
      project_id: projectId ?? '',
      category_id: formCategoryId || null,
      document_no: formDocumentNo.trim() || null,
      invoice_no: formInvoiceNo.trim() || null,
      supplier_name: formSupplier.trim() || null,
      document_date: formDate || todayDateInputValue(),
      amount,
      description: formDescription,
      cost_type: formCostType,
      status: editDoc?.status ?? 'draft',
      correction_of_document_id: editDoc?.correction_of_document_id ?? null,
      reversal_of_document_id: editDoc?.reversal_of_document_id ?? null,
      finalized_at: null,
      finalized_by: null,
      cancelled_at: null,
      cancelled_by: null,
      cancel_reason: null,
      reversed_at: null,
      reversed_by: null,
      reverse_reason: null,
      is_duplicate: false,
      duplicate_of_document_id: null,
      duplicate_reason: null,
      synced_cost_id: null,
      created_by: null,
      updated_by: null,
      created_at: now,
      updated_at: now,
      expense_items: items,
    }
  }, [
    formAmount,
    formItems,
    formInvoiceNo,
    formSupplier,
    formDescription,
    formDocumentNo,
    formDate,
    formCategoryId,
    formCostType,
    projectId,
    editDoc,
  ])

  useEffect(() => {
    setPage(1)
  }, [projectId])

  const loadData = useCallback(async () => {
    if (!projectId) {
      setRows([])
      setLegacyCosts([])
      setTotal(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [list, cats, legacy] = await Promise.all([
        fetchExpenseDocuments(
          supabase,
          {
            projectId,
            categoryId: filterCategory,
            status: filterStatus,
            costType: filterCostType,
            supplier: filterSupplier,
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
            search: filterSearch || undefined,
          },
          { page, pageSize, sortBy, sortAsc }
        ),
        fetchExpenseCategories(supabase, projectId),
        fetchUnmigratedLegacyCosts(supabase, projectId),
      ])
      setRows(list.rows)
      setTotal(list.total)
      setCategories(cats)
      setLegacyCosts(legacy)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [
    projectId,
    supabase,
    filterCategory,
    filterStatus,
    filterCostType,
    filterSupplier,
    filterDateFrom,
    filterDateTo,
    filterSearch,
    page,
    pageSize,
    sortBy,
    sortAsc,
    t.loadError,
  ])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(timer)
  }, [success])

  async function handleMigrateLegacy() {
    if (!projectId || !canEdit || legacyCosts.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const count = await migrateAllLegacyCosts(supabase, projectId, initialContext.userId)
      setSuccess(`${t.migrateSuccess} (${count})`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  function clearScan() {
    if (scanPreview) URL.revokeObjectURL(scanPreview)
    setScanFile(null)
    setScanPreview(null)
    setAiPrefill(false)
    setScanError(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  function resetForm() {
    setFormDocumentNo('')
    setFormInvoiceNo('')
    setFormSupplier('')
    setFormDate(todayDateInputValue())
    setFormAmount('')
    setFormDescription('')
    setFormCostType('materials')
    setFormCategoryId('')
    setFormItems([])
    setDuplicates([])
    setForceDuplicate(false)
    setEditDoc(null)
    clearScan()
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(doc: AccountingDocument) {
    if (!isDocumentEditable(doc.status)) return
    clearScan()
    setEditDoc(doc)
    setFormDocumentNo(doc.document_no ?? '')
    setFormInvoiceNo(doc.invoice_no ?? '')
    setFormSupplier(doc.supplier_name ?? '')
    setFormDate(doc.document_date)
    setFormAmount(formatMoneyFromNumber(doc.amount, locale))
    setFormDescription(doc.description)
    setFormCostType(doc.cost_type)
    setFormCategoryId(doc.category_id ?? '')
    setFormItems(
      (doc.expense_items ?? []).map((item) => ({
        categoryId: item.category_id,
        lineNo: item.line_no,
        itemCode: item.item_code ?? undefined,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit ?? undefined,
        unitPrice: item.unit_price,
        amount: item.amount,
        costType: item.cost_type,
      }))
    )
    setDuplicates([])
    setForceDuplicate(false)
    setShowForm(true)
    // Load line items if list row didn't include them
    if (!doc.expense_items?.length) {
      void fetchExpenseDocumentDetail(supabase, doc.id).then((detail) => {
        if (!detail?.expense_items?.length) return
        setFormItems(
          detail.expense_items.map((item) => ({
            categoryId: item.category_id,
            lineNo: item.line_no,
            itemCode: item.item_code ?? undefined,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit ?? undefined,
            unitPrice: item.unit_price,
            amount: item.amount,
            costType: item.cost_type,
          }))
        )
      })
    }
  }

  function handleScanFileSelected(file: File | null) {
    if (!file) return
    setScanError(null)
    setScanFile(file)
    if (scanPreview) URL.revokeObjectURL(scanPreview)
    setScanPreview(URL.createObjectURL(file))
    setAiPrefill(false)
    setFormItems([])
  }

  async function handleAnalyzeScan() {
    if (!scanFile) return
    setAnalyzing(true)
    setScanError(null)
    try {
      const extracted = await analyzeExpenseDocumentImage(supabase, scanFile)
      if (extracted.documentNo) setFormDocumentNo(extracted.documentNo)
      if (extracted.invoiceNo) setFormInvoiceNo(extracted.invoiceNo)
      if (extracted.supplierName) setFormSupplier(extracted.supplierName)
      if (extracted.documentDate) setFormDate(extracted.documentDate)
      if (extracted.amount != null && extracted.amount > 0) {
        setFormAmount(formatMoneyFromNumber(extracted.amount, locale))
      }
      if (extracted.description) setFormDescription(extracted.description)
      if (extracted.costType) setFormCostType(extracted.costType)
      if (extracted.items.length > 0) {
        const costType = extracted.costType ?? formCostType
        setFormItems(mapAiItemsToExpenseItems(extracted.items, costType))
        if (!extracted.description) {
          setFormDescription(
            extracted.items
              .slice(0, 5)
              .map((i) => i.description)
              .join('، ')
          )
        }
        if (extracted.amount == null) {
          const sum = extracted.items.reduce((acc, i) => acc + (i.amount ?? 0), 0)
          if (sum > 0) setFormAmount(formatMoneyFromNumber(sum, locale))
        }
      }
      setAiPrefill(true)
      setSuccess(t.analyzeSuccess)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : t.analyzeError)
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    return () => {
      if (scanPreview) URL.revokeObjectURL(scanPreview)
    }
  }, [scanPreview])

  async function openDetail(doc: AccountingDocument) {
    try {
      const [detail, revs] = await Promise.all([
        fetchExpenseDocumentDetail(supabase, doc.id),
        fetchDocumentRevisions(supabase, doc.id),
      ])
      setDetailDoc(detail)
      setRevisions(revs)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !canEdit) return
    const amount = parseMoneyInput(formAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t.amountRequired)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const dupCheck = await detectExpenseDuplicates(supabase, {
        projectId,
        documentNo: formDocumentNo,
        invoiceNo: formInvoiceNo,
        supplierName: formSupplier,
        documentDate: formDate,
        amount,
        costType: formCostType,
        excludeId: editDoc?.id,
      })
      setDuplicates(dupCheck)
      if (dupCheck.length > 0 && !forceDuplicate) {
        setSaving(false)
        return
      }

      if (editDoc) {
        await updateExpenseDocument(supabase, editDoc.id, {
          categoryId: formCategoryId || null,
          documentNo: formDocumentNo,
          invoiceNo: formInvoiceNo,
          supplierName: formSupplier,
          documentDate: formDate,
          amount,
          description: formDescription,
          costType: formCostType,
          updatedBy: initialContext.userId,
          items: formItems.length > 0 ? formItems : undefined,
        })
        if (scanFile) {
          try {
            await uploadExpenseAttachment(supabase, {
              projectId,
              documentId: editDoc.id,
              file: scanFile,
              createdBy: initialContext.userId,
            })
          } catch {
            // Attachment is best-effort; document already saved
          }
        }
      } else {
        const created = await createExpenseDocument(supabase, {
          projectId,
          categoryId: formCategoryId || null,
          documentNo: formDocumentNo,
          invoiceNo: formInvoiceNo,
          supplierName: formSupplier,
          documentDate: formDate,
          amount,
          description: formDescription,
          costType: formCostType,
          createdBy: initialContext.userId,
          allowDuplicate: forceDuplicate,
          items: formItems.length > 0 ? formItems : undefined,
        })
        if (scanFile && created?.id) {
          try {
            await uploadExpenseAttachment(supabase, {
              projectId,
              documentId: created.id,
              file: scanFile,
              createdBy: initialContext.userId,
            })
          } catch {
            // Attachment is best-effort; draft document already saved
          }
        }
      }

      setShowForm(false)
      resetForm()
      setSuccess(t.successSaved)
      await loadData()
    } catch (err) {
      if (err instanceof DuplicateExpenseError) {
        setDuplicates(err.duplicates)
      } else {
        setError(err instanceof Error ? err.message : t.saveError)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalize(doc: AccountingDocument) {
    if (!canEdit || !confirm(t.confirmFinalize)) return
    setSaving(true)
    setError(null)
    try {
      await finalizeExpenseDocument(supabase, doc.id, initialContext.userId)
      setSuccess(t.successFinalized)
      await loadData()
      if (detailDoc?.id === doc.id) await openDetail(doc)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(doc: AccountingDocument) {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    try {
      await submitExpenseDocument(supabase, doc.id, initialContext.userId)
      setSuccess(t.successSaved)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleReasonConfirm() {
    if (!reasonModal || !canEdit) return
    if (!reasonText.trim()) {
      setError(t.reasonRequired)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (reasonModal.kind === 'cancel') {
        await cancelExpenseDocument(
          supabase,
          reasonModal.doc.id,
          reasonText,
          initialContext.userId
        )
        setSuccess(t.successCancelled)
      } else if (reasonModal.kind === 'reverse') {
        await reverseExpenseDocument(
          supabase,
          reasonModal.doc.id,
          reasonText,
          initialContext.userId
        )
        setSuccess(t.successReversed)
      } else {
        const amount = parseMoneyInput(formAmount)
        await createCorrectionDocument(
          supabase,
          reasonModal.doc.id,
          {
            projectId: reasonModal.doc.project_id,
            documentDate: reasonModal.doc.document_date,
            amount: Number.isFinite(amount) && amount > 0 ? amount : reasonModal.doc.amount,
            description: formDescription || reasonModal.doc.description,
            costType: reasonModal.doc.cost_type,
            supplierName: reasonModal.doc.supplier_name ?? undefined,
            invoiceNo: reasonModal.doc.invoice_no ?? undefined,
          },
          initialContext.userId,
          reasonText
        )
        setSuccess(t.successCorrection)
      }
      setReasonModal(null)
      setReasonText('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleExportCsv() {
    if (!projectId) return
    const all = await fetchExpenseDocuments(
      supabase,
      {
        projectId,
        categoryId: filterCategory,
        status: filterStatus,
        costType: filterCostType,
        supplier: filterSupplier,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        search: filterSearch || undefined,
      },
      { page: 1, pageSize: 1000, sortBy, sortAsc }
    )
    const csv = buildExpenseCsv(all.rows, isFa ? 'fa' : 'en', calendar)
    const fileName = `expenses-${projectId.slice(0, 8)}.csv`
    downloadTextFile(fileName, csv, 'text/csv;charset=utf-8')
    try {
      await uploadExpenseExport(supabase, {
        projectId,
        fileName,
        content: csv,
        mime: 'text/csv',
        kind: 'export_csv',
        createdBy: initialContext.userId,
      })
    } catch {
      // Local download still succeeded; storage is best-effort
    }
  }

  async function handleExportPdf(doc: AccountingDocument) {
    const detail = (await fetchExpenseDocumentDetail(supabase, doc.id)) ?? doc
    const projectName =
      projectOptions.find((p) => p.id === (detail.project_id || projectId))?.name ?? null
    const html = buildExpenseDocumentHtml(detail, isFa ? 'fa' : 'en', calendar, {
      projectName,
    })
    openPrintableHtml(html)
    if (projectId) {
      try {
        await uploadExpenseExport(supabase, {
          projectId,
          documentId: doc.id,
          fileName: `${doc.document_no ?? doc.id.slice(0, 8)}.html`,
          content: html,
          mime: 'text/html',
          kind: 'export_pdf',
          createdBy: initialContext.userId,
        })
      } catch {
        // best-effort
      }
    }
  }

  function onImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      const text = String(reader.result ?? '')
      const parsed = parseCsvText(text)
      if (parsed.length < 2) {
        setError(t.saveError)
        return
      }
      const [headers, ...body] = parsed
      setImportHeaders(headers)
      setImportRawRows(body)
      const mapping: Record<number, ImportField> = {}
      headers.forEach((h, i) => {
        const key = h.toLowerCase()
        if (key.includes('document') || key.includes('سند')) mapping[i] = 'documentNo'
        else if (key.includes('invoice') || key.includes('فاکتور')) mapping[i] = 'invoiceNo'
        else if (key.includes('supplier') || key.includes('vendor') || key.includes('تأمین'))
          mapping[i] = 'supplierName'
        else if (key.includes('date') || key.includes('تاریخ')) mapping[i] = 'documentDate'
        else if (key.includes('amount') || key.includes('مبلغ')) mapping[i] = 'amount'
        else if (key.includes('desc') || key.includes('شرح')) mapping[i] = 'description'
        else if (key.includes('type') || key.includes('نوع')) mapping[i] = 'costType'
        else mapping[i] = 'skip'
      })
      setImportMapping(mapping)
      if (projectId) {
        const existing = await fetchExpenseDocuments(
          supabase,
          { projectId },
          { page: 1, pageSize: 500 }
        )
        setExistingForDup(existing.rows)
      }
      setShowImport(true)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function validateImport() {
    const preview: ExpenseImportRow[] = importRawRows.map((cells, idx) => {
      const get = (field: ImportField) => {
        const col = Object.entries(importMapping).find(([, f]) => f === field)?.[0]
        return col != null ? cells[Number(col)] : undefined
      }
      const errors: string[] = []
      const amount = Number(get('amount'))
      const documentDate = get('documentDate') || todayDateInputValue()
      const costTypeRaw = (get('costType') || 'materials').toLowerCase()
      const costType = (
        FINANCIAL_COST_TYPES.includes(costTypeRaw as FinancialCostType)
          ? costTypeRaw
          : 'materials'
      ) as FinancialCostType
      if (!Number.isFinite(amount) || amount <= 0) errors.push('مبلغ نامعتبر')
      if (!documentDate) errors.push('تاریخ وارد نشده')

      const candidate = {
        projectId: projectId!,
        documentNo: get('documentNo'),
        invoiceNo: get('invoiceNo'),
        supplierName: get('supplierName'),
        documentDate,
        amount: amount || 0,
        costType,
      }
      const dups = findDuplicateMatches(existingForDup, candidate)

      return {
        rowIndex: idx + 2,
        documentNo: get('documentNo'),
        invoiceNo: get('invoiceNo'),
        supplierName: get('supplierName'),
        documentDate,
        amount: amount || 0,
        description: get('description'),
        costType,
        errors,
        duplicate: dups[0] ?? null,
      }
    })
    setImportPreview(preview)
  }

  async function confirmImport() {
    if (!projectId || !canEdit) return
    const valid = importPreview.filter((r) => r.errors.length === 0)
    setSaving(true)
    setError(null)
    try {
      for (const row of valid) {
        await createExpenseDocument(supabase, {
          projectId,
          documentNo: row.documentNo,
          invoiceNo: row.invoiceNo,
          supplierName: row.supplierName,
          documentDate: row.documentDate || todayDateInputValue(),
          amount: row.amount || 0,
          description: row.description,
          costType: row.costType || 'materials',
          createdBy: initialContext.userId,
          allowDuplicate: Boolean(row.duplicate),
        })
      }
      setShowImport(false)
      setImportPreview([])
      setSuccess(t.successImported)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  const categoryLabel = useCallback(
    (cat: ExpenseCategory) => (isFa ? cat.name_fa : cat.name_en),
    [isFa]
  )

  const totalPagesLabel = useMemo(
    () => `${t.page} ${page} ${t.of} ${pageCount}`,
    [t.page, t.of, page, pageCount]
  )

  if (!projectId) {
    return (
      <div className={cn('space-y-6', !embedded && 'p-4 sm:p-6')} dir={dir}>
        {!embedded ? <PageHeader title={t.title} description={t.pageDescription} /> : null}
        <EmptyState title={t.noProject} description={t.noProject} />
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', !embedded && 'p-4 sm:p-6', embedded && 'space-y-4')} dir={dir}>
      <PageHeader
        title={t.title}
        description={embedded ? undefined : t.pageDescription}
        actions={
          <div className="flex flex-wrap gap-2">
            {!embedded ? (
              <>
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard/accountant">{t.backToDashboard}</Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/finance/payables">
                    {isFa ? 'بدهی پیمانکاران' : 'Contractor Payables'}
                  </Link>
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void handleExportCsv()}>
              <FileSpreadsheet className="h-4 w-4 me-1" />
              {t.exportCsv}
            </Button>
            <Button type="button" variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 me-1" />
                {t.importCsv}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onImportFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </Button>
            {canEdit ? (
              <Button type="button" onClick={openCreate}>
                <Plus className="h-4 w-4 me-1" />
                {t.addExpense}
              </Button>
            ) : null}
          </div>
        }
      />

      <p className="text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
        {t.statusHelp}
      </p>

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}
      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

      {legacyCosts.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2">
          <div className="flex items-start gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {t.legacyTitle} — {legacyCosts.length} {t.legacyCount}
          </div>
          <p className="text-amber-900/90">{t.legacyHint}</p>
          <ul className="text-xs space-y-1 max-h-28 overflow-y-auto ps-1">
            {legacyCosts.slice(0, 8).map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span className="truncate">
                  <FormattedDate value={c.date} /> · {FINANCIAL_COST_TYPE_LABELS[c.type]} ·{' '}
                  {c.description || '—'}
                </span>
                <span className="tabular-nums shrink-0">{money(Number(c.amount))}</span>
              </li>
            ))}
            {legacyCosts.length > 8 ? (
              <li className="text-muted-foreground">+{legacyCosts.length - 8}</li>
            ) : null}
          </ul>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void handleMigrateLegacy()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t.migrateLegacy}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Filters */}
      <SectionCard title={t.filters}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4">
          <div className="space-y-1.5">
            <Label>{t.category}</Label>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {categoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.status}</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v as AccountingDocumentStatus | 'all')
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                {ACCOUNTING_DOCUMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.costType}</Label>
            <Select
              value={filterCostType}
              onValueChange={(v) => {
                setFilterCostType(v as FinancialCostType | 'all')
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                {FINANCIAL_COST_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {FINANCIAL_COST_TYPE_LABELS[ct]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.supplier}</Label>
            <Input
              value={filterSupplier}
              onChange={(e) => {
                setFilterSupplier(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <ScheduleDateInput
              label={t.dateFrom}
              valueIso={filterDateFrom}
              onChangeIso={(iso) => {
                setFilterDateFrom(iso)
                setPage(1)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <ScheduleDateInput
              label={t.dateTo}
              valueIso={filterDateTo}
              onChangeIso={(iso) => {
                setFilterDateTo(iso)
                setPage(1)
              }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t.search}</Label>
            <div className="relative">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-9"
                placeholder={t.searchPlaceholder}
                value={filterSearch}
                onChange={(e) => {
                  setFilterSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.sortBy}</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document_date">{t.date}</SelectItem>
                <SelectItem value="amount">{t.amount}</SelectItem>
                <SelectItem value="supplier_name">{t.supplier}</SelectItem>
                <SelectItem value="status">{t.status}</SelectItem>
                <SelectItem value="created_at">{t.createdAt}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.rowsPerPage}</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Table */}
      <SectionCard title={t.tableTitle}>
        {loading ? (
          <LoadingBlock label={t.saving} />
        ) : rows.length === 0 ? (
          <EmptyState title={t.empty} description={t.statusHelp} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={cn('w-full text-sm', isRtl && 'text-right')}>
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3">{t.documentNo}</th>
                    <th className="py-2 px-3">{t.date}</th>
                    <th className="py-2 px-3">{t.supplier}</th>
                    <th className="py-2 px-3">{t.category}</th>
                    <th className="py-2 px-3 text-end">{t.amount}</th>
                    <th className="py-2 px-3">{t.status}</th>
                    <th className="py-2 px-3">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((doc) => {
                    const locked = isDocumentLocked(doc.status)
                    const cat = doc.expense_categories
                    return (
                      <tr key={doc.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-mono text-xs">
                          <div className="flex items-center gap-1">
                            {locked ? <Lock className="h-3 w-3 text-amber-600" /> : null}
                            {doc.document_no ?? doc.id.slice(0, 8)}
                            {doc.is_duplicate ? (
                              <span className="text-[10px] text-red-600">({t.duplicate})</span>
                            ) : null}
                          </div>
                          {doc.correction_of_document_id ? (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {t.correctionOf}: {doc.correction_of_document_id.slice(0, 8)}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <FormattedDate value={doc.document_date} />
                        </td>
                        <td className="py-2.5 px-3 max-w-[140px] truncate">
                          {doc.supplier_name || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {cat ? (isFa ? cat.name_fa : cat.name_en) : FINANCIAL_COST_TYPE_LABELS[doc.cost_type]}
                        </td>
                        <td className="py-2.5 px-3 text-end tabular-nums font-medium">
                          {money(doc.amount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <ExpenseStatusBadge status={doc.status} locale={locale} />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void openDetail(doc)}
                            >
                              {t.view}
                            </Button>
                            {canEdit && isDocumentEditable(doc.status) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(doc)}
                              >
                                {t.editDraft}
                              </Button>
                            ) : null}
                            {canEdit && doc.status === 'draft' ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void handleSubmit(doc)}
                                >
                                  {t.submit}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void handleFinalize(doc)}
                                >
                                  {t.finalize}
                                </Button>
                              </>
                            ) : null}
                            {canEdit && doc.status === 'submitted' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleFinalize(doc)}
                              >
                                {t.finalize}
                              </Button>
                            ) : null}
                            {canEdit &&
                            (doc.status === 'finalized' || doc.status === 'submitted') ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setReasonModal({ kind: 'correction', doc })
                                  setReasonText('')
                                  setFormAmount(formatMoneyFromNumber(doc.amount, locale))
                                  setFormDescription(doc.description)
                                }}
                              >
                                {t.createCorrection}
                              </Button>
                            ) : null}
                            {canEdit &&
                            doc.status !== 'cancelled' &&
                            doc.status !== 'reversed' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-red-700"
                                onClick={() => {
                                  setReasonModal({ kind: 'cancel', doc })
                                  setReasonText('')
                                }}
                              >
                                {t.cancelDoc}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleExportPdf(doc)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground">{totalPagesLabel}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  ›
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSortAsc((v) => !v)}
                >
                  {sortAsc ? '↑' : '↓'}
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* Create / Edit form */}
      <ModalOverlay
        open={showForm}
        onClose={() => {
          setShowForm(false)
          resetForm()
        }}
        title={editDoc ? t.formEditTitle : t.formTitle}
        className="sm:max-w-4xl"
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {/* AI scan: photo → pre-fill → user confirms */}
          {!editDoc ? (
            <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  {t.scanTitle}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t.scanHint}</p>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleScanFileSelected(e.target.files?.[0] ?? null)
                }}
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleScanFileSelected(e.target.files?.[0] ?? null)
                }}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 me-1" />
                  {t.takePhoto}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 me-1" />
                  {t.uploadPhoto}
                </Button>
                {scanFile ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={analyzing}
                      onClick={() => void handleAnalyzeScan()}
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin me-1" />
                      ) : (
                        <Sparkles className="h-4 w-4 me-1" />
                      )}
                      {analyzing ? t.analyzing : t.analyzeWithAi}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={clearScan}>
                      <X className="h-4 w-4 me-1" />
                      {t.clearScan}
                    </Button>
                  </>
                ) : null}
              </div>

              {scanPreview ? (
                <div className="relative overflow-hidden rounded-lg border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scanPreview}
                    alt="scan preview"
                    className="max-h-48 w-full object-contain"
                  />
                </div>
              ) : null}

              {scanError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
                  <p>{scanError}</p>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void handleAnalyzeScan()}
                  >
                    {isFa ? 'تلاش دوباره' : 'Try again'}
                  </button>
                </div>
              ) : null}

              {aiPrefill ? (
                <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  {t.aiDraftBadge}
                </p>
              ) : null}
            </div>
          ) : null}

          {formInvoicePreview ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t.invoicePreview}</p>
              <div className="max-h-[28rem] overflow-y-auto rounded-md">
                <SalesInvoiceView
                  doc={formInvoicePreview}
                  projectName={activeProjectName}
                  locale={isFa ? 'fa' : 'en'}
                  compact
                />
              </div>
            </div>
          ) : null}

          {duplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              <div className="flex items-start gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {t.duplicateWarning}
              </div>
              <ul className="list-disc ps-5 space-y-1">
                {duplicates.map((d) => (
                  <li key={`${d.rule}-${d.document.id}`}>
                    {isFa ? d.messageFa : d.message}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={forceDuplicate}
                  onChange={(e) => setForceDuplicate(e.target.checked)}
                />
                {t.duplicateForce}
              </label>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.documentNo}</Label>
              <Input value={formDocumentNo} onChange={(e) => setFormDocumentNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.invoiceNo}</Label>
              <Input value={formInvoiceNo} onChange={(e) => setFormInvoiceNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.supplier}</Label>
              <Input value={formSupplier} onChange={(e) => setFormSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <ScheduleDateInput
                label={t.date}
                valueIso={formDate}
                onChangeIso={setFormDate}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.amount}</Label>
              <MoneyInput
                value={formAmount}
                onChange={setFormAmount}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.costType}</Label>
              <Select
                value={formCostType}
                onValueChange={(v) => setFormCostType(v as FinancialCostType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_COST_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {FINANCIAL_COST_TYPE_LABELS[ct]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.category}</Label>
              <Select
                value={formCategoryId || 'none'}
                onValueChange={(v) => setFormCategoryId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.description}</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
            >
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t.saveDraft}
            </Button>
          </div>
        </form>
      </ModalOverlay>

      {/* Detail drawer/modal — classic sales invoice layout */}
      <ModalOverlay
        open={Boolean(detailDoc)}
        onClose={() => {
          setDetailDoc(null)
          setRevisions([])
        }}
        title={isFa ? 'فاکتور فروش' : t.detailTitle}
        className="sm:max-w-4xl"
      >
        {detailDoc ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ExpenseStatusBadge status={detailDoc.status} locale={locale} />
              {isDocumentLocked(detailDoc.status) ? (
                <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                  <Lock className="h-3.5 w-3.5" />
                  {t.locked}
                </span>
              ) : null}
              {detailDoc.document_no ? (
                <span className="text-xs text-muted-foreground font-mono">
                  {t.documentNo}: {detailDoc.document_no}
                </span>
              ) : null}
              {detailDoc.correction_of_document_id ? (
                <span className="text-xs text-muted-foreground">
                  {t.correctionOf}: {detailDoc.correction_of_document_id.slice(0, 8)}…
                </span>
              ) : null}
              {detailDoc.reversal_of_document_id ? (
                <span className="text-xs text-muted-foreground">
                  {t.reversalOf}: {detailDoc.reversal_of_document_id.slice(0, 8)}…
                </span>
              ) : null}
            </div>

            <SalesInvoiceView
              doc={detailDoc}
              projectName={
                projectOptions.find((p) => p.id === (detailDoc.project_id || projectId))
                  ?.name ?? null
              }
              locale={isFa ? 'fa' : 'en'}
              compact
            />

            <div>
              <h4 className="font-semibold mb-2">{t.auditHistory}</h4>
              {revisions.length === 0 ? (
                <p className="text-muted-foreground">{t.noRevisions}</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {revisions.map((rev) => (
                    <li key={rev.id} className="rounded border px-3 py-2 text-xs">
                      <div className="font-medium">
                        #{rev.revision_no} · {rev.action}
                        {rev.previous_status || rev.new_status
                          ? ` (${rev.previous_status ?? '—'} → ${rev.new_status ?? '—'})`
                          : ''}
                      </div>
                      {rev.reason ? (
                        <div className="text-muted-foreground mt-0.5">{rev.reason}</div>
                      ) : null}
                      <div className="text-muted-foreground mt-0.5">
                        <FormattedDate value={rev.created_at} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => void handleExportPdf(detailDoc)}>
                <FileText className="h-4 w-4 me-1" />
                {t.exportPdf}
              </Button>
              {canEdit && isDocumentEditable(detailDoc.status) ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    openEdit(detailDoc)
                    setDetailDoc(null)
                  }}
                >
                  {t.editDraft}
                </Button>
              ) : null}
              {canEdit &&
              (detailDoc.status === 'finalized' || detailDoc.status === 'corrected') ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReasonModal({ kind: 'reverse', doc: detailDoc })
                    setReasonText('')
                  }}
                >
                  {t.reverse}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </ModalOverlay>

      {/* Reason modal for cancel / reverse / correction */}
      <ModalOverlay
        open={Boolean(reasonModal)}
        onClose={() => setReasonModal(null)}
        title={
          reasonModal?.kind === 'cancel'
            ? t.cancelDoc
            : reasonModal?.kind === 'reverse'
              ? t.reverse
              : t.createCorrection
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.reason}</Label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
              required
            />
          </div>
          {reasonModal?.kind === 'correction' ? (
            <div className="space-y-1.5">
              <Label>{t.amount}</Label>
              <MoneyInput value={formAmount} onChange={setFormAmount} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReasonModal(null)}>
              {t.cancel}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleReasonConfirm()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {reasonModal?.kind === 'cancel'
                ? t.cancelDoc
                : reasonModal?.kind === 'reverse'
                  ? t.reverse
                  : t.createCorrection}
            </Button>
          </div>
        </div>
      </ModalOverlay>

      {/* Import modal */}
      <ModalOverlay open={showImport} onClose={() => setShowImport(false)} title={t.importTitle}>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">{t.importMapping}</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {importHeaders.map((h, i) => (
                <div key={`${h}-${i}`} className="flex items-center gap-2">
                  <span className="w-32 truncate text-muted-foreground">{h || `Col ${i + 1}`}</span>
                  <Select
                    value={importMapping[i] ?? 'skip'}
                    onValueChange={(v) =>
                      setImportMapping((m) => ({ ...m, [i]: v as ImportField }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORT_FIELDS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={validateImport}>
              {t.importValidate}
            </Button>
            <Button
              type="button"
              disabled={saving || importPreview.filter((r) => r.errors.length === 0).length === 0}
              onClick={() => void confirmImport()}
            >
              {t.importConfirm}
            </Button>
          </div>
          {importPreview.length > 0 ? (
            <div>
              <h4 className="font-semibold mb-2">{t.importPreview}</h4>
              <div className="max-h-56 overflow-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-2">#</th>
                      <th className="p-2">{t.amount}</th>
                      <th className="p-2">{t.supplier}</th>
                      <th className="p-2">{t.importErrors}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r) => (
                      <tr key={r.rowIndex} className="border-b">
                        <td className="p-2">{r.rowIndex}</td>
                        <td className="p-2">{r.amount}</td>
                        <td className="p-2">{r.supplierName || '—'}</td>
                        <td className="p-2">
                          {r.errors.length
                            ? r.errors.join('; ')
                            : r.duplicate
                              ? isFa
                                ? r.duplicate.messageFa
                                : r.duplicate.message
                              : 'OK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </ModalOverlay>
    </div>
  )
}
