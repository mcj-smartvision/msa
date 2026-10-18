/**
 * @file features/manager/lib/i18n/blockers-copy.ts
 * @purpose Localized copy for daily site blockers on the manager overview
 * @safe-to-edit YES
 * @affects daily-performance buildBlockers
 * @depends-on features/project-init/lib/i18n/types, shared/lib/i18n/pick-messages
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

const EN = {
  listSep: ', ',
  constraintPrefix: (constraints: string) => `Constraint: ${constraints}`,
  woStopped: 'This front is marked “stopped” on the daily plan',
  constraintNote: 'Constraint recorded on the daily site plan',
  stockShort: (name: string) => `Shortage: ${name}`,
  stockBelowMin: (name: string) => `${name} below minimum stock`,
  stockZero: 'Stock is zero; activities that depend on these materials will stop',
  stockAtRisk: (current: string, unit: string, min: string) =>
    `Stock ${current}${unit} vs minimum ${min}; at risk of stoppage`,
  criticalNcr: (label: string) => `Critical non-conformance ${label}`,
  ncrImpact: 'Work in the NCR area is stopped until corrective action and re-inspection',
  openPlanningAlert: 'Open planning alert',
  alertImpact: {
    delay_risk: 'Risk of delay to activity start or finish',
    material_purchase: 'On-time material supply for the activity is at risk',
    milestone_risk: 'Milestone date is at risk',
    critical_path: 'Direct impact on the critical path',
  } as Record<string, string>,
}

const FA: typeof EN = {
  listSep: '، ',
  constraintPrefix: (constraints: string) => `محدودیت: ${constraints}`,
  woStopped: 'این جبهه در برنامهٔ روزانه «متوقف» ثبت شده است',
  constraintNote: 'محدودیت ثبت‌شده در برنامهٔ روزانهٔ کارگاه',
  stockShort: (name: string) => `کسری ${name}`,
  stockBelowMin: (name: string) => `${name} زیر حداقل موجودی`,
  stockZero: 'موجودی صفر است؛ فعالیت‌های وابسته به این مصالح متوقف می‌شوند',
  stockAtRisk: (current: string, unit: string, min: string) =>
    `موجودی ${current}${unit} از حداقل ${min}؛ در خطر توقف`,
  criticalNcr: (label: string) => `عدم انطباق بحرانی ${label}`,
  ncrImpact: 'کار در محدودهٔ NCR تا اقدام اصلاحی و بازرسی مجدد متوقف است',
  openPlanningAlert: 'هشدار باز برنامه‌ریزی',
  alertImpact: {
    delay_risk: 'ریسک تأخیر در شروع یا پایان فعالیت',
    material_purchase: 'تأمین به‌موقع مصالح فعالیت در خطر است',
    milestone_risk: 'تاریخ مایل‌استون در خطر است',
    critical_path: 'روی مسیر بحرانی اثر مستقیم دارد',
  },
}

export function getBlockersCopy(locale: FormLocale): typeof EN {
  return pickMessages(locale, { fa: FA, en: EN, de: EN })
}
