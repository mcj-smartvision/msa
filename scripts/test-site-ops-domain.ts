/**
 * Layer 2 domain smoke tests.
 * Run: npx tsx scripts/test-site-ops-domain.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCrePhase1Export } from '../features/cre-contract/lib'
import {
  approveActual,
  assertCanMarkCleanDone,
  assertPermission,
  buildDailyReport,
  canPromoteRow,
  generateDailyPlanDraft,
  issueDailyPlan,
  mapSitePilotPositionToSiteOpsRoles,
  promoteCreRun,
  setPaymentFlag,
  SiteOpsError,
  submitActual,
  validateChildRollup,
} from '../features/site-ops/domain'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const ready = parseCrePhase1Export(
  JSON.parse(readFileSync(join('data/site-ops/fixtures/cre-control-ready.json'), 'utf8'))
)
const notReady = parseCrePhase1Export(
  JSON.parse(readFileSync(join('data/site-ops/fixtures/cre-not-control-ready.json'), 'utf8'))
)

assert(ready.summary.gate === 'CONTROL_READY', 'ready fixture gate')
assert(notReady.summary.overall_score === 18.8, 'not-ready score')

const readyRow = ready.control_ready_table.rows[0]
assert(canPromoteRow(readyRow) === true, 'READY row promotable')
assert(canPromoteRow(notReady.control_ready_table.rows[0]) === false, 'NOT_READY blocked')
assert(canPromoteRow(notReady.control_ready_table.rows[0], true) === true, 'force promotes')

const promoted = promoteCreRun(ready, { roles: ['PLANNER'] })
assert(promoted.snapshots.length === 2, 'promote two READY rows')

let forcedOk = false
try {
  promoteCreRun(notReady, { roles: ['VIEWER'], force: true, forceReason: 'x' })
} catch (e) {
  forcedOk = e instanceof SiteOpsError && e.code === 'FORBIDDEN'
}
assert(forcedOk, 'viewer cannot force promote')

const forced = promoteCreRun(notReady, {
  roles: ['SITE_MANAGER'],
  force: true,
  forceReason: 'Emergency restart of Zone A',
  taskUids: [10],
})
assert(forced.forceUsed && forced.snapshots[0].forcePromoted, 'force promote audited')

let reasonRequired = false
try {
  promoteCreRun(notReady, { roles: ['SITE_MANAGER'], force: true, forceReason: '' })
} catch (e) {
  reasonRequired = e instanceof SiteOpsError && e.code === 'OVERRIDE_REASON_REQUIRED'
}
assert(reasonRequired, 'force reason required')

let blockedPlan = false
try {
  generateDailyPlanDraft({
    roles: ['SUPERVISOR'],
    planDate: '2026-07-18',
    latestGate: 'NOT_CONTROL_READY',
    promotedTaskCount: 1,
    workOrders: [
      {
        operationalTaskId: 't1',
        plannedQuantity: 1,
        plannedPersonDays: 1,
        assignedCrewId: 'c1',
      },
    ],
  })
} catch (e) {
  blockedPlan = e instanceof SiteOpsError && e.code === 'CRE_NOT_READY'
}
assert(blockedPlan, 'NOT_CONTROL_READY blocks silent plan generation')

const draft = generateDailyPlanDraft({
  roles: ['SUPERVISOR'],
  planDate: '2026-07-18',
  latestGate: 'CONTROL_READY',
  promotedTaskCount: 2,
  workOrders: [
    {
      operationalTaskId: 't1',
      plannedQuantity: 10,
      plannedPersonDays: 2,
      assignedCrewId: 'c1',
    },
  ],
})
assert(draft.status === 'DRAFT', 'draft plan')

const issued = issueDailyPlan({ roles: ['SITE_MANAGER'], status: 'DRAFT', workOrderCount: 1 })
assert(issued.status === 'ISSUED', 'issue plan')

const submitted = submitActual({
  roles: ['SUPERVISOR'],
  planStatus: 'ISSUED',
  workOrderStatus: 'PLANNED',
  snapshotUom: { value: 'm2', state: 'VALID' },
  actualQuantity: 8,
  actualUom: 'm2',
  actualPersonDays: 2,
  namedCrewOrWorkers: true,
})
assert(submitted.status === 'SUBMITTED', 'submit actual')

let uomFail = false
try {
  submitActual({
    roles: ['SUPERVISOR'],
    planStatus: 'ISSUED',
    workOrderStatus: 'PLANNED',
    snapshotUom: { value: 'm2', state: 'VALID' },
    actualQuantity: 8,
    actualUom: 'ton',
    actualPersonDays: 1,
    namedCrewOrWorkers: true,
  })
} catch (e) {
  uomFail = e instanceof SiteOpsError && e.code === 'UOM_MISMATCH'
}
assert(uomFail, 'uom mismatch')

const approved = approveActual({ roles: ['SUPERVISOR'], status: 'SUBMITTED', approve: true })
assert(approved.status === 'APPROVED', 'approve actual')

assertPermission(['VIEWER'], 'cre.view')
let forbidden = false
try {
  assertPermission(['VIEWER'], 'plan.issue')
} catch (e) {
  forbidden = e instanceof SiteOpsError && e.code === 'FORBIDDEN'
}
assert(forbidden, 'rbac blocks issue for viewer')

const report = buildDailyReport({
  planDate: '2026-07-18',
  projectId: 'p1',
  planStatus: 'ISSUED',
  gate: 'CONTROL_READY',
  lines: [
    {
      workOrderId: 'w1',
      taskUid: 101,
      taskName: 'Formwork',
      location: 'Grid A-C',
      crewId: 'c1',
      plannedQuantity: 120,
      plannedPersonDays: 8,
      constraints: [],
      approvedActual: { actualQuantity: 100, actualPersonDays: 8, status: 'APPROVED' },
    },
  ],
})
assert(report.totals.qty_variance === -20, 'qty variance')
assert(report.lines[0].productivity === 12.5, 'productivity')

const toRoles = mapSitePilotPositionToSiteOpsRoles(['technical_office'])
assert(toRoles.includes('TECHNICAL_OFFICE'), 'technical_office maps to TECHNICAL_OFFICE')

const flagged = setPaymentFlag({
  roles: ['TECHNICAL_OFFICE'],
  flag: 'NeedsChangeReview',
  reason: 'Poles without cabling in BOQ',
})
assert(flagged.payment_flag === 'NeedsChangeReview', 'payment flag set')

let cleanDoneBlocked = false
try {
  assertCanMarkCleanDone({
    paymentFlag: 'NeedsChangeReview',
    pmRiskAcknowledged: false,
    nextStatus: 'Done',
  })
} catch (e) {
  cleanDoneBlocked = e instanceof SiteOpsError && e.code === 'PAYMENT_RISK'
}
assert(cleanDoneBlocked, 'clean Done blocked without PM ack')

assertCanMarkCleanDone({
  paymentFlag: 'NeedsChangeReview',
  pmRiskAcknowledged: true,
  nextStatus: 'Done',
})

validateChildRollup({ parentPlannedQty: 2, childrenPlannedQty: [1, 1] })
let rollupFail = false
try {
  validateChildRollup({ parentPlannedQty: 2, childrenPlannedQty: [1, 0.5] })
} catch (e) {
  rollupFail = e instanceof SiteOpsError && e.code === 'ROLLUP_MISMATCH'
}
assert(rollupFail, 'rollup mismatch detected')

console.log('site-ops domain tests: OK')
