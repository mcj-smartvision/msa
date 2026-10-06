import type { CreControlReadyRow, CreGate, CrePhase1Export } from '@/features/cre-contract/lib'
import { SiteOpsError } from './errors'
import { assertPermission, type SiteOpsRole } from './permissions'

export interface PromoteOptions {
  roles: SiteOpsRole[]
  force?: boolean
  forceReason?: string
  taskUids?: number[]
}

export interface OperationalTaskSnapshotDraft {
  taskUid: number
  wbs: string | null
  name: string
  location: unknown
  quantity: unknown
  uom: unknown
  crewResource: unknown
  personDay: unknown
  progressMethod: unknown
  start: unknown
  finish: unknown
  readinessRowStatus: CreControlReadyRow['readiness_row_status']
  forcePromoted: boolean
  forceReason: string | null
}

export function canPromoteRow(row: CreControlReadyRow, force = false): boolean {
  if (row.is_summary) return false
  if (row.readiness_row_status === 'READY') return true
  return force === true
}

export function promoteCreRun(
  exportJson: CrePhase1Export,
  options: PromoteOptions
): {
  gate: CreGate
  snapshots: OperationalTaskSnapshotDraft[]
  skipped: Array<{ taskUid: number; reason: string }>
  forceUsed: boolean
} {
  const force = Boolean(options.force)
  if (force) {
    assertPermission(options.roles, 'cre.force_promote')
    if (!options.forceReason?.trim()) {
      throw new SiteOpsError('OVERRIDE_REASON_REQUIRED', 'Force promote requires an audit reason')
    }
  } else {
    assertPermission(options.roles, 'cre.promote')
  }

  const selected = options.taskUids
    ? new Set(options.taskUids)
    : null

  const snapshots: OperationalTaskSnapshotDraft[] = []
  const skipped: Array<{ taskUid: number; reason: string }> = []

  for (const row of exportJson.control_ready_table.rows) {
    if (selected && !selected.has(row.task_uid)) continue

    const forceThis = force && row.readiness_row_status !== 'READY'
    if (!canPromoteRow(row, forceThis)) {
      skipped.push({
        taskUid: row.task_uid,
        reason: row.is_summary
          ? 'Summary rows are not operational'
          : `Row status ${row.readiness_row_status} is not promotable without force`,
      })
      continue
    }

    if (forceThis && !options.forceReason?.trim()) {
      throw new SiteOpsError('OVERRIDE_REASON_REQUIRED', 'Force promote requires an audit reason')
    }

    snapshots.push({
      taskUid: row.task_uid,
      wbs: row.wbs ?? null,
      name: row.name,
      location: row.location,
      quantity: row.quantity,
      uom: row.quantity_uom,
      crewResource: row.crew_or_resource,
      personDay: row.person_day,
      progressMethod: row.progress_method,
      start: row.start,
      finish: row.finish,
      readinessRowStatus: row.readiness_row_status,
      forcePromoted: forceThis,
      forceReason: forceThis ? options.forceReason!.trim() : null,
    })
  }

  if (snapshots.length === 0) {
    throw new SiteOpsError(
      'TASK_NOT_PROMOTABLE',
      'No tasks could be promoted from this CRE run',
      { skipped }
    )
  }

  return {
    gate: exportJson.summary.gate,
    snapshots,
    skipped,
    forceUsed: force,
  }
}

export function assertCanAutoGeneratePlan(gate: CreGate, allowOverride: boolean): void {
  if (gate === 'CONTROL_READY') return
  if (allowOverride) return
  throw new SiteOpsError(
    'CRE_NOT_READY',
    'Latest CRE gate is NOT_CONTROL_READY. Fix schedule & rerun CRE, or use audited override.'
  )
}
