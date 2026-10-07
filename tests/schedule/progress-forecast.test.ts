import { describe, expect, it } from 'vitest'
import { forecastSchedule, type ForecastLink, type ForecastTask } from '@/features/schedule/lib/progress-forecast'

const task = (id: string, plannedStart: string, plannedFinish: string, extra: Partial<ForecastTask> = {}): ForecastTask => ({
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
  ...extra,
})
const fs = (predecessorId: string, successorId: string, lagDays = 0): ForecastLink => ({ predecessorId, successorId, type: 'FS', lagDays })

// Concrete pour (10 days) → steel columns (5 days, FS +1 day) → milestone.
const plan = () => [
  task('1', '2026-10-01', '2026-10-10'),
  task('2', '2026-10-12', '2026-10-16'),
  task('3', '2026-10-16', '2026-10-16', { isMilestone: true }),
]
const links = [fs('1', '2', 1), fs('2', '3')]

describe('forecastSchedule', () => {
  it('keeps the plan while every activity is on schedule', () => {
    const tasks = plan()
    tasks[0]!.percent = 50
    tasks[0]!.actualStart = '2026-10-01'
    const out = forecastSchedule({ tasks, links, statusDate: '2026-10-06' })
    expect(out.get('1')).toEqual({ start: '2026-10-01', finish: '2026-10-10' })
    expect(out.get('2')).toEqual({ start: '2026-10-12', finish: '2026-10-16' })
    expect(out.get('3')).toEqual({ start: '2026-10-16', finish: '2026-10-16' })
  })

  it('pushes successors when the running activity is behind', () => {
    const tasks = plan()
    tasks[0]!.percent = 30
    tasks[0]!.actualStart = '2026-10-01'
    // 7 of 10 days left from 2026-10-06 → finishes 2026-10-12, two days late.
    const out = forecastSchedule({ tasks, links, statusDate: '2026-10-06' })
    expect(out.get('1')).toEqual({ start: '2026-10-01', finish: '2026-10-12' })
    expect(out.get('2')).toEqual({ start: '2026-10-14', finish: '2026-10-18' })
    expect(out.get('3')!.start).toBe('2026-10-18')
  })

  it('pulls successors in when the activity finishes early', () => {
    const tasks = plan()
    tasks[0] = { ...tasks[0]!, percent: 100, actualStart: '2026-10-01', actualFinish: '2026-10-08' }
    const out = forecastSchedule({ tasks, links, statusDate: '2026-10-08' })
    expect(out.get('2')).toEqual({ start: '2026-10-10', finish: '2026-10-14' })
  })

  it('never starts unstarted work in the past and keeps the gap the plan left after the link', () => {
    const tasks = [task('a', '2026-09-01', '2026-09-05'), task('b', '2026-09-10', '2026-09-12')]
    // The link allows 2026-09-06; the plan starts b four days later.
    const out = forecastSchedule({ tasks, links: [fs('a', 'b')], statusDate: '2026-09-03' })
    expect(out.get('a')).toEqual({ start: '2026-09-03', finish: '2026-09-07' })
    expect(out.get('b')).toEqual({ start: '2026-09-12', finish: '2026-09-14' })
  })

  it('treats work reported before its recorded start as started by the status date', () => {
    const tasks = plan()
    tasks[1] = { ...tasks[1]!, percent: 20, actualStart: '2026-10-12' }
    // 4 of 5 days left from 2026-10-06.
    const out = forecastSchedule({ tasks, links, statusDate: '2026-10-06' })
    expect(out.get('2')).toEqual({ start: '2026-10-06', finish: '2026-10-09' })
  })

  it('moves an activity whose plan ignores a link only by its predecessors’ slip', () => {
    // b is planned to start 2 days before FS from a allows.
    const tasks = [task('a', '2026-10-01', '2026-10-10'), task('b', '2026-10-09', '2026-10-12')]
    const onPlan = forecastSchedule({ tasks, links: [fs('a', 'b')], statusDate: '2026-09-30' })
    expect(onPlan.get('b')).toEqual({ start: '2026-10-09', finish: '2026-10-12' })
    tasks[0] = { ...tasks[0]!, percent: 50, actualStart: '2026-10-01' }
    // a: 5 of 10 days left from 10-08 → ends 10-12, two days late → b two days late too.
    const late = forecastSchedule({ tasks, links: [fs('a', 'b')], statusDate: '2026-10-08' })
    expect(late.get('b')).toEqual({ start: '2026-10-11', finish: '2026-10-14' })
  })

  it('spans summaries over their children and survives dependency loops', () => {
    const tasks = [
      task('4', '2026-10-01', '2026-10-10', { isSummary: true }),
      task('4.1', '2026-10-01', '2026-10-05', { parentId: '4', percent: 100, actualStart: '2026-10-01', actualFinish: '2026-10-07' }),
      task('4.2', '2026-10-06', '2026-10-10', { parentId: '4' }),
    ]
    const loop: ForecastLink[] = [fs('4.1', '4.2'), { predecessorId: '4.2', successorId: '4.1', type: 'SS', lagDays: 0 }]
    const out = forecastSchedule({ tasks, links: loop, statusDate: '2026-10-07' })
    expect(out.get('4.2')).toEqual({ start: '2026-10-08', finish: '2026-10-12' })
    expect(out.get('4')).toEqual({ start: '2026-10-01', finish: '2026-10-12' })
  })
})
