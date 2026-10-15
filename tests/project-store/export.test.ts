import { describe, expect, it } from 'vitest'
import { exportStoreToCSV } from '@/features/project-store/lib/export'
import { TASK_COLUMNS, type TaskItem } from '@/features/project-store/lib/schema'

const task: TaskItem = {
  id: 'schedule:1',
  kind: 'schedule',
  wbs: '1.2',
  title: 'بتن‌ریزی، طبقه "اول"',
  weight: 2.5,
  planned_progress: 40,
  actual_progress: 35,
  weekly_target: 10,
  daily_logs: { '2026-10-04': 3, '2026-10-05': 2 },
  weekly_actual_sum: 5,
  ppc_status: 0,
  rnc_reason: 'materials',
  budget: null,
  baseline_start: '2026-09-01',
  baseline_finish: '2026-11-01',
  window_start: null,
  window_finish: null,
  last_report_date: '2026-10-05',
  unsynced: false,
}

describe('exportStoreToCSV', () => {
  it('writes a BOM, one column per registry entry and quotes text safely', () => {
    const csv = exportStoreToCSV([task])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const [header, row] = csv.slice(1).split('\r\n')
    expect(header!.split(',')).toHaveLength(TASK_COLUMNS.length)
    expect(row).toContain('"بتن‌ریزی، طبقه ""اول"""')
    expect(row).toContain('2026-10-04:3 2026-10-05:2')
    expect(row!.endsWith(',2026-10-04:3 2026-10-05:2')).toBe(true)
  })
})
