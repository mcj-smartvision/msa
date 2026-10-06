import type { SupabaseClient } from '@supabase/supabase-js'
import {
FINANCIAL_COST_TYPES,
type CostSummary,
type CreateCostInput,
type FinancialCost,
type FinancialCostType,
} from '@/features/finance/lib/types'

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function buildCostSummary(rows: FinancialCost[]): CostSummary {
  const byType = Object.fromEntries(
    FINANCIAL_COST_TYPES.map((t) => [t, 0])
  ) as Record<FinancialCostType, number>

  let totalAc = 0
  for (const row of rows) {
    const amount = toNumber(row.amount)
    totalAc += amount
    byType[row.type] = (byType[row.type] ?? 0) + amount
  }

  return { totalAc, byType }
}

export async function fetchFinancialCosts(
  supabase: SupabaseClient,
  projectId: string,
  filters?: {
    type?: FinancialCostType | 'all'
    itemCode?: string
    dateFrom?: string
    dateTo?: string
  }
): Promise<FinancialCost[]> {
  let query = supabase
    .from('financial_costs')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }
  if (filters?.itemCode?.trim()) {
    query = query.ilike('item_code', `%${filters.itemCode.trim()}%`)
  }
  if (filters?.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('date', filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as FinancialCost[]
}

export async function createFinancialCost(
  supabase: SupabaseClient,
  input: CreateCostInput
): Promise<FinancialCost> {
  const { data, error } = await supabase
    .from('financial_costs')
    .insert({
      project_id: input.projectId,
      date: input.date,
      type: input.type,
      item_code: input.itemCode?.trim() || null,
      description: input.description?.trim() || '',
      amount: input.amount,
      invoice_reference: input.invoiceReference?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as FinancialCost
}

export async function updateFinancialCost(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<CreateCostInput>
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (patch.date !== undefined) payload.date = patch.date
  if (patch.type !== undefined) payload.type = patch.type
  if (patch.itemCode !== undefined) payload.item_code = patch.itemCode.trim() || null
  if (patch.description !== undefined) payload.description = patch.description.trim()
  if (patch.amount !== undefined) payload.amount = patch.amount
  if (patch.invoiceReference !== undefined) {
    payload.invoice_reference = patch.invoiceReference.trim() || null
  }

  const { error } = await supabase.from('financial_costs').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteFinancialCost(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('financial_costs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
