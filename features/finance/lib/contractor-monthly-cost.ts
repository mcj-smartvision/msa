import { plannedWeightsOnMonths } from '@/features/schedule/lib/planned-month-weight'
import type { DeductedWeightMonth } from '@/features/schedule/lib/monthly-deducted-weight'

export const UNASSIGNED_CONTRACTOR_ID = '__unassigned__'

export type ContractorMonthRow = {
  contractorId: string
  contractorName: string
  activityCount: number
  contractValue: number
  executed: number
  months: number[]
}

export function allocateExecutedByMonths(
  executedToman: number,
  start: string | null,
  finish: string | null,
  months: DeductedWeightMonth[]
): number[] {
  if (!Number.isFinite(executedToman) || executedToman === 0 || months.length === 0) {
    return months.map(() => 0)
  }
  const weights = plannedWeightsOnMonths(1, start, finish, months)
  const sum = weights.reduce((total, value) => total + value, 0)
  if (sum <= 0) {
    return months.map((_, index) => (index === months.length - 1 ? executedToman : 0))
  }
  return weights.map((weight) => (executedToman * weight) / sum)
}

export function buildContractorMonthlyCostModel(input: {
  months: DeductedWeightMonth[]
  rows: Array<{
    contractorId: string | null
    contractorName: string
    contractValue: number
    executed: number
    start: string | null
    finish: string | null
  }>
}): {
  months: DeductedWeightMonth[]
  contractors: ContractorMonthRow[]
  monthTotals: number[]
  grandTotal: number
  contractValue: number
} {
  const grouped = new Map<
    string,
    {
      contractorId: string
      contractorName: string
      activityCount: number
      contractValue: number
      executed: number
      months: number[]
    }
  >()

  for (const row of input.rows) {
    const id = row.contractorId?.trim() || UNASSIGNED_CONTRACTOR_ID
    const current = grouped.get(id) ?? {
      contractorId: id,
      contractorName: row.contractorName.trim() || 'بدون پیمانکار',
      activityCount: 0,
      contractValue: 0,
      executed: 0,
      months: input.months.map(() => 0),
    }
    const allocated = allocateExecutedByMonths(row.executed, row.start, row.finish, input.months)
    current.activityCount += 1
    current.contractValue += row.contractValue
    current.executed += row.executed
    current.months = current.months.map((value, index) => value + (allocated[index] ?? 0))
    grouped.set(id, current)
  }

  const contractors = [...grouped.values()].sort((a, b) => b.executed - a.executed)
  const monthTotals = input.months.map((_, index) =>
    contractors.reduce((sum, row) => sum + (row.months[index] ?? 0), 0)
  )
  return {
    months: input.months,
    contractors,
    monthTotals,
    grandTotal: contractors.reduce((sum, row) => sum + row.executed, 0),
    contractValue: contractors.reduce((sum, row) => sum + row.contractValue, 0),
  }
}
