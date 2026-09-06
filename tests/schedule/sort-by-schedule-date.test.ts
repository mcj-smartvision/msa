import { describe, expect, it } from 'vitest'
import { formatLagDaysSuffix, formatPredLabel } from '@/lib/schedule/predecessor-format'
import { sortTasksForSchedulePreview } from '@/lib/schedule/task-view-date'
import type { ProjectTask } from '@/types/schedule'

const task = (
  partial: Pick<
    ProjectTask,
    'id' | 'name' | 'wbs_code' | 'start_planned' | 'finish_planned' | 'msp_uid'
  >
): ProjectTask => ({
  project_id: 'p1',
  start_current: null,
  finish_current: null,
  baseline_start: null,
  baseline_finish: null,
  percent_complete: 0,
  is_critical: false,
  created_at: '',
  updated_at: '',
  ...partial,
})

describe('predecessor lag display', () => {
  it('converts MSP minutes to working days', () => {
    expect(formatLagDaysSuffix(960)).toBe('+2d')
    expect(formatLagDaysSuffix(1080)).toBe('+2d') // 2.25 days → nearest 2
    expect(formatLagDaysSuffix(1620)).toBe('+3d')
    expect(formatLagDaysSuffix(-2160)).toBe('-4d') // 4.5 days → JS Math.round(-4.5) = -4
    expect(formatLagDaysSuffix(0)).toBe('')
    expect(formatPredLabel('4.9', 'SS', 960)).toBe('4.9SS+2d')
  })
})

describe('sortTasksForSchedulePreview', () => {
  it('keeps predecessors before successors even when start dates are close', () => {
    const a = task({
      id: 'a',
      name: 'Pred',
      wbs_code: '12.3',
      msp_uid: 78,
      start_planned: '2026-10-07',
      finish_planned: '2026-10-26',
    })
    const b = task({
      id: 'b',
      name: 'Succ',
      wbs_code: '10.7',
      msp_uid: 69,
      start_planned: '2026-10-07',
      finish_planned: '2026-11-08',
    })
    const c = task({
      id: 'c',
      name: 'Other earlier',
      wbs_code: '10.6',
      msp_uid: 68,
      start_planned: '2026-10-06',
      finish_planned: '2026-10-20',
    })

    const sorted = sortTasksForSchedulePreview([b, a, c], {
      [b.id]: '12.3FS, 10.6FS',
      [a.id]: '10.4FS',
      [c.id]: '10.4FS',
    })

    expect(sorted.map((t) => t.wbs_code)).toEqual(['10.6', '12.3', '10.7'])
  })
})
