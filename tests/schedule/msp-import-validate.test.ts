import { describe, expect, it } from 'vitest'
import { validateMspImport } from '@/features/schedule/lib/msp-import-validate'
import type { MspParsedDependency, MspParsedTask } from '@/features/schedule/lib/msp-import'

function task(partial: Partial<MspParsedTask> & Pick<MspParsedTask, 'msp_uid' | 'name'>): MspParsedTask {
  return {
    wbs_code: null,
    start_planned: null,
    finish_planned: null,
    percent_complete: 0,
    is_critical: false,
    is_summary: false,
    schedule_weight: null,
    ...partial,
  }
}

describe('validateMspImport', () => {
  it('blocks on dependency cycles and names activities', () => {
    const tasks = [
      task({ msp_uid: 1, name: 'A', wbs_code: '1', duration_days: 1 }),
      task({ msp_uid: 2, name: 'B', wbs_code: '2', duration_days: 1 }),
    ]
    const deps: MspParsedDependency[] = [
      {
        predecessor_uid: 1,
        successor_uid: 2,
        relation_type: 'FS',
        lag_duration: 0,
      },
      {
        predecessor_uid: 2,
        successor_uid: 1,
        relation_type: 'FS',
        lag_duration: 0,
      },
    ]
    const report = validateMspImport(tasks, deps)
    expect(report.hasCycle).toBe(true)
    expect(report.blocked).toBe(true)
    expect(report.issues.some((i) => i.code === 'CYCLE')).toBe(true)
    expect(report.issues.find((i) => i.code === 'CYCLE')?.message).toMatch(/A|B/)
  })

  it('flags percent lag as warning without blocking', () => {
    const tasks = [
      task({ msp_uid: 1, name: 'A', wbs_code: '1', duration_days: 5 }),
      task({ msp_uid: 2, name: 'B', wbs_code: '2', duration_days: 5 }),
    ]
    const deps: MspParsedDependency[] = [
      {
        predecessor_uid: 1,
        successor_uid: 2,
        relation_type: 'FS',
        lag_duration: 0,
        lag_is_percentage: true,
        lag_days: 10,
      },
    ]
    const report = validateMspImport(tasks, deps)
    expect(report.blocked).toBe(false)
    expect(report.percentLagCount).toBe(1)
    expect(report.issues.some((i) => i.code === 'PERCENT_LAG')).toBe(true)
  })

  it('reports duplicate WBS and open ends', () => {
    const tasks = [
      task({
        msp_uid: 1,
        name: 'Parent',
        wbs_code: '1',
        is_summary: true,
        physical_weight: 10,
      }),
      task({
        msp_uid: 2,
        name: 'Leaf early',
        wbs_code: '1.1',
        physical_weight: 4,
        finish_planned: '2024-01-01',
      }),
      task({
        msp_uid: 3,
        name: 'Leaf late',
        wbs_code: '1.1',
        physical_weight: 6,
        finish_planned: '2024-02-01',
      }),
    ]
    const report = validateMspImport(tasks, [])
    expect(report.duplicateWbsCount).toBe(1)
    expect(report.openEndCount).toBeGreaterThanOrEqual(1)
    expect(report.issues.some((i) => i.code === 'DUPLICATE_WBS')).toBe(true)
  })

  it('reports parent weight mismatch and leaf total ≠ 100', () => {
    const tasks = [
      task({
        msp_uid: 1,
        name: 'Parent',
        wbs_code: '1',
        is_summary: true,
        physical_weight: 50,
      }),
      task({
        msp_uid: 2,
        name: 'Child',
        wbs_code: '1.1',
        physical_weight: 10,
        finish_planned: '2024-03-01',
      }),
    ]
    const report = validateMspImport(tasks, [])
    expect(report.issues.some((i) => i.code === 'WEIGHT_PARENT_MISMATCH')).toBe(true)
    expect(report.issues.some((i) => i.code === 'WEIGHT_LEAF_TOTAL')).toBe(true)
  })
})
