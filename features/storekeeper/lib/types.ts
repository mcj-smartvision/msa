export interface InventoryItemRow {
  id: string
  project_id: string
  name: string
  current_stock: number
  unit: string
  min_stock: number
  last_updated_at: string
}

export interface InventoryTransactionRow {
  id: string
  item_id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  unit: string
  date: string
  note: string | null
  created_by: string | null
  inventory_items?: { name: string } | null
}

export interface InventoryKpis {
  totalItems: number
  lowStockItems: number
  incomingToday: number
  outgoingToday: number
}

export interface ExtractedInvoiceLine {
  id: string
  name: string
  quantity: number
  unit: string
}

export interface ConfirmReceiptItem {
  name: string
  quantity: number
  unit: string
}
