import type { ScheduleAlertSeverity } from '@/lib/schedule/float-alerts'
import type { AlertQuadrant } from '@/lib/schedule/progress-alert-quadrant'

export type GanttBarTone =
  | 'negative'
  | 'critical'
  | 'near_critical'
  | 'fast_consumption'
  | 'progress_urgent'
  | 'progress_watch'
  | 'progress_soft'
  | 'progress_ok'
  | 'normal'

const SEVERITY_RANK: Record<ScheduleAlertSeverity, number> = {
  negative: 5,
  urgent: 4,
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

/** Color tone for Gantt bars from CPM/alerts + smart progress quadrant. */
export function resolveGanttBarTone(input: {
  isCritical?: boolean | null
  totalFloat?: number | null
  alertSeverity?: ScheduleAlertSeverity | null
  alertQuadrant?: AlertQuadrant | null
  nearCriticalDays?: number | null
}): GanttBarTone {
  if (input.alertSeverity === 'negative') return 'negative'

  const q = input.alertQuadrant
  if (q === 'urgent') return 'progress_urgent'
  if (q === 'normal_watch') return 'progress_watch'
  if (q === 'soft_notice') return 'progress_soft'
  // no_display: no special gantt color — fall through to float/critical rules only when needed
  if (q === 'no_display') return 'normal'

  if (input.alertSeverity === 'urgent') return 'progress_urgent'
  if (input.alertSeverity === 'critical') return 'critical'
  if (input.alertSeverity === 'near_critical') return 'near_critical'
  if (input.alertSeverity === 'fast_consumption') return 'fast_consumption'

  const tf = input.totalFloat
  if (tf != null && tf < 0) return 'negative'
  if (input.isCritical || tf === 0) return 'critical'
  const nearDays = input.nearCriticalDays ?? 5
  if (tf != null && tf > 0 && tf <= nearDays) return 'near_critical'
  return 'normal'
}

export function ganttBarClassName(tone: GanttBarTone): string {
  switch (tone) {
    case 'negative':
    case 'critical':
    case 'progress_urgent':
      return 'bg-rose-500 border-rose-600'
    case 'near_critical':
      return 'bg-amber-400 border-amber-500'
    case 'fast_consumption':
    case 'progress_soft':
      return 'bg-orange-400 border-orange-500'
    case 'progress_watch':
      return 'bg-sky-400 border-sky-600'
    case 'progress_ok':
      return 'bg-emerald-400 border-emerald-600'
    default:
      return 'bg-slate-400 border-slate-500'
  }
}

export function ganttBarShowsFloat(tone: GanttBarTone, totalFloat: number | null | undefined): boolean {
  if (
    tone === 'critical' ||
    tone === 'negative' ||
    tone === 'progress_urgent'
  ) {
    return false
  }
  return (totalFloat ?? 0) > 0
}
