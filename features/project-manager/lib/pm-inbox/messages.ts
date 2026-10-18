/**
 * @file features/project-manager/lib/pm-inbox/messages.ts
 * @purpose FA/EN copy for PM action inbox items
 * @safe-to-edit YES
 * @affects buildPmInboxItems
 * @depends-on features/project-init/lib/i18n/types, shared/lib/i18n/pick-messages
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

const EN = {
  spiTitle: 'Issue a schedule recovery directive',
  spiBody: (spi: string) =>
    `Schedule speed is below control (SPI(t) = ${spi}). To get back on plan, review and issue crashing or fast-tracking on critical-path activities.`,
  spiRule: (t: string) => `SPI(t) below ${t}`,
  draftCrash: 'Draft crashing directive',
  draftFast: 'Draft fast-track directive',
  reviewCritical: 'Review critical path',
  delayTitle: 'Urgent delay root-cause meeting',
  delayBody: (days: string, sv: string, unit: string) =>
    `The project is about ${days} calendar days behind plan (SV(t) = ${sv} ${unit}). Root causes (resources, materials, permits, design) must be traced with the planner and site supervisor and owners assigned.`,
  delayRule: (warn: string, crit: string) => `At least ${warn} days behind (${crit} days = critical)`,
  delayObserved: (sv: string, dpu: string, days: string) => `${sv} × ${dpu} ≈ ${days} days`,
  delayMeeting: 'Schedule delay-analysis meeting',
  viewLate: 'View late activities',
  ppcTitle: 'Record WWP for the current week before week start',
  ppcBody: (week: string) =>
    `PPC cannot be calculated because there is no closed weekly work plan (WWP). The week of ${week} must be entered and frozen by Saturday morning so PPC can be scored at week end.`,
  ppcRule: 'PPC has no data',
  draftWwp: 'Create this week’s WWP draft',
  tcpiTitle: 'Review scope/cost and procurement plan',
  tcpiBody: (v: string) =>
    `To stay within budget, remaining work would need productivity ${v}, which is not realistic. Review scope, estimate at completion and the procurement plan.`,
  tcpiRule: (t: string) => `TCPI above ${t}`,
  reviewCosts: 'Review costs',
  reviewBuy: 'Review procurement plan',
  draftScope: 'Draft scope-change request',
  dailyTitle: 'Reminder to record the site report',
  dailyBody: (who: string) => `Metrics are calculated on stale data. ${who}`.trim(),
  dailyOwner: (names: string) => `Recorder: ${names}.`,
  dailyNever: 'No daily report recorded yet',
  dailyStale: (date: string, hours: string) => `Last daily report ${date}; more than ${hours} hours ago`,
  progressStale: (date: string) => `Physical progress not updated since ${date} (stale)`,
  dailyRule: 'Site daily report is stale or missing',
  remindSupervisor: 'Send reminder to supervisor',
  lastDaily: 'Last daily report',
  evPct: 'Physical progress (EV%)',
  pctUnit: 'percent',
  dailySource: 'Site daily report',
  acTitle: 'Record actual project costs (AC)',
  acBody: 'Baseline budget is defined but no actual cost is recorded; CPI and TCPI cannot be calculated until costs are entered.',
  acRule: 'Actual cost not recorded',
  acMissing: 'AC not recorded',
  addCost: 'Record cost',
  acLabel: 'Actual cost (AC)',
  bacLabel: 'Baseline budget (BAC)',
  rebaselineTitle: 'Re-baseline the schedule',
  rebaselineBody: (finish: string) =>
    `The baseline window ended on ${finish} but the project is unfinished; time forecasts no longer refer to a valid plan.`,
  rebaselineRule: 'Baseline finished with work remaining',
  rebaselineObserved: (today: string, finish: string, ev: string) =>
    `Today ${today} is after baseline finish ${finish} · EV% = ${ev}`,
  openSchedule: 'Open schedule',
  baselineFinish: 'Baseline finish',
  weightTitle: 'Fix schedule weight mismatches',
  weightBody: (n: string) =>
    `${n} weight mismatches found on activities/packages; weights were scaled for calculation but should be fixed in the schedule.`,
  weightRule: 'Weights do not sum to parent or 100',
  viewWeights: 'View weights in background',
}

const FA: typeof EN = {
  spiTitle: 'صدور دستور جبرانی برنامه',
  spiBody: (spi: string) =>
    `سرعت زمانی پروژه (SPI(t) = ${spi}) زیر حد کنترل است؛ برای بازگشت به برنامه باید فشرده‌سازی (Crashing) یا موازی‌سازی (Fast-Track) فعالیت‌های مسیر بحرانی بررسی و ابلاغ شود.`,
  spiRule: (t: string) => `SPI(t) کمتر از ${t}`,
  draftCrash: 'پیش‌نویس دستور Crashing',
  draftFast: 'پیش‌نویس دستور Fast-Track',
  reviewCritical: 'بررسی مسیر بحرانی',
  delayTitle: 'جلسهٔ فوری تحلیل علل تأخیر',
  delayBody: (days: string, sv: string, unit: string) =>
    `پروژه حدود ${days} روز تقویمی از برنامه عقب است (SV(t) = ${sv} ${unit}). علل تأخیر (منابع، مصالح، مجوزها، طراحی) باید با برنامه‌ریز و سرپرست کارگاه ریشه‌یابی و مسئول هر کدام تعیین شود.`,
  delayRule: (warn: string, crit: string) => `عقب‌افتادگی دست‌کم ${warn} روز (از ${crit} روز بحرانی)`,
  delayObserved: (sv: string, dpu: string, days: string) => `${sv} × ${dpu} ≈ ${days} روز`,
  delayMeeting: 'تشکیل جلسهٔ تحلیل تأخیر',
  viewLate: 'مشاهدهٔ فعالیت‌های عقب‌افتاده',
  ppcTitle: 'ثبت WWP برای هفتهٔ جاری قبل از شروع هفته',
  ppcBody: (week: string) =>
    `PPC قابل محاسبه نیست چون برنامهٔ هفتگی متعهد (WWP) بسته‌شده‌ای وجود ندارد. برنامهٔ هفتهٔ ${week} باید تا صبح شنبه ثبت و قفل (Freeze) شود تا در پایان هفته PPC محاسبه شود.`,
  ppcRule: 'PPC داده ندارد',
  draftWwp: 'ساخت پیش‌نویس WWP این هفته',
  tcpiTitle: 'بازبینی محدوده/هزینه و برنامهٔ خرید',
  tcpiBody: (v: string) =>
    `برای ماندن در سقف بودجه، باقی کار باید با بهره‌وری ${v} انجام شود که واقع‌بینانه نیست. محدودهٔ کار، برآورد هزینهٔ تکمیل و برنامهٔ خرید باید بازبینی شود.`,
  tcpiRule: (t: string) => `TCPI بیشتر از ${t}`,
  reviewCosts: 'بازبینی هزینه‌ها',
  reviewBuy: 'بازبینی برنامهٔ خرید',
  draftScope: 'پیش‌نویس درخواست تغییر محدوده',
  dailyTitle: 'یادآوری ثبت گزارش کارگاه',
  dailyBody: (who: string) => `شاخص‌ها روی دادهٔ قدیمی محاسبه می‌شوند. ${who}`.trim(),
  dailyOwner: (names: string) => `مسئول ثبت: ${names}.`,
  dailyNever: 'هنوز هیچ گزارش روزانه‌ای ثبت نشده',
  dailyStale: (date: string, hours: string) => `آخرین گزارش روزانه ${date}؛ بیش از ${hours} ساعت گذشته`,
  progressStale: (date: string) => `پیشرفت فیزیکی از ${date} به‌روز نشده (داده قدیمی)`,
  dailyRule: 'گزارش روزانهٔ کارگاه قدیمی است یا ثبت نشده',
  remindSupervisor: 'ارسال یادآوری به سرپرست',
  lastDaily: 'آخرین گزارش روزانه',
  evPct: 'پیشرفت فیزیکی (EV٪)',
  pctUnit: 'درصد',
  dailySource: 'گزارش روزانهٔ کارگاه',
  acTitle: 'ثبت هزینه‌های واقعی پروژه (AC)',
  acBody: 'بودجهٔ مبنا تعریف شده ولی هیچ هزینهٔ واقعی ثبت نشده؛ CPI و TCPI تا ثبت هزینه محاسبه نمی‌شوند.',
  acRule: 'هزینهٔ واقعی ثبت نشده',
  acMissing: 'AC ثبت نشده',
  addCost: 'ثبت هزینه',
  acLabel: 'هزینهٔ واقعی (AC)',
  bacLabel: 'بودجهٔ مبنا (BAC)',
  rebaselineTitle: 'بازنگری مبنا (re-baseline)',
  rebaselineBody: (finish: string) =>
    `دورهٔ برنامهٔ مبنا در ${finish} تمام شده ولی پروژه ناتمام است؛ پیش‌بینی‌های زمانی دیگر به برنامهٔ معتبری ارجاع نمی‌دهند.`,
  rebaselineRule: 'برنامهٔ مبنا تمام شده و کار باقی است',
  rebaselineObserved: (today: string, finish: string, ev: string) =>
    `امروز ${today} بعد از پایان مبنا ${finish} · EV٪ = ${ev}`,
  openSchedule: 'باز کردن برنامهٔ زمان‌بندی',
  baselineFinish: 'پایان برنامهٔ مبنا',
  weightTitle: 'رفع مغایرت وزن‌های برنامه',
  weightBody: (n: string) =>
    `${n} مغایرت در وزن فعالیت‌ها/بسته‌ها پیدا شد؛ وزن‌ها برای محاسبه مقیاس شده‌اند ولی باید در برنامه اصلاح شوند.`,
  weightRule: 'جمع وزن‌ها با والد یا 100 نمی‌خواند',
  viewWeights: 'مشاهدهٔ وزن‌ها در بک‌گراند',
}

export type InboxMessages = typeof EN

export function getInboxMessages(locale: FormLocale): InboxMessages {
  return pickMessages(locale, { fa: FA, en: EN, de: EN })
}
