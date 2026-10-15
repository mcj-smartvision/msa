import type { EvmIndices } from './derive'
import { TASK_COLUMNS, type TaskItem } from './schema'
import type { WeekPpc } from './weekly-engine'

export interface StoreExport {
  projectId: string | null
  exportedAt: string
  today: string | null
  weekStart: string | null
  weeklyPpc: WeekPpc | null
  evm: Omit<EvmIndices, 'cost'> | null
  tasks: TaskItem[]
}

function cell(task: TaskItem, key: keyof TaskItem): string {
  const value = task[key]
  if (value == null) return ''
  if (key === 'daily_logs') {
    return Object.entries(value as Record<string, number>)
      .map(([date, gain]) => `${date}:${gain}`)
      .join(' ')
  }
  return String(value)
}

const quote = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** One row per task, one column per `TASK_COLUMNS` entry; UTF-8 with BOM so Excel reads Persian. */
export function exportStoreToCSV(tasks: TaskItem[]): string {
  const header = TASK_COLUMNS.map((c) => quote(`${c.label} (${String(c.key)})`)).join(',')
  const rows = tasks.map((t) => TASK_COLUMNS.map((c) => quote(cell(t, c.key))).join(','))
  return `\uFEFF${[header, ...rows].join('\r\n')}`
}

export function exportStoreToJSON(data: StoreExport): string {
  return JSON.stringify(data, null, 2)
}

export function downloadText(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
