import { solveEarnedSchedule } from '@/features/project-controls/lib/earned-schedule'
import { ROOT_CAUSE_CATEGORIES, ROOT_CAUSE_FA, type RootCauseCategory } from '@/features/wwp/lib/policy'
import type { PVCurvePoint } from '@/shared/types/project-controls'
import type { ManagerCurvePoint } from './overview-types'

/** Common Last Planner target; PPC below it is "under target". */
export const PPC_TARGET = 80
export const PPC_LOW = 60
export const PPC_HISTORY_WEEKS = 10
export const RNC_WINDOW_WEEKS = 4

export interface WwpWeekRow {
  wwpId: string
  weekNumber: number
  start: string
  end: string
  planned: number
  completed: number
}

export interface WwpCommitmentRow {
  wwpId: string
  description: string
  wbs: string | null
  isCompleted: boolean | null
  rootCause: string | null
  rootCauseNote: string | null
  plannedOutput: number | null
  actualOutput: number | null
  sortOrder: number
}

export interface PpcWeek extends Omit<WwpWeekRow, 'wwpId'> {
  ppc: number | null
  /** The running week, scored with today's progress until its Thursday ends. */
  live?: boolean
}

export interface WeekCommitment {
  description: string
  wbs: string | null
  completed: boolean
  rootCause: RootCauseCategory | null
  rootCauseLabel: string | null
  rootCauseNote: string | null
  /** actual ÷ planned output, only when both were recorded. */
  progressPercent: number | null
  /** Schedule-based commitments: required cumulative percent by Thursday and the reported cumulative. */
  targetPercent?: number
  actualPercent?: number
}

export interface RncCause {
  key: RootCauseCategory
  label: string
  count: number
  share: number
}

export interface WeeklyCommitmentsData {
  /** `schedule`: commitments are the schedule's planned work; `wwp`: committed weekly work plans. */
  source: 'schedule' | 'wwp'
  target: number
  /** Closed weeks, oldest first (at most PPC_HISTORY_WEEKS). */
  weeks: PpcWeek[]
  current: (PpcWeek & { commitments: WeekCommitment[] }) | null
  previousPpc: number | null
  /** Σ completed ÷ Σ planned over the last RNC_WINDOW_WEEKS closed weeks. */
  average4: number | null
  rnc: { weeks: number; total: number; causes: RncCause[]; top3Share: number | null }
}

export type WeeklyCommitmentsResult = { status: 'ok'; data: WeeklyCommitmentsData } | { status: 'missing'; reason_fa: string }

export const ppcOf = (planned: number, completed: number) => (planned > 0 ? (completed / planned) * 100 : null)

function asRootCause(value: string | null): RootCauseCategory | null {
  return value && (ROOT_CAUSE_CATEGORIES as readonly string[]).includes(value) ? (value as RootCauseCategory) : null
}

/** PPC = completed ÷ committed of each CLOSED week; a partly done commitment counts as not done. */
export function buildWeeklyCommitments(weekRows: WwpWeekRow[], commitmentRows: WwpCommitmentRow[]): WeeklyCommitmentsData {
  const sorted = [...weekRows].sort((a, b) => a.start.localeCompare(b.start)).slice(-PPC_HISTORY_WEEKS)
  const weeks: PpcWeek[] = sorted.map(({ wwpId: _id, ...w }) => ({ ...w, ppc: ppcOf(w.planned, w.completed) }))

  const last = sorted[sorted.length - 1] ?? null
  const current = last
    ? {
        ...weeks[weeks.length - 1]!,
        commitments: commitmentRows
          .filter((c) => c.wwpId === last.wwpId)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map<WeekCommitment>((c) => {
            const cause = asRootCause(c.rootCause)
            return {
              description: c.description,
              wbs: c.wbs,
              completed: c.isCompleted === true,
              rootCause: cause,
              rootCauseLabel: cause ? ROOT_CAUSE_FA[cause] : null,
              rootCauseNote: c.rootCauseNote,
              progressPercent:
                c.isCompleted === true
                  ? 100
                  : c.plannedOutput != null && c.plannedOutput > 0 && c.actualOutput != null
                    ? Math.min(100, Math.max(0, (c.actualOutput / c.plannedOutput) * 100))
                    : null,
            }
          })
          .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.progressPercent ?? 0) - (b.progressPercent ?? 0)),
      }
    : null

  const window = sorted.slice(-RNC_WINDOW_WEEKS)
  const planned4 = window.reduce((s, w) => s + w.planned, 0)
  const completed4 = window.reduce((s, w) => s + w.completed, 0)
  const windowIds = new Set(window.map((w) => w.wwpId))

  const counts = new Map<RootCauseCategory, number>()
  for (const c of commitmentRows) {
    if (!windowIds.has(c.wwpId) || c.isCompleted !== false) continue
    const cause = asRootCause(c.rootCause) ?? 'other'
    counts.set(cause, (counts.get(cause) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0)
  const causes = [...counts.entries()]
    .map(([key, count]) => ({ key, label: ROOT_CAUSE_FA[key], count, share: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
  const top3 = causes.slice(0, 3).reduce((s, c) => s + c.count, 0)

  return {
    source: 'wwp',
    target: PPC_TARGET,
    weeks,
    current,
    previousPpc: weeks.length >= 2 ? weeks[weeks.length - 2]!.ppc : null,
    average4: ppcOf(planned4, completed4),
    rnc: { weeks: window.length, total, causes, top3Share: total > 0 ? (top3 / total) * 100 : null },
  }
}

export type PpcTone = 'good' | 'warn' | 'bad'

export function ppcTone(ppc: number, target = PPC_TARGET): PpcTone {
  if (ppc >= target) return 'good'
  if (ppc >= PPC_LOW) return 'warn'
  return 'bad'
}

/** SPI and SPI(t): ≥ 1 on plan, 0.9–1 slightly behind, below 0.9 behind. */
export function indexTone(value: number): PpcTone {
  if (value >= 1) return 'good'
  if (value >= 0.9) return 'warn'
  return 'bad'
}

const DAY_MS = 86_400_000
const daysBetween = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS

/**
 * SPI = earned ÷ planned and SPI(t) = ES ÷ AT at every recorded S-curve point before today, oldest first.
 * ES is solved on the same baseline PV curve as the KPI card; the caller appends today's card value.
 */
export function indexHistoryFromCurve(input: {
  points: ManagerCurvePoint[]
  pvCurve: PVCurvePoint[] | null
  projectStart: string | null
  plannedDuration: number | null
  daysPerUnit: number
  today: string
}): { spi: number[]; spiT: number[] } {
  const past = input.points
    .filter((p) => p.earned != null && p.date < input.today && (p.kind === 'record' || p.kind === 'month'))
    .sort((a, b) => a.date.localeCompare(b.date))

  const spi = past.filter((p) => p.planned > 0).map((p) => (p.earned as number) / p.planned)

  const spiT: number[] = []
  const { pvCurve, projectStart, plannedDuration } = input
  if (pvCurve?.length && projectStart && plannedDuration && plannedDuration > 0) {
    for (const p of past) {
      const at = daysBetween(projectStart, p.date) / input.daysPerUnit
      if (!(at > 0)) continue
      try {
        spiT.push(solveEarnedSchedule(pvCurve, p.earned as number, plannedDuration).es / at)
      } catch {
        break
      }
    }
  }
  return { spi, spiT }
}
