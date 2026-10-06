/**
 * Local smoke test — flat delta shift (no double-shift, no CPM drift).
 * Run: npx tsx scripts/test-reschedule-engine.ts
 */
import { shiftScheduleByActualStart } from '../features/schedule/lib/reschedule-engine'
import type { ProjectTask } from '../shared/types/schedule'

function task(
  id: string,
  wbs: string,
  baselineStart: string,
  baselineFinish: string,
  mspUid = 1
): ProjectTask {
  return {
    id,
    project_id: 'p1',
    msp_uid: mspUid,
    wbs_code: wbs,
    name: `Task ${wbs}`,
    start_planned: baselineStart,
    finish_planned: baselineFinish,
    start_current: baselineStart,
    finish_current: baselineFinish,
    baseline_start: baselineStart,
    baseline_finish: baselineFinish,
    percent_complete: 0,
    is_critical: false,
    created_at: '',
    updated_at: '',
  }
}

const projectBaseline = '2024-01-01'
const tasks: ProjectTask[] = [
  task('a', '1.1', '2024-01-01T00:00:00.000Z', '2024-01-05T00:00:00.000Z', 1),
  task('b', '2.1', '2024-01-06T00:00:00.000Z', '2024-01-10T00:00:00.000Z', 2),
]

function iso(d: string) {
  return d.slice(0, 10)
}

function dur(start: string, finish: string) {
  return iso(finish) > iso(start) ? 'ok' : 'bad'
}

const first = shiftScheduleByActualStart('2024-06-01', tasks, projectBaseline)
console.log('Pass 1 — actual start 2024-06-01, delta', first.deltaDays, 'days')
const a1 = first.taskDates.get('a')!
const b1 = first.taskDates.get('b')!
console.log('  Task 1.1:', iso(a1.start), '→', iso(a1.finish))
console.log('  Task 2.1:', iso(b1.start), '→', iso(b1.finish))

if (iso(a1.start) !== '2024-06-01') throw new Error('WBS 1.1 must start on actual start')
if (iso(b1.start) !== '2024-06-06') throw new Error('Task 2.1 should shift by same delta (+152d)')
if (dur(a1.start, a1.finish) !== dur(tasks[0].baseline_start!, tasks[0].baseline_finish!)) {
  throw new Error('Duration must be preserved for 1.1')
}

const second = shiftScheduleByActualStart('2024-07-01', tasks, projectBaseline)
console.log('Pass 2 — actual start 2024-07-01, delta', second.deltaDays, 'days')
const a2 = second.taskDates.get('a')!
const b2 = second.taskDates.get('b')!
console.log('  Task 1.1:', iso(a2.start), '→', iso(a2.finish))
console.log('  Task 2.1:', iso(b2.start), '→', iso(b2.finish))

if (iso(a2.start) !== '2024-07-01') throw new Error('WBS 1.1 must start on 2024-07-01 (no double-shift)')
if (iso(b2.start) !== '2024-07-06') throw new Error('Task 2.1 should shift +31d from pass 1, not cumulative error')

console.log('\n✅ Flat shift smoke test passed.')
