import type { FinancialCostType } from '@/features/finance/lib/types'
import type { CreateExpenseItemInput } from '@/features/finance/lib/expense-types'

/** AI pre-fill result from analyze-expense-document edge function. */
export interface ExpenseAiExtraction {
  invoiceNo: string | null
  documentNo: string | null
  supplierName: string | null
  /** Gregorian ISO YYYY-MM-DD */
  documentDate: string | null
  amount: number | null
  description: string | null
  costType: FinancialCostType | null
  items: ExpenseAiLineItem[]
}

export interface ExpenseAiLineItem {
  description: string
  quantity: number
  unit: string | null
  unitPrice: number | null
  amount: number | null
}

export function mapAiItemsToExpenseItems(
  items: ExpenseAiLineItem[],
  fallbackCostType: FinancialCostType
): CreateExpenseItemInput[] {
  return items.map((item, idx) => {
    const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1
    const amount =
      item.amount != null && Number.isFinite(item.amount) && item.amount > 0
        ? item.amount
        : item.unitPrice != null && Number.isFinite(item.unitPrice)
          ? item.unitPrice * qty
          : 0
    return {
      lineNo: idx + 1,
      description: item.description,
      quantity: qty,
      unit: item.unit ?? undefined,
      unitPrice: item.unitPrice ?? undefined,
      amount,
      costType: fallbackCostType,
    }
  })
}
