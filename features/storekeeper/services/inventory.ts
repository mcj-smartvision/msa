import type { SupabaseClient } from '@supabase/supabase-js'
import type {
ConfirmReceiptItem,
InventoryItemRow,
InventoryKpis,
InventoryTransactionRow,
} from '@/features/storekeeper/lib/types'

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function fetchInventoryItems(
  supabase: SupabaseClient,
  projectId: string
): Promise<InventoryItemRow[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, project_id, name, current_stock, unit, min_stock, last_updated_at')
    .eq('project_id', projectId)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as InventoryItemRow[]
}

export async function fetchInventoryTransactions(
  supabase: SupabaseClient,
  projectId: string,
  limit = 30
): Promise<InventoryTransactionRow[]> {
  const { data: projectItems, error: itemsError } = await supabase
    .from('inventory_items')
    .select('id, name')
    .eq('project_id', projectId)

  if (itemsError) throw new Error(itemsError.message)

  const items = projectItems ?? []
  if (items.length === 0) return []

  const nameMap = new Map(items.map((i) => [i.id, i.name as string]))
  const itemIds = items.map((i) => i.id)

  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('id, item_id, type, quantity, unit, date, note, created_by')
    .in('item_id', itemIds)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...(row as Omit<InventoryTransactionRow, 'inventory_items'>),
    inventory_items: { name: nameMap.get(row.item_id) ?? '—' },
  }))
}

export async function fetchInventoryKpis(
  supabase: SupabaseClient,
  projectId: string
): Promise<InventoryKpis> {
  const items = await fetchInventoryItems(supabase, projectId)
  const todayStart = startOfTodayIso()

  const itemIds = items.map((i) => i.id)
  let incomingToday = 0
  let outgoingToday = 0

  if (itemIds.length > 0) {
    const { data: txRows, error } = await supabase
      .from('inventory_transactions')
      .select('type, quantity')
      .in('item_id', itemIds)
      .gte('date', todayStart)

    if (error) throw new Error(error.message)

    for (const row of txRows ?? []) {
      const qty = Number(row.quantity) || 0
      if (row.type === 'IN') incomingToday += qty
      if (row.type === 'OUT') outgoingToday += qty
    }
  }

  return {
    totalItems: items.length,
    lowStockItems: items.filter((i) => Number(i.current_stock) < Number(i.min_stock)).length,
    incomingToday,
    outgoingToday,
  }
}

export async function createInventoryScan(
  supabase: SupabaseClient,
  projectId: string,
  imageUrl: string | null
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('inventory_scans')
    .insert({
      project_id: projectId,
      image_url: imageUrl,
      status: 'pending',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

export async function updateScanExtractedData(
  supabase: SupabaseClient,
  scanId: string,
  extractedData: ConfirmReceiptItem[]
) {
  const { error } = await supabase
    .from('inventory_scans')
    .update({ extracted_data: extractedData })
    .eq('id', scanId)

  if (error) throw new Error(error.message)
}

export async function confirmInventoryReceipt(
  supabase: SupabaseClient,
  projectId: string,
  items: ConfirmReceiptItem[],
  invoiceDate: string,
  scanId?: string | null,
  note?: string | null,
  invoiceNumber?: string | null
) {
  const { data, error } = await supabase.rpc('confirm_inventory_receipt', {
    p_project_id: projectId,
    p_items: items,
    p_invoice_date: invoiceDate,
    p_note: note ?? null,
    p_scan_id: scanId ?? null,
    p_invoice_number: invoiceNumber?.trim() || null,
  })

  if (error) throw new Error(error.message)
  return data
}

export async function confirmInventoryDispatch(
  supabase: SupabaseClient,
  projectId: string,
  items: ConfirmReceiptItem[],
  invoiceDate: string,
  scanId?: string | null,
  note?: string | null,
  invoiceNumber?: string | null
) {
  const { data, error } = await supabase.rpc('confirm_inventory_dispatch', {
    p_project_id: projectId,
    p_items: items,
    p_invoice_date: invoiceDate,
    p_note: note ?? null,
    p_scan_id: scanId ?? null,
    p_invoice_number: invoiceNumber?.trim() || null,
  })

  if (error) throw new Error(error.message)
  return data
}

export async function uploadInvoiceImage(
  supabase: SupabaseClient,
  projectId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${projectId}/invoices/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('material-invoices').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) return null

  const { data } = supabase.storage.from('material-invoices').getPublicUrl(path)
  return data.publicUrl
}

export async function analyzeInvoiceImage(
  supabase: SupabaseClient,
  file: File
): Promise<ConfirmReceiptItem[]> {
  const base64 = await fileToBase64(file)

  const { data, error } = await supabase.functions.invoke('analyze-invoice', {
    body: { imageBase64: base64 },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(String(data.error))

  const items = (data?.items ?? []) as ConfirmReceiptItem[]
  return items.filter((row) => row.name && Number(row.quantity) > 0)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}
