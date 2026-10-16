/**
 * @file features/schedule-intelligence/lib/risk-analyzer.ts
 * @purpose منطق دامنه — تحلیل کیفیت برنامه و آپلود MSP (risk-analyzer)
 * @safe-to-edit CAREFUL
 * @affects تحلیل کیفیت برنامه و آپلود MSP
 * @depends-on shared/types/schedule-intelligence
 */

import type {
import { SCHEDULE_LIB_COPY as L } from '@/features/schedule-intelligence/lib/config'
RiskLevel,
ScheduleAnalysisConfig,
ScheduleTask,
ScheduleWarning,
} from '@/shared/types/schedule-intelligence'

function riskLevelFromScore(score: number, config: ScheduleAnalysisConfig): RiskLevel {
  if (score >= config.riskThresholds.high) return 'very-high'
  if (score >= config.riskThresholds.medium) return 'high'
  if (score >= config.riskThresholds.low) return 'medium'
  return 'low'
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const below = sorted.filter((v) => v < value).length
  return (below / sorted.length) * 100
}

export function analyzeActivityRisk(
  task: ScheduleTask,
  allLeafDurations: number[],
  maxDownstream: number,
  maxOutdegree: number,
  config: ScheduleAnalysisConfig,
  taskWarnings: ScheduleWarning[]
): { score: number; level: RiskLevel; reasons: string[] } {
  const w = config.riskWeights
  const reasons: string[] = []
  let score = 0

  // A. Criticality
  if (task.calculatedCritical) {
    score += w.criticality
    reasons.push(L.riskOnCritical)
  } else if (task.nearCritical) {
    score += w.criticality * 0.6
    reasons.push(L.riskNearCritical)
  }

  // B. Float
  const tf = task.totalFloatMinutes
  const nearMin = config.nearCriticalFloatDays * 480
  if (tf != null) {
    if (tf < 0) {
      score += w.float
      reasons.push(L.riskNegativeFloat)
    } else if (tf <= 0) {
      score += w.float * 0.95
      reasons.push(L.riskZeroFloat)
    } else if (tf <= 5 * config.minutesPerDay) {
      score += w.float * 0.75
      reasons.push(L.riskFloatUnder5)
    } else if (tf <= nearMin) {
      score += w.float * 0.45
      reasons.push(L.riskFloatNear)
    }
  }

  // C. Duration percentile
  if (!task.isSummary && allLeafDurations.length > 0) {
    const pct = percentileRank(allLeafDurations, task.durationMinutes)
    if (pct >= 90) {
      score += w.duration
      reasons.push(L.riskDurationP90)
    } else if (pct >= 75) {
      score += w.duration * 0.6
      reasons.push(L.riskDurationP75)
    }
  }

  // D. Dependency centrality
  if (maxOutdegree > 0 && task.outdegree >= maxOutdegree * 0.8 && task.outdegree >= 3) {
    score += w.dependency * 0.8
    reasons.push(L.riskManySuccessors)
  }
  if (maxDownstream > 0 && task.downstreamReach >= maxDownstream * 0.7 && task.downstreamReach >= 5) {
    score += w.dependency * 0.6
    reasons.push(L.riskManyDownstream)
  }

  // E. Status / slippage
  if (task.startTimingLabel === 'overdue' && task.status === 'not-started') {
    score += w.status
    reasons.push(L.riskShouldHaveStarted)
  }
  if (task.status === 'in-progress' && task.finish) {
    const finishMs = new Date(task.finish).getTime()
    if (finishMs < Date.now() && task.percentComplete < 100) {
      score += w.status * 0.85
      reasons.push(L.riskPastFinish)
    }
  }

  // F. Data quality
  const dataIssues = taskWarnings.filter((w) => w.taskUid === task.uid)
  if (dataIssues.some((w) => w.severity === 'error')) {
    score += w.dataQuality
    reasons.push(L.riskValidationError)
  }

  if (!task.start || !task.finish) {
    score += w.dataQuality * 0.5
    reasons.push(L.riskMissingDates)
  }

  const capped = Math.min(100, Math.round(score))
  return { score: capped, level: riskLevelFromScore(capped, config), reasons }
}

export function analyzeBottleneckScore(task: ScheduleTask, config: ScheduleAnalysisConfig): number {
  let score = 0
  if (task.calculatedCritical) score += 35
  else if (task.nearCritical) score += 20
  const tf = task.totalFloatMinutes
  if (tf != null && tf <= 0) score += 25
  else if (tf != null && tf <= config.nearCriticalFloatDays * config.minutesPerDay) score += 15
  score += Math.min(20, task.outdegree * 3)
  score += Math.min(15, Math.round(task.downstreamReach / 2))
  if (task.startTimingLabel === 'overdue') score += 15
  if (task.status === 'in-progress') score += 5
  task.bottleneckScore = Math.min(100, score)
  return task.bottleneckScore
}

export function runRiskAnalysis(
  tasks: ScheduleTask[],
  warnings: ScheduleWarning[],
  config: ScheduleAnalysisConfig
): void {
  const leaves = tasks.filter((t) => !t.isSummary)
  const durations = leaves.map((t) => t.durationMinutes)
  const maxDown = Math.max(0, ...leaves.map((t) => t.downstreamReach))
  const maxOut = Math.max(0, ...leaves.map((t) => t.outdegree))

  for (const task of tasks) {
    if (task.isSummary) continue
    const taskWarnings = warnings.filter((w) => w.taskUid === task.uid)
    const { score, level, reasons } = analyzeActivityRisk(
      task,
      durations,
      maxDown,
      maxOut,
      config,
      taskWarnings
    )
    task.riskScore = score
    task.riskLevel = level
    task.riskReasons = reasons
    analyzeBottleneckScore(task, config)
  }
}
