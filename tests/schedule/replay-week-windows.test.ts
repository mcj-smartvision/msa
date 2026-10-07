import { describe, expect, it } from 'vitest'
import type { ForecastTask } from '@/features/schedule/lib/progress-forecast'
import { replayWindows } from '@/features/schedule/lib/replay-week-windows'
import { startDelay } from '@/features/supervisor/lib/progress-ledger'

const task = (id: string, plannedStart: string, plannedFinish: string): ForecastTask => ({
  id,
  wbs: id,
  parentId: null,
  isSummary: false,
  isMilestone: false,
  plannedStart,
  plannedFinish,
  actualStart: null,
  actualFinish: null,
  percent: 0,
})

// Slab (10 days, ends Sat 2026-08-01) → masonry FS +2 (planned 2026-08-04).
const tasks = [task('slab', '2026-07-23', '2026-08-01'), task('wall', '2026-08-04', '2026-08-13')]
const links = [{ predecessorId: 'slab', successorId: 'wall', type: 'FS' as const, lagDays: 2 }]
const activities = [
  { id: 'schedule:slab', taskId: 'slab', weight: 1 },
  { id: 'schedule:wall', taskId: 'wall', weight: 1 },
]
const report = (activityId: string, reportDate: string, percentComplete: number) => ({ activityId, reportDate, percentComplete })

describe('replayWindows', () => {
  it('pushes the successor window in the weeks after its predecessor ran late', () => {
    // On plan at 20 % after two days, 90 % on 07-30 and 100 % only on 08-09.
    const entries = [
      report('schedule:slab', '2026-07-24', 20),
      report('schedule:slab', '2026-07-30', 90),
      report('schedule:slab', '2026-08-09', 100),
    ]
    const rows = replayWindows({
      tasks,
      links,
      activities,
      entries,
      dates: ['2026-07-25', '2026-08-01', '2026-08-08', '2026-08-15'],
    })
    const wall = (week: string) => rows.find((r) => r.from === week && r.activityId === 'schedule:wall')

    // While the slab looks on schedule (90 % with one day left on 08-01), the plan holds.
    expect(wall('2026-07-25')).toMatchObject({ start: '2026-08-04', finish: '2026-08-13' })
    expect(wall('2026-08-01')).toMatchObject({ start: '2026-08-04', finish: '2026-08-13' })
    // Still 90 % on 08-08: it ends 08-08 at the earliest, so the wall starts 08-11 (FS +2).
    expect(wall('2026-08-08')).toMatchObject({ start: '2026-08-11', finish: '2026-08-20' })
    // After the slab finished on 08-09, FS +2 → 08-12, but it cannot start before the 08-15 status date.
    expect(wall('2026-08-15')).toMatchObject({ start: '2026-08-15', finish: '2026-08-24' })
  })

  it('pulls the successor in on the day its predecessor is reported done early', () => {
    // The slab is reported done on 07-29, three days before its planned finish.
    const entries = [report('schedule:slab', '2026-07-24', 20), report('schedule:slab', '2026-07-29', 100)]
    const rows = replayWindows({ tasks, links, activities, entries, dates: ['2026-07-28', '2026-07-29'] })
    const wall = (date: string) => rows.find((r) => r.from === date && r.activityId === 'schedule:wall')
    // Still 20 % on 07-28: 8 days left → slab ends 08-04, wall from 08-07.
    expect(wall('2026-07-28')).toMatchObject({ start: '2026-08-07', finish: '2026-08-16' })
    // FS +2 after 07-29 allows 08-01, three days early, already that day.
    expect(wall('2026-07-29')).toMatchObject({ start: '2026-08-01', finish: '2026-08-10' })
  })

  it("keeps an activity's own target off its same-day report while its successors move", () => {
    const entries = [report('schedule:slab', '2026-07-24', 20), report('schedule:slab', '2026-07-30', 90)]
    const rows = replayWindows({ tasks, links, activities, entries, dates: ['2026-07-30'] })
    const window = (id: string) => rows.find((r) => r.activityId === id)
    // Slab as of that morning: 20 %, 8 days left from 07-30.
    expect(window('schedule:slab')).toMatchObject({ start: '2026-07-24', finish: '2026-08-06' })
    // Wall after the 90 % report: 1 day left from 07-31, FS +2 → 08-03.
    expect(window('schedule:wall')).toMatchObject({ start: '2026-08-03', finish: '2026-08-12' })
  })

  it('takes a never-reported task with imported progress as having followed its plan', () => {
    const imported = tasks.map((t) => ({ ...t, percent: 100 }))
    const rows = replayWindows({ tasks: imported, links, activities, entries: [], dates: ['2026-08-08'] })
    expect(rows.find((r) => r.activityId === 'schedule:wall')).toMatchObject({ start: '2026-08-04', finish: '2026-08-13' })
  })

  it('still moves such a task after a late predecessor', () => {
    // Wall: 70 % imported, never reported. Slab reported done only on 08-09 → wall from 08-12 (FS +2).
    const mixed = [tasks[0]!, { ...tasks[1]!, percent: 70 }]
    const entries = [report('schedule:slab', '2026-07-24', 20), report('schedule:slab', '2026-08-09', 100)]
    const rows = replayWindows({ tasks: mixed, links, activities, entries, dates: ['2026-08-15'] })
    expect(rows.find((r) => r.activityId === 'schedule:wall')).toMatchObject({ start: '2026-08-12', finish: '2026-08-21' })
  })
})

describe('startDelay', () => {
  const row = { approvedStartDate: '2026-08-04', startDate: '2026-08-04' }
  it('counts days from the approved start to the first report, else to the forecast start', () => {
    expect(startDelay(row, '2026-08-08')).toEqual({ days: 4, started: true })
    expect(startDelay(row, '2026-08-03')).toBeNull()
    expect(startDelay({ ...row, startDate: '2026-08-10' }, null)).toEqual({ days: 6, started: false })
  })
})
