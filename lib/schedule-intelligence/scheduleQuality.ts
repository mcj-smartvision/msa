import type {
  ActivityStatus,
  NormalizedSchedule,
  ScheduleAnalysisConfig,
  ScheduleTask,
  ScheduleWarning,
  StartTimingLabel,
} from '@/types/schedule-intelligence'
import { calendarDaysBetween, workingDaysBetween } from '@/lib/schedule-intelligence/dateUtils'
import { durationDaysFromMinutes } from '@/lib/schedule-intelligence/durationUtils'

export function deriveActivityStatus(task: ScheduleTask): ActivityStatus {
  if (task.percentComplete >= 100 || task.actualFinish) return 'completed'
  if (task.percentComplete > 0 && task.percentComplete < 100) return 'in-progress'
  if (task.percentComplete === 0 && !task.actualStart) return 'not-started'
  if (task.actualStart && !task.actualFinish) return 'in-progress'
  return 'unknown'
}

export function deriveRemainingMinutes(task: ScheduleTask, minutesPerDay: number): number {
  if (task.remainingDurationMinutes != null) return Math.max(0, task.remainingDurationMinutes)
  if (task.percentComplete >= 100) return 0
  const elapsed = Math.round((task.percentComplete / 100) * task.durationMinutes)
  return Math.max(0, task.durationMinutes - elapsed)
}

export function deriveStartTiming(
  task: ScheduleTask,
  analysisDate: string,
  config: ScheduleAnalysisConfig
): { label: StartTimingLabel; calendarDays: number | null; workingDays: number | null } {
  const status = task.status
  if (status === 'completed') {
    return { label: 'completed', calendarDays: null, workingDays: null }
  }
  if (status === 'in-progress' || task.actualStart) {
    return { label: 'already-started', calendarDays: null, workingDays: null }
  }
  if (!task.start) {
    return { label: 'starts-later', calendarDays: null, workingDays: null }
  }

  const cal = calendarDaysBetween(analysisDate, task.start.slice(0, 10), config.timezonePolicy)
  const work = workingDaysBetween(analysisDate, task.start.slice(0, 10), config)

  let label: StartTimingLabel
  if (cal < 0) label = 'overdue'
  else if (cal === 0) label = 'starts-today'
  else if (cal <= 7) label = 'starts-within-7'
  else if (cal <= 30) label = 'starts-within-30'
  else label = 'starts-later'

  return { label, calendarDays: cal, workingDays: work }
}

export function validateScheduleQuality(
  schedule: NormalizedSchedule,
  config: ScheduleAnalysisConfig
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [...schedule.warnings]
  const depKeys = new Set<string>()

  for (const task of schedule.tasks) {
    if (!task.isSummary && task.durationMinutes === 0 && task.percentComplete < 100) {
      warnings.push({
        code: 'ZERO_DURATION',
        severity: 'info',
        message: 'فعالیت با مدت صفر (احتمالاً milestone)',
        taskUid: task.uid,
        taskName: task.name,
      })
    }

    if (task.start && task.finish) {
      const s = new Date(task.start).getTime()
      const f = new Date(task.finish).getTime()
      if (f < s) {
        warnings.push({
          code: 'FINISH_BEFORE_START',
          severity: 'error',
          message: 'تاریخ پایان قبل از تاریخ شروع',
          taskUid: task.uid,
          taskName: task.name,
        })
      }
    }

    if (task.percentComplete < 0 || task.percentComplete > 100) {
      warnings.push({
        code: 'INVALID_PERCENT',
        severity: 'warning',
        message: 'درصد پیشرفت نامعتبر',
        taskUid: task.uid,
        taskName: task.name,
      })
    }

    if (!task.isSummary && task.predecessors.length === 0) {
      warnings.push({
        code: 'OPEN_START',
        severity: 'info',
        message: 'فعالیت بدون پیش‌نیاز (شروع باز)',
        taskUid: task.uid,
        taskName: task.name,
      })
    }

    if (!task.isSummary && task.successors.length === 0) {
      warnings.push({
        code: 'OPEN_FINISH',
        severity: 'info',
        message: 'فعالیت بدون پس‌نیاز (پایان باز)',
        taskUid: task.uid,
        taskName: task.name,
      })
    }

    if (task.constraintType != null && task.constraintType > 0) {
      warnings.push({
        code: 'HAS_CONSTRAINT',
        severity: 'info',
        message: `محدودیت تاریخ (نوع ${task.constraintType})`,
        taskUid: task.uid,
        taskName: task.name,
      })
    }
  }

  for (const dep of schedule.dependencies) {
    const key = `${dep.predecessorUid}-${dep.successorUid}-${dep.type}`
    if (depKeys.has(key)) {
      warnings.push({
        code: 'DUPLICATE_DEPENDENCY',
        severity: 'warning',
        message: 'وابستگی تکراری',
        details: key,
      })
    }
    depKeys.add(key)
  }

  if (schedule.calendars.length === 0) {
    warnings.push({
      code: 'CALENDAR_UNAVAILABLE',
      severity: 'warning',
      message:
        'تقویم کامل پروژه در دسترس نیست — روزهای کاری با پیش‌فرض ' +
        `${durationDaysFromMinutes(config.minutesPerDay, config.minutesPerDay)} ساعت/روز محاسبه می‌شوند`,
    })
  }

  return warnings
}

export function applyActivityDerivedFields(
  schedule: NormalizedSchedule,
  config: ScheduleAnalysisConfig
): void {
  for (const task of schedule.tasks) {
    task.status = deriveActivityStatus(task)
    task.calculatedRemainingMinutes = deriveRemainingMinutes(task, schedule.minutesPerDay)
    const timing = deriveStartTiming(task, config.analysisDate, config)
    task.startTimingLabel = timing.label
    task.daysUntilStartCalendar = timing.calendarDays
    task.daysUntilStartWorking = timing.workingDays

    if (
      task.remainingDurationMinutes != null &&
      task.calculatedRemainingMinutes != null &&
      Math.abs(task.remainingDurationMinutes - task.calculatedRemainingMinutes) >
        schedule.minutesPerDay
    ) {
      schedule.warnings.push({
        code: 'REMAINING_DURATION_MISMATCH',
        severity: 'info',
        message: 'اختلاف بین مدت مانده منبع و محاسبه‌شده',
        taskUid: task.uid,
        taskName: task.name,
      })
    }
  }
}
