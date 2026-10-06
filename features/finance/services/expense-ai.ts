import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExpenseAiExtraction } from '@/features/finance/lib/expense-ai-types'
import { FINANCIAL_COST_TYPES, type FinancialCostType } from '@/features/finance/lib/types'
import { registerDocumentFile } from '@/features/finance/services/expenses'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeExtraction(raw: Record<string, unknown>): ExpenseAiExtraction {
  const costTypeRaw = String(raw.costType ?? '').toLowerCase().trim()
  const costType = FINANCIAL_COST_TYPES.includes(costTypeRaw as FinancialCostType)
    ? (costTypeRaw as FinancialCostType)
    : null

  const itemsRaw = Array.isArray(raw.items) ? raw.items : []
  const items = itemsRaw
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        description: String(r.description ?? r.name ?? '').trim(),
        quantity: toNum(r.quantity) ?? 1,
        unit: r.unit != null ? String(r.unit).trim() || null : null,
        unitPrice: toNum(r.unitPrice ?? r.unit_price),
        amount: toNum(r.amount),
      }
    })
    .filter((row) => row.description.length > 0)

  return {
    invoiceNo: raw.invoiceNo != null ? String(raw.invoiceNo).trim() || null : null,
    documentNo: raw.documentNo != null ? String(raw.documentNo).trim() || null : null,
    supplierName: raw.supplierName != null ? String(raw.supplierName).trim() || null : null,
    documentDate: raw.documentDate != null ? String(raw.documentDate).trim() || null : null,
    amount: toNum(raw.amount),
    description: raw.description != null ? String(raw.description).trim() || null : null,
    costType,
    items,
  }
}

/**
 * Analyze expense invoice photo via Next.js API (uses OPENAI_API_KEY from .env.local).
 * Falls back to Supabase Edge Function if the API route is unavailable.
 */
export async function analyzeExpenseDocumentImage(
  _supabase: SupabaseClient,
  file: File
): Promise<ExpenseAiExtraction> {
  const base64 = await fileToBase64(file)

  // Primary path: Next.js API — works without deploying Edge Functions
  const res = await fetch('/api/finance/analyze-expense', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 }),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Fallback: Edge Function (if deployed)
    if (res.status === 404 || res.status >= 500) {
      try {
        const { data, error } = await _supabase.functions.invoke('analyze-expense-document', {
          body: { imageBase64: base64 },
        })
        if (!error && data && !data.error) {
          return normalizeExtraction(data as Record<string, unknown>)
        }
      } catch {
        // ignore and surface original API error
      }
    }
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : 'تحلیل فاکتور ناموفق بود. دوباره تلاش کنید.'
    )
  }

  return normalizeExtraction(payload as Record<string, unknown>)
}

/** Upload invoice/receipt photo and link it to an accounting document. */
export async function uploadExpenseAttachment(
  supabase: SupabaseClient,
  input: {
    projectId: string
    documentId: string
    file: File
    createdBy?: string | null
  }
) {
  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${input.projectId}/attachments/${input.documentId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('accounting-documents')
    .upload(path, input.file, {
      contentType: input.file.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) throw new Error(uploadError.message)

  return registerDocumentFile(supabase, {
    projectId: input.projectId,
    documentId: input.documentId,
    fileName: input.file.name || `expense.${ext}`,
    fileType: input.file.type || 'image/jpeg',
    fileSize: input.file.size,
    storagePath: path,
    kind: 'attachment',
    createdBy: input.createdBy,
  })
}
