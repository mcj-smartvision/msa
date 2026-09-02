/**
 * Workshop domain smoke tests.
 * Run: npx tsx scripts/test-workshop-domain.ts
 */
import {
  assertCanEditPackage,
  assertCanSendToToday,
  canEditPackageContent,
  canEditWorkshopPackageRow,
  canReviseChangeRequest,
  WORKSHOP_SKIP_PM_APPROVAL,
} from '../lib/workshop/approvals'
import {
  decodePackageWeightFromNote,
  encodePackageWeightInNote,
  resolvePackageWeight,
} from '../lib/workshop/package-weight'
import { inferReviewReason, validateCreatePackage, WorkshopError } from '../lib/workshop/domain'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const ok = validateCreatePackage({
  projectId: 'p1',
  parentScheduleNodeId: 't1',
  name: 'اجرای شمشه‌گیری گچ',
  quantity: 120,
  uom: 'm2',
  location: 'واحد 201',
  crew: 'گچ‌کار',
})
assert(ok.name.includes('شمشه'), 'name ok')
assert(ok.quantity === 120, 'qty ok')

let failed = false
try {
  validateCreatePackage({
    projectId: 'p1',
    parentScheduleNodeId: 't1',
    name: '',
    quantity: 0,
    uom: '',
  })
} catch (e) {
  failed = e instanceof WorkshopError
}
assert(failed, 'validation fails on empty')

const flagged = inferReviewReason({ flagForReview: true })
assert(flagged.flag && flagged.reasonCode === 'out_of_baseline_scope', 'flag reason')

assert(canEditPackageContent('draft'), 'draft editable')
assert(canEditPackageContent('rejected'), 'rejected editable')
assert(canEditPackageContent('pending_approval'), 'pending still editable')
if (WORKSHOP_SKIP_PM_APPROVAL) {
  assert(canEditPackageContent('approved'), 'approved editable when PM skip')
  assert(canEditWorkshopPackageRow('approved', 'user_added'), 'user_added row editable')
  assertCanEditPackage('approved', 'user_added')
} else {
  assert(!canEditPackageContent('approved'), 'approved locked')
  let locked = false
  try {
    assertCanEditPackage('approved')
  } catch (e) {
    locked = e instanceof WorkshopError
  }
  assert(locked, 'edit blocked after approve')
}
assert(canEditWorkshopPackageRow('approved', 'user_added'), 'user_added always editable')
assert(canReviseChangeRequest('change_requested'), 'revise change request')

let lockedChangeRequest = false
try {
  assertCanEditPackage('change_requested', 'user_added')
} catch (e) {
  lockedChangeRequest = e instanceof WorkshopError
}
assert(lockedChangeRequest, 'change_requested blocked')

if (WORKSHOP_SKIP_PM_APPROVAL) {
  assertCanSendToToday('draft')
  let sendBlockedOnChange = false
  try {
    assertCanSendToToday('change_requested')
  } catch (e) {
    sendBlockedOnChange = e instanceof WorkshopError
  }
  assert(sendBlockedOnChange, 'send-to-today blocked on change request')
} else {
  let sendBlocked = false
  try {
    assertCanSendToToday('draft')
  } catch (e) {
    sendBlocked = e instanceof WorkshopError
  }
  assert(sendBlocked, 'send-to-today requires approval')
}

const encoded = encodePackageWeightInNote('یادداشت', 40)
assert(encoded?.includes('40'), 'weight encoded in note')
assert(resolvePackageWeight({ note: encoded }) === 40, 'weight read from note')
assert(decodePackageWeightFromNote(encoded) === 40, 'decode note weight')
assert(resolvePackageWeight({ weight_percent: 25, note: encoded }) === 25, 'column preferred over note')

console.log('workshop domain tests: OK')
