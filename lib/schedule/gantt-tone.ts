import type { ScheduleAlertSeverity } from '@/lib/schedule/float-alerts'

export type GanttBarTone =
  | 'negative'
  | 'critical'
  | 'near_critical'
  | 'fast_consumption'
  | 'normal'

const SEVERITY_RANK: Record<ScheduleAlertSeverity, number> = {
  negative: 4,
  critical: 3,
  near_critical: 2,
  fast_consumption: 1,
}

export function pickHighestAlertSeverity(
  severities: ScheduleAlertSeverity[]
): ScheduleAlertSeverity | null {
  let best: ScheduleAlertSeverity | null = null
  let rank = 0
  for (const s of severities) {
    const r = SEVERITY_RANK[s] ?? 0
    if (r > rank) {
      rank = r
      best = s
    }
  }
  return best
}

/** Color tone for Gantt bars from CPM/alerts. */
export function resolveGanttBarTone(input: {
  isCritical?: boolean | null
  totalFloat?: number | null
  alertSeverity?: ScheduleAlertSeverity | null
}): GanttBarTone {
  if (input.alertSeverity === 'negative') return 'negative'
  if (input.alertSeverity === 'critical') return 'critical'
  if (input.alertSeverity === 'near_critical') return 'near_critical'
  if (input.alertSeverity === 'fast_consumption') return 'fast_consumption'

  const tf = input.totalFloat
  if (tf != null && tf < 0) return 'negative'
  if (input.isCritical || tf === 0) return 'critical'
  if (tf != null && tf > 0 && tf <= 5) return 'near_critical'
  return 'normal'
}

export function ganttBarClassName(tone: GanttBarTone): string {
  switch (tone) {
    case 'negative':
    case 'critical':
      return 'bg-rose-500 border-rose-600'
    case 'near_critical':
      return 'bg-amber-400 border-amber-500'
    case 'fast_consumption':
      return 'bg-orange-500 border-orange-600'
    default:
      return 'bg-slate-400 border-slate-500'
  }
}

export function ganttBarShowsFloat(tone: GanttBarTone, totalFloat: number | null | undefined): boolean {
  if (tone === 'critical' || tone === 'negative') return false
  return (totalFloat ?? 0) > 0
}
