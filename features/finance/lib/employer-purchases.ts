/** Employer purchases (خرید کارفرمایی): amounts in whole toman, shared among schedule activities by percent. */

export interface EmployerPurchaseAllocation {
  taskId: string | null
  taskWbs: string | null
  taskName: string
  sharePercent: number
}

export interface EmployerPurchase {
  id: string
  purchaseDate: string
  itemName: string
  supplier: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  amount: number
  invoiceRef: string | null
  description: string | null
  allocations: EmployerPurchaseAllocation[]
}

export type EmployerPurchaseInput = Omit<EmployerPurchase, 'id' | 'allocations'> & {
  allocations: { taskId: string; sharePercent: number }[]
}

/** A schedule activity a purchase can be shared to. */
export interface PurchaseTaskOption {
  id: string
  wbs: string | null
  name: string
}

const SHARE_TOLERANCE = 0.01

export class PurchaseValidationError extends Error {}

const text = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim() : ''
  return t ? t : null
}

const amountOf = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(typeof v === 'string' ? v.replace(/,/g, '') : v)
  return Number.isFinite(n) ? n : null
}

/**
 * Validates a purchase from the form. One activity always takes 100 %; with several, each share is
 * above 0 and the shares add up to 100 %. Without an amount, quantity × unit price is used.
 */
export function parseEmployerPurchaseInput(body: unknown): EmployerPurchaseInput {
  const b = (body ?? {}) as Record<string, unknown>
  const purchaseDate = text(b.purchaseDate)
  if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) throw new PurchaseValidationError('تاریخ خرید را انتخاب کنید')
  const itemName = text(b.itemName)
  if (!itemName) throw new PurchaseValidationError('نام کالا را بنویسید')

  const quantity = amountOf(b.quantity)
  const unitPrice = amountOf(b.unitPrice)
  if (unitPrice != null && unitPrice < 0) throw new PurchaseValidationError('قیمت واحد نمی‌تواند منفی باشد')
  const amount = amountOf(b.amount) ?? (quantity != null && unitPrice != null ? Math.round(quantity * unitPrice) : null)
  if (amount == null || amount < 0) throw new PurchaseValidationError('مبلغ خرید را وارد کنید')

  const raw = Array.isArray(b.allocations) ? (b.allocations as Record<string, unknown>[]) : []
  const rows = raw
    .map((a) => ({ taskId: text(a.taskId), sharePercent: amountOf(a.sharePercent) }))
    .filter((a): a is { taskId: string; sharePercent: number | null } => a.taskId != null)
  if (rows.length === 0) throw new PurchaseValidationError('دست‌کم یک آیتم برنامه را انتخاب کنید')
  if (new Set(rows.map((a) => a.taskId)).size !== rows.length) throw new PurchaseValidationError('یک آیتم برنامه دو بار انتخاب شده است')

  let allocations: { taskId: string; sharePercent: number }[]
  if (rows.length === 1) {
    allocations = [{ taskId: rows[0]!.taskId, sharePercent: 100 }]
  } else {
    if (rows.some((a) => a.sharePercent == null || a.sharePercent <= 0 || a.sharePercent > 100)) {
      throw new PurchaseValidationError('سهم هر آیتم باید بیشتر از صفر و حداکثر 100 درصد باشد')
    }
    allocations = rows.map((a) => ({ taskId: a.taskId, sharePercent: a.sharePercent! }))
    const total = allocations.reduce((s, a) => s + a.sharePercent, 0)
    if (Math.abs(total - 100) > SHARE_TOLERANCE) {
      throw new PurchaseValidationError(`جمع سهم‌ها باید 100 درصد باشد (الان ${Math.round(total * 100) / 100} درصد)`)
    }
  }

  return {
    purchaseDate,
    itemName,
    supplier: text(b.supplier),
    quantity,
    unit: text(b.unit),
    unitPrice,
    amount,
    invoiceRef: text(b.invoiceRef),
    description: text(b.description),
    allocations,
  }
}

/** Equal shares that add up to exactly 100 (the last one takes the rounding). */
export function equalShares(count: number): number[] {
  if (count <= 0) return []
  const each = Math.floor((100 / count) * 100) / 100
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? Math.round((100 - each * (count - 1)) * 100) / 100 : each))
}

/** Toman each activity carries from the purchases, by share; the amounts of one purchase add up to its amount. */
export function purchaseCostByTask(purchases: EmployerPurchase[]): Map<string, { wbs: string | null; name: string; amount: number }> {
  const out = new Map<string, { wbs: string | null; name: string; amount: number }>()
  for (const p of purchases) {
    let left = p.amount
    p.allocations.forEach((a, i) => {
      const share = i === p.allocations.length - 1 ? left : Math.round((p.amount * a.sharePercent) / 100)
      left -= share
      const key = a.taskId ?? `removed:${a.taskWbs ?? ''}:${a.taskName}`
      const row = out.get(key) ?? { wbs: a.taskWbs, name: a.taskName, amount: 0 }
      row.amount += share
      out.set(key, row)
    })
  }
  return out
}

export function employerPurchaseFromRow(row: Record<string, unknown>): EmployerPurchase {
  const num = (v: unknown) => (v == null ? null : Number(v))
  const allocations = ((row.employer_purchase_allocations as Record<string, unknown>[] | null) ?? [])
    .map((a) => ({
      taskId: a.task_id ? String(a.task_id) : null,
      taskWbs: a.task_wbs ? String(a.task_wbs) : null,
      taskName: String(a.task_name ?? ''),
      sharePercent: Number(a.share_percent) || 0,
    }))
    .sort((a, b) => b.sharePercent - a.sharePercent)
  return {
    id: String(row.id),
    purchaseDate: String(row.purchase_date).slice(0, 10),
    itemName: String(row.item_name ?? ''),
    supplier: (row.supplier as string | null) ?? null,
    quantity: num(row.quantity),
    unit: (row.unit as string | null) ?? null,
    unitPrice: num(row.unit_price),
    amount: Number(row.amount) || 0,
    invoiceRef: (row.invoice_ref as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    allocations,
  }
}
