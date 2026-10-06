import { describe, expect, it } from 'vitest'
import {
buildProgressLedgerRows,
ledgerDateRange,
plannedProgressFrom,
plannedWorkdays,
} from '@/features/supervisor/lib/progress-ledger'
import type { DailyReportActivity } from '@/features/supervisor/lib/daily-report-activities'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'

describe('required progress', () => {
  it('counts the planned working days, Saturday to Thursday', () => {
    // 2026-10-03 (Sat) … 2026-10-10 (Sat): 8 days, one Friday → 7 working days
    expect(plannedWorkdays('2026-10-03', '2026-10-10')).toBe(7)
    expect(plannedWorkdays('2026-10-09', '2026-10-09')).toBe(0)
    expect(plannedWorkdays(null, '2026-10-09')).toBe(0)
  })

  it('rises by 100 / workdays from the first reported day, skipping Fridays, and ends at 100', () => {
    // first report on Wednesday 2026-10-07, 3 working days → Wed, Thu, (Fri off), Sat
    const plan = plannedProgressFrom('2026-10-07', 3)
    expect([...plan.entries()].map(([d, p]) => [d, p.daily, p.cumulative])).toEqual([
      ['2026-10-07', 33.33, 33.33],
      ['2026-10-08', 33.33, 66.67],
      ['2026-10-10', 33.33, 100],
    ])
    expect(plannedProgressFrom('2026-10-07', 0).size).toBe(0)
  })
})

const node = (id: string, wbs: string, depth: number, extra: Partial<ScheduleTreeNode> = {}): ScheduleTreeNode => ({
  id,
  kind: 'schedule',
  mspUid: null,
  taskId: id,
  wbs,
  name: `task ${wbs}`,
  depth,
  startDate: '2026-09-01',
  finishDate: '2026-09-30',
  packages: [],
  children: [],
  ...extra,
})

const pkg = (id: string, wbs: string, extra: Partial<WorkshopPackageNode> = {}) =>
  ({ id, kind: 'package', wbs, name: `pkg ${wbs}`, startDate: null, finishDate: null, children: [], ...extra }) as WorkshopPackageNode

const activity = (id: string) => ({ id }) as DailyReportActivity

describe('buildProgressLedgerRows', () => {
  it('keeps schedule order, nests sub-items, and marks only daily-report rows editable', () => {
    const nodes = [
      node('t1', '1', 0, { percentComplete: 40 }),
      node('t2', '1.1', 1, { packages: [pkg('p1', '1.1.1', { finishDate: '2026-10-10', children: [pkg('p2', '1.1.1.1')] })] }),
      node('t3', '1.2', 1),
    ]
    const rows = buildProgressLedgerRows(nodes, [pkg('p9', '9')], [activity('package:p2'), activity('schedule:t3')])
    expect(rows.map((r) => [r.key, r.depth, r.activityId])).toEqual([
      ['schedule:t1', 0, null],
      ['schedule:t2', 1, null],
      ['package:p1', 2, null],
      ['package:p2', 3, 'package:p2'],
      ['schedule:t3', 1, 'schedule:t3'],
      ['group:orphans', 0, null],
      ['package:p9', 1, null],
    ])
    expect(rows[0]!.schedulePercent).toBe(40)
    expect(rows[3]).toMatchObject({ startDate: '2026-09-01', finishDate: '2026-10-10' })
  })

  it('project range spans the schedule and any later report or today', () => {
    const rows = buildProgressLedgerRows([node('t1', '1', 0)], [], [])
    expect(ledgerDateRange(rows, ['2026-10-05'])).toEqual({ from: '2026-09-01', to: '2026-10-05' })
    expect(ledgerDateRange([], [])).toBeNull()
  })
})
