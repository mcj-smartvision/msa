/**
 * @file features/hse/components/badges.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (badges)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on shared/lib/utils, features/hse/lib/types, features/hse/config
 */

import { cn } from '@/shared/lib/utils'
import type { CameraHealth, IncidentStatus, Severity, ZoneRisk } from '@/features/hse/lib/types'
import { HSE_BADGE_COPY } from '@/features/hse/config'

const severityLabel: Record<Severity, string> = HSE_BADGE_COPY.severity
const statusLabel: Record<IncidentStatus, string> = HSE_BADGE_COPY.status
const healthLabel: Record<CameraHealth, string> = HSE_BADGE_COPY.health
const riskLabel: Record<ZoneRisk, string> = HSE_BADGE_COPY.risk

const severityClass: Record<Severity, string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-amber-100 text-amber-900 border-amber-300',
  low: 'bg-slate-100 text-slate-700 border-slate-300',
}

const statusClass: Record<IncidentStatus, string> = {
  new: 'bg-sky-100 text-sky-800 border-sky-300',
  acknowledged: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  ai_review: 'bg-violet-100 text-violet-800 border-violet-300',
  confirmed: 'bg-rose-100 text-rose-800 border-rose-300',
  dismissed: 'bg-slate-100 text-slate-600 border-slate-300',
  escalated: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  assigned: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  closed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

const healthClass: Record<CameraHealth, string> = {
  online: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  degraded: 'bg-amber-100 text-amber-900 border-amber-300',
  offline: 'bg-rose-100 text-rose-800 border-rose-300',
  calibrating: 'bg-sky-100 text-sky-800 border-sky-300',
}

const riskClass: Record<ZoneRisk, string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-amber-100 text-amber-900 border-amber-300',
  low: 'bg-slate-100 text-slate-700 border-slate-300',
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold',
        className
      )}
    >
      {children}
    </span>
  )
}

export function SeverityBadge({ value }: { value: Severity }) {
  return <Pill className={severityClass[value]}>{severityLabel[value]}</Pill>
}

export function StatusBadge({ value }: { value: IncidentStatus }) {
  return <Pill className={statusClass[value]}>{statusLabel[value]}</Pill>
}

export function HealthBadge({ value }: { value: CameraHealth }) {
  return <Pill className={healthClass[value]}>{healthLabel[value]}</Pill>
}

export function RiskBadge({ value }: { value: ZoneRisk }) {
  return <Pill className={riskClass[value]}>{riskLabel[value]}</Pill>
}

export { severityLabel, statusLabel, healthLabel, riskLabel }
