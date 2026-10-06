import { describe, expect, it } from 'vitest'
import { buildPlanCompliance } from '@/features/project-manager/lib/plan-compliance'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import type { ProjectTask } from '@/shared/types/schedule'

function task(
  partial: Partial<ProjectTask> & Pick<ProjectTask, 'id' | 'name' | 'wbs_code'>
): ProjectTask {
  return {
    project_id: 'p1',
    msp_uid: null,
    outline_level: 1,
    is_summary: false,
    is_milestone: false,
    is_critical: false,
    duration_minutes: 480,
    start_planned: '2026-04-01T12:00:00.000Z',
    finish_planned: '2026-04-10T12:00:00.000Z',
    start_current: '2026-04-01T12:00:00.000Z',
    finish_current: '2026-04-10T12:00:00.000Z',
    baseline_start: null,
    baseline_finish: null,
    percent_complete: 0,
    schedule_weight: null,
    ...partial,
  } as ProjectTask
}

describe('compareWbs hierarchy', () => {
  it('places parent before its children', () => {
    expect(compareWbs('4', '4.1')).toBeLessThan(0)
    expect(compareWbs('5', '5.1')).toBeLessThan(0)
    expect(compareWbs('4.1', '4.2')).toBeLessThan(0)
  })
})

describe('buildPlanCompliance WBS order + weight', () => {
  it('lists parent then children and keeps MSP weight', () => {
    const tasks = [
      task({
        id: 'c',
        name: 'آرماتور',
        wbs_code: '4.1',
        start_current: '2026-03-01T12:00:00.000Z',
        start_planned: '2026-03-01T12:00:00.000Z',
        schedule_weight: 1.85,
      }),
      task({
        id: 'p',
        name: 'فونداسیون',
        wbs_code: '4',
        is_summary: true,
        start_current: '2026-04-01T12:00:00.000Z',
        start_planned: '2026-04-01T12:00:00.000Z',
        schedule_weight: 5.2,
      }),
      task({
        id: 'c2',
        name: 'بتن',
        wbs_code: '4.2',
        schedule_weight: 2.1,
      }),
    ]

    const result = buildPlanCompliance(tasks, {
      asOfDate: '2026-05-01',
      actualStart: '2026-03-01',
    })

    expect(result.allRows.map((r) => r.wbs)).toEqual(['4', '4.1', '4.2'])
    expect(result.allRows[0]?.scheduleWeight).toBe(5.2)
    expect(result.allRows[1]?.scheduleWeight).toBe(1.85)
    expect(result.allRows[1]?.depth).toBe(1)
  })
})
