/**
 * @file features/manager/lib/i18n/critical-fronts-copy.ts
 * @purpose Localized copy for critical-fronts CPM gaps and suggested actions
 * @safe-to-edit YES
 * @affects critical-fronts
 * @depends-on features/project-init/lib/i18n/types, shared/lib/i18n/pick-messages
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

const EN = {
  depsTable: 'Predecessor relationships table',
  depsTableDetail:
    'The task_dependencies table could not be read; without it the CPM network cannot be built.',
  depsMissing: 'Activity predecessor links',
  depsMissingDetail:
    'No predecessor links (FS/SS/FF/SF) are recorded; enter them in the schedule (or MSP file).',
  cpmRun: 'CPM calculation run',
  cpmRunDetail:
    'Total Float has not been calculated for any activity; after recording links, run the schedule CPM calculation.',
  cpmIncomplete:
    'The CPM schedule is incomplete; the critical path and Total Float cannot be determined, so the list is based only on delay versus baseline.',
  addCrew: 'Increase crew',
  resequence: 'Resequence',
  materialSupply: 'Material supply',
  contractorReview: 'Contractor review',
  crewBehind: (pct: string, plan: string, gap: string, remaining: string) =>
    `Progress ${pct}% vs plan ${plan}% (${gap} pp behind); ${remaining}% work remaining.`,
  crewDelayOnly: (delay: string, remaining: string) =>
    `Progress is not behind plan, but there is a ${delay}-day delay vs baseline finish; ${remaining}% work remaining.`,
  reseqSuccessors: (n: string) =>
    `${n} successor activities are waiting; consider overlap (fast-track) or splitting the activity.`,
  reseqNoSuccessors:
    'No successors in the network; resequencing has no direct critical-path effect.',
  reseqNoNetwork:
    'Predecessor links are missing; critical-path impact of resequencing cannot be measured (draft is created with this warning).',
  materialCause: (label: string) => `Recorded cause: ${label}`,
  materialNone:
    'No material blocker is recorded for this activity; check readiness of remaining materials.',
  contractorDelay: (name: string, delay: string) =>
    `Contractor “${name}”; ${delay}-day delay — review capacity, resources and contractual commitments.`,
  contractorNone: 'No contractor is assigned to this activity; identify the execution owner first.',
}

const FA: typeof EN = {
  depsTable: 'جدول روابط پیش‌نیازی',
  depsTableDetail: 'جدول task_dependencies در دیتابیس خوانده نشد؛ بدون آن شبکهٔ CPM ساخته نمی‌شود.',
  depsMissing: 'روابط پیش‌نیازی فعالیت‌ها',
  depsMissingDetail:
    'هیچ رابطهٔ پیش‌نیازی (FS/SS/FF/SF) برای فعالیت‌ها ثبت نشده؛ آن‌ها را در برنامهٔ زمان‌بندی (یا فایل MSP) وارد کنید.',
  cpmRun: 'اجرای محاسبهٔ CPM',
  cpmRunDetail:
    'Total Float هیچ فعالیتی محاسبه نشده؛ پس از ثبت روابط، محاسبهٔ CPM برنامه را اجرا کنید.',
  cpmIncomplete:
    'برنامهٔ CPM کامل نیست؛ مسیر بحرانی و Total Float قابل تعیین نیست و فهرست فقط بر اساس تأخیر نسبت به baseline است.',
  addCrew: 'افزایش اکیپ',
  resequence: 'تغییر توالی',
  materialSupply: 'تأمین مصالح',
  contractorReview: 'بررسی پیمانکار',
  crewBehind: (pct: string, plan: string, gap: string, remaining: string) =>
    `پیشرفت ${pct}٪ در برابر برنامهٔ ${plan}٪ (${gap} واحد درصد عقب)؛ ${remaining}٪ کار باقی است.`,
  crewDelayOnly: (delay: string, remaining: string) =>
    `پیشرفت از برنامه عقب نیست، اما ${delay} روز تأخیر نسبت به پایان مبنا دارد؛ ${remaining}٪ کار باقی است.`,
  reseqSuccessors: (n: string) =>
    `${n} فعالیت پس‌نیاز منتظر این فعالیت‌اند؛ هم‌پوشانی (fast-track) یا شکستن فعالیت بررسی شود.`,
  reseqNoSuccessors: 'پس‌نیازی در شبکه ندارد؛ تغییر توالی اثر مستقیمی بر مسیر بحرانی ندارد.',
  reseqNoNetwork:
    'روابط پیش‌نیازی ثبت نشده؛ اثر تغییر توالی بر مسیر بحرانی قابل سنجش نیست (پیش‌نویس با این هشدار ساخته می‌شود).',
  materialCause: (label: string) => `علت ثبت‌شده: ${label}`,
  materialNone: 'مانع مصالحی برای این فعالیت ثبت نشده؛ آمادگی مصالح باقی‌ماندهٔ کار بررسی شود.',
  contractorDelay: (name: string, delay: string) =>
    `پیمانکار «${name}»؛ ${delay} روز تأخیر — ظرفیت، منابع و تعهدات قراردادی بررسی شود.`,
  contractorNone: 'پیمانکاری به این فعالیت تخصیص داده نشده؛ ابتدا مسئول اجرا مشخص شود.',
}

export function getCriticalFrontsCopy(locale: FormLocale): typeof EN {
  return pickMessages(locale, { fa: FA, en: EN, de: EN })
}
