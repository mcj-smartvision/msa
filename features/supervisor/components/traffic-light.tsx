import { cn } from '@/shared/lib/utils';
import type { ReadinessLevel } from '@/features/supervisor/lib/types';

const colors: Record<ReadinessLevel, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
}

export function TrafficLight({ level, label }: { level: ReadinessLevel; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={label}>
      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', colors[level])} />
      {label ? <span className="text-muted-foreground">{label}</span> : null}
    </span>
  )
}

export function ReadinessDots({
  readiness,
  labels,
}: {
  readiness: { materials: ReadinessLevel; manpower: ReadinessLevel; access: ReadinessLevel }
  labels: { materials: string; manpower: string; access: string }
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <TrafficLight level={readiness.materials} label={labels.materials} />
      <TrafficLight level={readiness.manpower} label={labels.manpower} />
      <TrafficLight level={readiness.access} label={labels.access} />
    </div>
  )
}
