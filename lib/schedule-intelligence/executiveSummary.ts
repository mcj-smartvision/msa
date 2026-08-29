import type { CpmResult, NormalizedSchedule, PhaseSummary, ProjectKpis } from '@/types/schedule-intelligence'
import { topActivitiesBy } from '@/lib/schedule-intelligence/scheduleMetrics'

export function generateExecutiveSummaryFa(
  schedule: NormalizedSchedule,
  cpm: CpmResult,
  kpis: ProjectKpis,
  phases: PhaseSummary[]
): string {
  const activityCount = kpis.totalLeafTasks
  const depCount = kpis.totalDependencies
  const duration = kpis.calculatedProjectDurationDays.toLocaleString('fa-IR')
  const start = schedule.projectStart
    ? new Date(schedule.projectStart).toLocaleDateString('fa-IR')
    : 'نامشخص'
  const finish = schedule.projectFinish
    ? new Date(schedule.projectFinish).toLocaleDateString('fa-IR')
    : 'نامشخص'
  const criticalCount = kpis.criticalCount

  const highestRiskPhase =
    phases.sort((a, b) => b.highRiskCount - a.highRiskCount)[0]?.name ?? 'نامشخص'

  const topRisks = topActivitiesBy(schedule.tasks, 'riskScore', 3)
    .map((t) => t.name)
    .join('، ')

  const qualityParts: string[] = []
  if (kpis.validationErrorCount > 0) {
    qualityParts.push(`${kpis.validationErrorCount.toLocaleString('fa-IR')} خطای اعتبارسنجی`)
  }
  if (kpis.validationWarningCount > 0) {
    qualityParts.push(`${kpis.validationWarningCount.toLocaleString('fa-IR')} هشدار`)
  }
  const qualityWarningText =
    qualityParts.length > 0
      ? `توجه: ${qualityParts.join(' و ')} در داده‌ها ثبت شد.`
      : 'کیفیت داده‌ها برای تحلیل قابل قبول است.'

  const calendarNote =
    schedule.calendars.length === 0
      ? ' محاسبه روز کاری با تقویم پیش‌فرض انجام شده و ممکن است با تقویم واقعی پروژه متفاوت باشد.'
      : ''

  if (!cpm.success) {
    return (
      `تحلیل CPM به‌دلیل خطا در شبکه وابستگی (مثلاً حلقه) انجام نشد. ` +
      `فایل شامل ${activityCount.toLocaleString('fa-IR')} فعالیت و ${depCount.toLocaleString('fa-IR')} رابطه است. ` +
      qualityWarningText
    )
  }

  return (
    `این برنامه شامل ${activityCount.toLocaleString('fa-IR')} فعالیت اجرایی و ${depCount.toLocaleString('fa-IR')} رابطه است. ` +
    `مدت شبکه محاسبه‌شده پروژه ${duration} روز است و بازه برنامه از ${start} تا ${finish} ادامه دارد. ` +
    `تعداد ${criticalCount.toLocaleString('fa-IR')} فعالیت در مسیر بحرانی محاسبه‌شده قرار گرفته‌اند. ` +
    `بیشترین تمرکز ریسک در فاز «${highestRiskPhase}» مشاهده شد. ` +
    (topRisks
      ? `مهم‌ترین فعالیت‌های قابل پیگیری: ${topRisks}. `
      : '') +
    qualityWarningText +
    calendarNote
  )
}
