/**
 * @file features/project-store/lib/schema.ts
 * @purpose منطق دامنه — ذخیره پیشرفت و overlay اعداد داشبورد (schema)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on nothing
 */

/**
 * Standard activity record of the project store. `id` is the only key between views: the daily-report
 * activity id (`schedule:<project_tasks.id>` or `package:<workshop_packages.id>`). Database column names
 * (percent_complete, physical_weight, name, …) are mapped to these names once, in `derive.ts`.
 */
export interface TaskItem {
  id: string
  kind: 'schedule' | 'package'
  wbs: string
  title: string
  /** Activity weight (WF, percent points of the project). */
  weight: number
  /** Approved baseline planned percent as of today (the PV basis). */
  planned_progress: number
  /** Cumulative physical progress: the latest daily report, else the stored schedule percent. The only reference value. */
  actual_progress: number

  /** This week's planned share (Saturday–Thursday), from the forecast window frozen on Saturday. */
  weekly_target: number
  /** Gain of each reported day, keyed by ISO date. */
  daily_logs: Record<string, number>
  /** Gain reported this week. */
  weekly_actual_sum: number
  /** 1 when the week's gain reaches its target, 0 for any shortfall; null without a commitment or before Thursday 16:00. */
  ppc_status: 0 | 1 | null
  /** Root cause category recorded for a missed commitment of this week. */
  rnc_reason?: string
  rnc_note?: string

  /** Activity budget (BAC share, Toman); null for users without cost access. */
  budget: number | null
  baseline_start: string | null
  baseline_finish: string | null
  /** Forecast window this week's commitment was frozen from. */
  window_start: string | null
  window_finish: string | null
  last_report_date: string | null
  /** Has unsaved changes in the store. */
  unsynced: boolean
}

export type TaskColumnUnit = 'text' | 'percent' | 'points' | 'weight' | 'toman' | 'date' | 'binary' | 'flag' | 'logs'

export interface TaskColumn {
  key: keyof TaskItem
  label: string
  unit: TaskColumnUnit
}

/**
 * Columns of the inspector table and the JSON / CSV export. A new field is supported everywhere by
 * adding it to `TaskItem`, deriving it in `derive.ts` and listing it here.
 */
export const TASK_COLUMNS: readonly TaskColumn[] = [
  { key: 'id', label: 'شناسه', unit: 'text' },
  { key: 'wbs', label: 'WBS', unit: 'text' },
  { key: 'title', label: 'عنوان', unit: 'text' },
  { key: 'kind', label: 'نوع', unit: 'text' },
  { key: 'weight', label: 'وزن', unit: 'weight' },
  { key: 'planned_progress', label: 'پیشرفت برنامه‌ای', unit: 'percent' },
  { key: 'actual_progress', label: 'پیشرفت واقعی', unit: 'percent' },
  { key: 'weekly_target', label: 'تعهد هفته', unit: 'points' },
  { key: 'weekly_actual_sum', label: 'تحقق هفته', unit: 'points' },
  { key: 'ppc_status', label: 'PPC', unit: 'binary' },
  { key: 'rnc_reason', label: 'علت عدم تحقق', unit: 'text' },
  { key: 'rnc_note', label: 'توضیح علت', unit: 'text' },
  { key: 'budget', label: 'بودجه', unit: 'toman' },
  { key: 'baseline_start', label: 'شروع مبنا', unit: 'date' },
  { key: 'baseline_finish', label: 'پایان مبنا', unit: 'date' },
  { key: 'window_start', label: 'شروع پنجرهٔ هفته', unit: 'date' },
  { key: 'window_finish', label: 'پایان پنجرهٔ هفته', unit: 'date' },
  { key: 'last_report_date', label: 'آخرین گزارش', unit: 'date' },
  { key: 'unsynced', label: 'ذخیره‌نشده', unit: 'flag' },
  { key: 'daily_logs', label: 'لاگ روزانه', unit: 'logs' },
]
