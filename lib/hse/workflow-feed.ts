import {
  getCamera,
  getContractor,
  getZone,
  HSE_INCIDENTS,
} from '@/lib/hse/mock-data'
import type { HseIncident, Severity } from '@/lib/hse/types'

const SUPERVISOR_QUEUE_STATUSES = new Set([
  'confirmed',
  'escalated',
  'assigned',
])

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type SupervisorSafetyAction = {
  id: string
  code: string
  title: string
  severity: Severity
  status: HseIncident['status']
  zoneName: string
  cameraName: string
  contractorName: string | null
  detectedAt: string
  aiSummary: string
  href: string
}

export type PmWeeklySafetySummary = {
  weekLabel: string
  totalIncidents: number
  confirmedViolations: number
  falsePositives: number
  criticalOpen: number
  topZones: Array<{ name: string; count: number }>
  topContractors: Array<{ name: string; count: number }>
  openCorrectiveActions: number
  narrative: string[]
}

/** Incidents that should appear on the site supervisor action queue. */
export function getSupervisorSafetyActions(limit = 12): SupervisorSafetyAction[] {
  return [...HSE_INCIDENTS]
    .filter((i) => {
      if (SUPERVISOR_QUEUE_STATUSES.has(i.status)) return true
      // Critical new/acknowledged also need field attention
      if (
        (i.severity === 'critical' || i.severity === 'high') &&
        (i.status === 'new' || i.status === 'acknowledged' || i.status === 'ai_review')
      ) {
        return true
      }
      return false
    })
    .filter((i) => !i.falsePositive && i.status !== 'dismissed' && i.status !== 'closed')
    .sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity)
      if (sev !== 0) return sev
      return +new Date(b.detectedAt) - +new Date(a.detectedAt)
    })
    .slice(0, limit)
    .map((i) => toSupervisorAction(i))
}

export function getPmWeeklySafetySummary(now = new Date('2026-08-09T18:00:00Z')): PmWeeklySafetySummary {
  const end = now.getTime()
  const start = end - WEEK_MS
  const weekIncidents = HSE_INCIDENTS.filter((i) => {
    const t = +new Date(i.detectedAt)
    return t >= start && t <= end
  })

  const confirmed = weekIncidents.filter(
    (i) =>
      !i.falsePositive &&
      (i.status === 'confirmed' || i.status === 'escalated' || i.status === 'closed' || i.status === 'assigned')
  )
  const fps = weekIncidents.filter((i) => i.falsePositive || i.status === 'dismissed').length
  const criticalOpen = HSE_INCIDENTS.filter(
    (i) =>
      (i.severity === 'critical' || i.severity === 'high') &&
      !i.falsePositive &&
      i.status !== 'closed' &&
      i.status !== 'dismissed'
  ).length

  const zoneCounts = new Map<string, number>()
  const contractorCounts = new Map<string, number>()
  for (const i of confirmed) {
    const zone = getZone(i.zoneId)?.name ?? i.zoneId
    zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1)
    if (i.contractorId) {
      const name = getContractor(i.contractorId)?.name ?? i.contractorId
      contractorCounts.set(name, (contractorCounts.get(name) ?? 0) + 1)
    }
  }

  const topZones = [...zoneCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  const topContractors = [...contractorCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  let openCorrective = 0
  for (const i of HSE_INCIDENTS) {
    openCorrective += i.correctiveActions.filter((c) => c.status !== 'done').length
  }

  const narrative: string[] = [
    `در ۷ روز گذشته ${weekIncidents.length} رخداد ایمنی ثبت شد؛ ${confirmed.length} مورد به‌عنوان تخلف/ریسک واقعی مسیر اقدام گرفت.`,
    criticalOpen > 0
      ? `${criticalOpen} مورد بحرانی یا با شدت بالا هنوز باز است و نیاز به پیگیری میدانی دارد.`
      : 'در حال حاضر مورد بحرانی باز در صف اقدام نیست.',
    topZones[0]
      ? `پرریسک‌ترین زون هفته: «${topZones[0].name}» با ${topZones[0].count} مورد تأییدشده.`
      : 'توزیع زون‌ها در این هفته متوازن بوده است.',
  ]

  return {
    weekLabel: 'خلاصه هفتگی ایمنی (۷ روز اخیر)',
    totalIncidents: weekIncidents.length,
    confirmedViolations: confirmed.length,
    falsePositives: fps,
    criticalOpen,
    topZones,
    topContractors,
    openCorrectiveActions: openCorrective,
    narrative,
  }
}

function toSupervisorAction(i: HseIncident): SupervisorSafetyAction {
  return {
    id: i.id,
    code: i.code,
    title: i.title,
    severity: i.severity,
    status: i.status,
    zoneName: getZone(i.zoneId)?.name ?? i.zoneId,
    cameraName: getCamera(i.cameraId)?.name ?? i.cameraId,
    contractorName: i.contractorId ? getContractor(i.contractorId)?.name ?? null : null,
    detectedAt: i.detectedAt,
    aiSummary: i.aiSummary,
    href: `/dashboard/hse/incidents/${i.id}`,
  }
}

function severityRank(s: Severity): number {
  switch (s) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'medium':
      return 2
    default:
      return 1
  }
}
