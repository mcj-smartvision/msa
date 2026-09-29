import type { SupabaseClient } from '@supabase/supabase-js'
import { deductedMonthFromLabel } from '@/lib/finance/overhead-schedule-months'
import { TOMAN_SCALE, type OverheadMonthAmount } from '@/lib/finance/live-workshop-cost'

function yearFromLabels(labels: string[]): number | null {
  for (const label of labels) {
    const match = String(label).match(/(13|14)\d{2}/)
    if (match) return Number(match[0])
  }
  return null
}

/** Monthly totals of the site overhead workbook, in Toman. */
export async function loadOverheadMonths(
  supabase: SupabaseClient,
  projectId: string
): Promise<OverheadMonthAmount[]> {
  const { data: workbookRow } = await supabase
    .from('project_overhead_workbooks')
    .select('month_labels, categories')
    .eq('project_id', projectId)
    .maybeSingle()

  const labels = Array.isArray(workbookRow?.month_labels)
    ? (workbookRow.month_labels as string[])
    : []
  const categories = Array.isArray(workbookRow?.categories)
    ? (workbookRow.categories as Array<{ months?: Array<string | number> }>)
    : []
  if (labels.length === 0) return []

  const year = yearFromLabels(labels)
  const months: OverheadMonthAmount[] = []
  labels.forEach((label, index) => {
    const month = deductedMonthFromLabel(label, index, year)
    if (!month.startIso || !month.endIso) return
    const stored = categories.reduce((sum, category) => {
      const value = Number(category.months?.[index])
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0)
    months.push({
      startIso: month.startIso,
      endIso: month.endIso,
      label: month.label,
      amountToman: stored * TOMAN_SCALE,
    })
  })
  return months
}
