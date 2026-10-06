import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchStockValuation(
  supabase: SupabaseClient,
  projectId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('current_stock, unit_price_rial')
    .eq('project_id', projectId)

  if (error) throw new Error(error.message)

  let total = 0
  for (const row of data ?? []) {
    const stock = Number(row.current_stock) || 0
    const price = Number(row.unit_price_rial) || 0
    total += stock * price
  }
  return total
}
