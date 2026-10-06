import type { ScheduleTask } from '@/shared/types/schedule-intelligence'

export function exportTasksToCsv(tasks: ScheduleTask[], minutesPerDay: number): string {
  const headers = [
    'UID',
    'Name',
    'WBS',
    'Start',
    'Finish',
    'DurationDays',
    'PercentComplete',
    'Status',
    'TotalFloatDays',
    'Critical',
    'RiskScore',
    'RiskLevel',
    'Predecessors',
    'Successors',
  ]
  const rows = tasks.map((t) => [
    t.uid,
    `"${t.name.replace(/"/g, '""')}"`,
    t.wbs ?? '',
    t.start ?? '',
    t.finish ?? '',
    String(t.durationDays),
    String(t.percentComplete),
    t.status,
    t.totalFloatMinutes != null
      ? String(Math.round((t.totalFloatMinutes / minutesPerDay) * 100) / 100)
      : '',
    t.calculatedCritical ? '1' : '0',
    String(t.riskScore ?? ''),
    t.riskLevel ?? '',
    String(t.indegree),
    String(t.outdegree),
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export function exportAnalysisJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}
