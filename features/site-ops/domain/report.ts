import { calcVariances } from './actuals'

export interface DailyReportLine {
  workOrderId: string
  taskUid: number
  taskName: string
  location: string | null
  crewId: string | null
  plannedQuantity: number
  actualQuantity: number
  plannedPersonDays: number
  actualPersonDays: number
  qty_variance: number
  pd_variance: number
  productivity: number | null
  actualStatus: string | null
  constraints: string[]
}

export interface DailyReportInputLine {
  workOrderId: string
  taskUid: number
  taskName: string
  location: string | null
  crewId: string | null
  plannedQuantity: number
  plannedPersonDays: number
  constraints: string[]
  approvedActual?: {
    actualQuantity: number
    actualPersonDays: number
    status: string
  } | null
  latestActual?: {
    actualQuantity: number
    actualPersonDays: number
    status: string
  } | null
}

export function buildDailyReport(params: {
  planDate: string
  projectId: string
  planStatus: string
  gate: string | null
  lines: DailyReportInputLine[]
  openConstraints?: string[]
}) {
  const lines: DailyReportLine[] = params.lines.map((line) => {
    const actual = line.approvedActual ?? line.latestActual ?? null
    const actualQuantity = actual?.actualQuantity ?? 0
    const actualPersonDays = actual?.actualPersonDays ?? 0
    const variances = calcVariances({
      plannedQuantity: line.plannedQuantity,
      actualQuantity,
      plannedPersonDays: line.plannedPersonDays,
      actualPersonDays,
    })
    return {
      workOrderId: line.workOrderId,
      taskUid: line.taskUid,
      taskName: line.taskName,
      location: line.location,
      crewId: line.crewId,
      plannedQuantity: line.plannedQuantity,
      actualQuantity,
      plannedPersonDays: line.plannedPersonDays,
      actualPersonDays,
      qty_variance: variances.qty_variance,
      pd_variance: variances.pd_variance,
      productivity: variances.productivity,
      actualStatus: actual?.status ?? null,
      constraints: line.constraints,
    }
  })

  const totals = lines.reduce(
    (acc, line) => {
      acc.plannedQuantity += line.plannedQuantity
      acc.actualQuantity += line.actualQuantity
      acc.plannedPersonDays += line.plannedPersonDays
      acc.actualPersonDays += line.actualPersonDays
      return acc
    },
    { plannedQuantity: 0, actualQuantity: 0, plannedPersonDays: 0, actualPersonDays: 0 }
  )

  return {
    planDate: params.planDate,
    projectId: params.projectId,
    planStatus: params.planStatus,
    gate: params.gate,
    tagline: 'Integrity before Intelligence.',
    note:
      'Phase 1 checks readiness only. Layer 2 executes daily control.',
    totals: {
      ...totals,
      qty_variance: totals.actualQuantity - totals.plannedQuantity,
      pd_variance: totals.actualPersonDays - totals.plannedPersonDays,
      productivity: calcVariances({
        plannedQuantity: totals.plannedQuantity,
        actualQuantity: totals.actualQuantity,
        plannedPersonDays: totals.plannedPersonDays,
        actualPersonDays: totals.actualPersonDays,
      }).productivity,
    },
    lines,
    openConstraints: params.openConstraints ?? [],
  }
}
