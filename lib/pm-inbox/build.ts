import type { ExplainedKpi } from '@/types/project-controls'
import type { InboxEvidenceMetric, InboxItem, InboxSeverity, PmInboxSnapshot } from '@/lib/pm-inbox/types'
import { jalaliDate } from '@/lib/manager/format'

export const PM_INBOX_THRESHOLDS = {
  /** SPI(t) below this needs a recovery directive (same as the KPI's critical band). */
  spiT: 0.9,
  /** Schedule slip (−SV(t) in calendar days) that calls for a delay-cause meeting / makes it urgent. */
  slipWarningDays: 14,
  slipCriticalDays: 30,
  /** TCPI above this means the remaining budget is not achievable without a scope/cost review. */
  tcpi: 1.15,
} as const

const SEVERITY_ORDER: Record<InboxSeverity, number> = { critical: 0, warning: 1, info: 2 }
const DAY_MS = 86_400_000

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** The Saturday that starts the work week on or after `iso` (today when today is Saturday). */
export function nextWeekStart(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return addDays(iso, (6 - dow + 7) % 7)
}

const fmt = (x: number, digits = 2) => x.toLocaleString('fa-IR', { maximumFractionDigits: digits })

function metricOf(kpi: ExplainedKpi): InboxEvidenceMetric {
  return { key: kpi.key, label_fa: kpi.title_fa, value: kpi.value, unit: kpi.unit, data_quality: kpi.data_quality }
}

function sourcesOf(...kpis: ExplainedKpi[]): string[] {
  return Array.from(new Set(kpis.flatMap((k) => k.evidence.sources)))
}

/**
 * Turns KPI values and data-quality signals into actionable PM items. Every item records the rule
 * that fired and the observed value, so the inbox explains itself. Pure: no I/O, no clock.
 */
export function buildPmInboxItems(snapshot: PmInboxSnapshot): InboxItem[] {
  const { controls, kpis, today, projectId } = snapshot
  const asOf = controls.asOf
  const id = (rule: string) => `${rule}:${projectId}:${asOf}`
  const items: InboxItem[] = []
  const T = PM_INBOX_THRESHOLDS

  const spiT = kpis.spi_t
  if (spiT?.value != null && spiT.value < T.spiT) {
    items.push({
      id: id('spi_t_low'),
      category: 'Controls',
      title_fa: 'صدور دستور جبرانی برنامه',
      description_fa: `سرعت زمانی پروژه (SPI(t) = ${fmt(spiT.value, 3)}) زیر حد کنترل است؛ برای بازگشت به برنامه باید فشرده‌سازی (Crashing) یا موازی‌سازی (Fast-Track) فعالیت‌های مسیر بحرانی بررسی و ابلاغ شود.`,
      severity: 'critical',
      owner_role: 'PM',
      due_date: addDays(today, 2),
      trigger: { rule: `SPI(t) < ${T.spiT}`, rule_fa: `SPI(t) کمتر از ${fmt(T.spiT)}`, observed_fa: spiT.substitution },
      suggested_actions: [
        { label_fa: 'پیش‌نویس دستور Crashing', action_type: 'draft', payload: { kind: 'schedule_recovery_directive', strategy: 'crashing', projectId, spi_t: spiT.value, asOf } },
        { label_fa: 'پیش‌نویس دستور Fast-Track', action_type: 'draft', payload: { kind: 'schedule_recovery_directive', strategy: 'fast_track', projectId, spi_t: spiT.value, asOf } },
        { label_fa: 'بررسی مسیر بحرانی', action_type: 'navigate', payload: { route: 'scheduleIntel', query: { projectId, focus: 'critical_path' } } },
      ],
      evidence: { metrics: [metricOf(spiT), ...(kpis.es ? [metricOf(kpis.es)] : []), ...(kpis.at ? [metricOf(kpis.at)] : [])], sources: sourcesOf(spiT), asOf: spiT.evidence.asOf },
    })
  }

  const svT = kpis.sv_t
  if (svT?.value != null) {
    const slipDays = Math.round(-svT.value * controls.daysPerUnit)
    if (slipDays >= T.slipWarningDays) {
      const critical = slipDays >= T.slipCriticalDays
      items.push({
        id: id('sv_t_negative'),
        category: 'Controls',
        title_fa: 'جلسهٔ فوری تحلیل علل تأخیر',
        description_fa: `پروژه حدود ${fmt(slipDays, 0)} روز تقویمی از برنامه عقب است (SV(t) = ${fmt(svT.value)} ${svT.unit}). علل تأخیر (منابع، مصالح، مجوزها، طراحی) باید با برنامه‌ریز و سرپرست کارگاه ریشه‌یابی و مسئول هر کدام تعیین شود.`,
        severity: critical ? 'critical' : 'warning',
        owner_role: 'Planner',
        due_date: addDays(today, critical ? 1 : 3),
        trigger: {
          rule: `−SV(t) × daysPerUnit ≥ ${T.slipWarningDays}`,
          rule_fa: `عقب‌افتادگی دست‌کم ${fmt(T.slipWarningDays, 0)} روز (از ${fmt(T.slipCriticalDays, 0)} روز بحرانی)`,
          observed_fa: `${fmt(-svT.value)} × ${fmt(controls.daysPerUnit)} ≈ ${fmt(slipDays, 0)} روز`,
        },
        suggested_actions: [
          { label_fa: 'تشکیل جلسهٔ تحلیل تأخیر', action_type: 'draft', payload: { kind: 'delay_analysis_meeting', projectId, slipDays, attendees: ['PM', 'Planner', 'SiteManager'], asOf } },
          { label_fa: 'مشاهدهٔ فعالیت‌های عقب‌افتاده', action_type: 'navigate', payload: { route: 'gantt', query: { projectId } } },
        ],
        evidence: { metrics: [metricOf(svT), ...(kpis.delay_forecast ? [metricOf(kpis.delay_forecast)] : [])], sources: sourcesOf(svT), asOf: svT.evidence.asOf },
      })
    }
  }

  const ppc = kpis.ppc
  if (ppc && (ppc.data_quality === 'missing' || ppc.data_quality === 'invalid')) {
    const weekStart = nextWeekStart(today)
    items.push({
      id: id('ppc_missing'),
      category: 'LeanOps',
      title_fa: 'ثبت WWP برای هفتهٔ جاری قبل از شروع هفته',
      description_fa: `PPC قابل محاسبه نیست چون برنامهٔ هفتگی متعهد (WWP) بسته‌شده‌ای وجود ندارد. برنامهٔ هفتهٔ ${jalaliDate(weekStart)} باید تا صبح شنبه ثبت و قفل (Freeze) شود تا در پایان هفته PPC محاسبه شود.`,
      severity: 'warning',
      owner_role: 'Planner',
      due_date: weekStart,
      trigger: { rule: 'PPC.data_quality ∈ {missing, invalid}', rule_fa: 'PPC داده ندارد', observed_fa: ppc.reason_fa ?? ppc.interpretation_fa },
      suggested_actions: [
        { label_fa: 'ساخت پیش‌نویس WWP این هفته', action_type: 'api_call', payload: { method: 'POST', url: '/api/wwp', body: { projectId, weekStart } } },
      ],
      evidence: { metrics: [metricOf(ppc)], sources: sourcesOf(ppc), asOf: ppc.evidence.asOf },
    })
  }

  const tcpi = kpis.tcpi_bac
  if (tcpi?.value != null && tcpi.value > T.tcpi) {
    items.push({
      id: id('tcpi_high'),
      category: 'Financials',
      title_fa: 'بازبینی محدوده/هزینه و برنامهٔ خرید',
      description_fa: `برای ماندن در سقف بودجه، باقی کار باید با بهره‌وری ${fmt(tcpi.value, 3)} انجام شود که واقع‌بینانه نیست. محدودهٔ کار، برآورد هزینهٔ تکمیل و برنامهٔ خرید باید بازبینی شود.`,
      severity: 'critical',
      owner_role: 'QS',
      due_date: addDays(today, 5),
      trigger: { rule: `TCPI > ${T.tcpi}`, rule_fa: `TCPI بیشتر از ${fmt(T.tcpi)}`, observed_fa: tcpi.substitution },
      suggested_actions: [
        { label_fa: 'بازبینی هزینه‌ها', action_type: 'navigate', payload: { route: 'finance', query: { projectId } } },
        { label_fa: 'بازبینی برنامهٔ خرید', action_type: 'navigate', payload: { route: 'procurement', query: { projectId } } },
        { label_fa: 'پیش‌نویس درخواست تغییر محدوده', action_type: 'draft', payload: { kind: 'scope_change_request', projectId, tcpi: tcpi.value, asOf } },
      ],
      evidence: { metrics: [metricOf(tcpi)], sources: sourcesOf(tcpi), asOf: tcpi.evidence.asOf },
    })
  }

  const daily = snapshot.dailyReport
  const progressStale = controls.ev.quality === 'stale'
  if ((daily && (daily.status === 'stale' || daily.status === 'never')) || progressStale) {
    const observed = [
      daily?.status === 'never' ? 'هنوز هیچ گزارش روزانه‌ای ثبت نشده' : null,
      daily?.status === 'stale' ? `آخرین گزارش روزانه ${jalaliDate(daily.lastActivityAt)}؛ بیش از ${fmt(daily.thresholdHours, 0)} ساعت گذشته` : null,
      progressStale ? `پیشرفت فیزیکی از ${jalaliDate(controls.ev.asOf)} به‌روز نشده (داده قدیمی)` : null,
    ].filter(Boolean) as string[]
    items.push({
      id: id('daily_report_stale'),
      category: 'Controls',
      title_fa: 'یادآوری ثبت گزارش کارگاه',
      description_fa: `شاخص‌ها روی دادهٔ قدیمی محاسبه می‌شوند. ${daily?.responsible.length ? `مسئول ثبت: ${daily.responsible.join('، ')}.` : ''}`.trim(),
      severity: 'warning',
      owner_role: 'SiteManager',
      due_date: today,
      trigger: { rule: 'daily_report.status ∈ {stale, never} ∨ EV.quality = stale', rule_fa: 'گزارش روزانهٔ کارگاه قدیمی است یا ثبت نشده', observed_fa: observed.join(' · ') },
      suggested_actions: [
        { label_fa: 'ارسال یادآوری به سرپرست', action_type: 'api_call', payload: { method: 'POST', url: '/api/manager/remind', body: { projectId, source: 'daily_report' } } },
      ],
      evidence: {
        metrics: [
          { key: 'daily_report', label_fa: 'آخرین گزارش روزانه', value: daily?.lastActivityAt ?? null, data_quality: daily?.status === 'fresh' ? 'ok' : daily?.status === 'never' ? 'missing' : 'stale' },
          { key: 'ev', label_fa: 'پیشرفت فیزیکی (EV٪)', value: controls.ev.value, unit: 'درصد', data_quality: controls.ev.quality },
        ],
        sources: ['گزارش روزانهٔ کارگاه', controls.ev.source],
        asOf,
      },
    })
  }

  if (controls.ac.value == null && controls.bac.value != null) {
    items.push({
      id: id('ac_missing'),
      category: 'Financials',
      title_fa: 'ثبت هزینه‌های واقعی پروژه (AC)',
      description_fa: 'بودجهٔ مبنا تعریف شده ولی هیچ هزینهٔ واقعی ثبت نشده؛ CPI و TCPI تا ثبت هزینه محاسبه نمی‌شوند.',
      severity: 'info',
      owner_role: 'QS',
      due_date: addDays(today, 7),
      trigger: { rule: 'AC.quality = missing ∧ BAC.quality = ok', rule_fa: 'هزینهٔ واقعی ثبت نشده', observed_fa: controls.ac.reason_fa ?? 'AC ثبت نشده' },
      suggested_actions: [{ label_fa: 'ثبت هزینه', action_type: 'navigate', payload: { route: 'finance', query: { projectId } } }],
      evidence: {
        metrics: [
          { key: 'ac', label_fa: 'هزینهٔ واقعی (AC)', value: null, data_quality: controls.ac.quality },
          { key: 'bac', label_fa: 'بودجهٔ مبنا (BAC)', value: controls.bac.value, data_quality: controls.bac.quality },
        ],
        sources: [controls.ac.source, controls.bac.source],
        asOf,
      },
    })
  }

  const finish = controls.baselineFinish.value
  if (finish && today > finish && (controls.ev.value ?? 0) < 99.95) {
    items.push({
      id: id('baseline_ended'),
      category: 'Controls',
      title_fa: 'بازنگری مبنا (re-baseline)',
      description_fa: `دورهٔ برنامهٔ مبنا در ${jalaliDate(finish)} تمام شده ولی پروژه ناتمام است؛ پیش‌بینی‌های زمانی دیگر به برنامهٔ معتبری ارجاع نمی‌دهند.`,
      severity: 'warning',
      owner_role: 'Planner',
      due_date: addDays(today, 7),
      trigger: { rule: 'today > baselineFinish ∧ EV٪ < 100', rule_fa: 'برنامهٔ مبنا تمام شده و کار باقی است', observed_fa: `امروز ${jalaliDate(today)} بعد از پایان مبنا ${jalaliDate(finish)} · EV٪ = ${fmt(controls.ev.value ?? 0)}` },
      suggested_actions: [{ label_fa: 'باز کردن برنامهٔ زمان‌بندی', action_type: 'navigate', payload: { route: 'gantt', query: { projectId } } }],
      evidence: {
        metrics: [
          { key: 'baseline_finish', label_fa: 'پایان برنامهٔ مبنا', value: finish, data_quality: controls.baselineFinish.quality },
          { key: 'ev', label_fa: 'پیشرفت فیزیکی (EV٪)', value: controls.ev.value, unit: 'درصد', data_quality: controls.ev.quality },
        ],
        sources: [controls.baselineFinish.source],
        asOf,
      },
    })
  }

  if (controls.weightIssues.length > 0) {
    items.push({
      id: id('weight_issues'),
      category: 'Controls',
      title_fa: 'رفع مغایرت وزن‌های برنامه',
      description_fa: `${fmt(controls.weightIssues.length, 0)} مغایرت در وزن فعالیت‌ها/بسته‌ها پیدا شد؛ وزن‌ها برای محاسبه مقیاس شده‌اند ولی باید در برنامه اصلاح شوند.`,
      severity: 'warning',
      owner_role: 'Planner',
      due_date: addDays(today, 3),
      trigger: { rule: 'weightIssues.length > 0', rule_fa: 'جمع وزن‌ها با والد یا ۱۰۰ نمی‌خواند', observed_fa: controls.weightIssues.join(' · ') },
      suggested_actions: [{ label_fa: 'مشاهدهٔ وزن‌ها در بک‌گراند', action_type: 'navigate', payload: { route: 'background', query: { projectId } } }],
      evidence: { metrics: [], sources: [controls.pv.source], asOf },
    })
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.due_date.localeCompare(b.due_date))
}
