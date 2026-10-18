/**
 * @file features/manager/lib/i18n/nav-copy.ts
 * @purpose برچسب‌های منوی سایدبار مدیر — FA / EN / DE
 * @safe-to-edit YES
 * @affects features/manager/lib/manager-nav
 * @depends-on shared/lib/i18n/pick-messages, features/project-init/lib/i18n/types
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

const EN = {
  home: 'Home',
  alerts: 'All alerts',
  estimate: 'Cost estimate & control',
  inbox: 'My inbox',
  schedule: 'Schedule & progress',
  site: 'Site execution',
  quality: 'Quality & safety',
  finance: 'Finance & costs',
  contracts: 'Contracts & subcontractors',
  reports: 'Reports',
  background: 'Calculation background',
  store: 'Data table (Store)',
  scheduleIntel: 'Schedule analysis & critical path',
  evm: 'Earned value metrics (EVM)',
  workshopSchedule: 'Site schedule',
  hrGate: 'Workforce & gate access',
  warehouse: 'Warehouse & materials',
  qcNcr: 'Quality control & NCR',
  hseCctv: 'HSE & video monitoring',
  actualCosts: 'Actual project costs',
  employerInvoices: 'Employer payment applications',
  unavailableMachines: 'Plant & equipment (module not built yet)',
  unavailableClaims: 'Claims & contractual correspondence (module not built yet)',
  missingAccess: (label: string) => `${label} (no access for this role)`,
  missingScheduleIntel: 'Schedule analysis',
  missingEvm: 'EVM metrics',
  missingWorkshopSchedule: 'Technical office schedule',
  missingHrGate: 'Workforce & gate access',
  missingWarehouse: 'Warehouse & materials',
  missingQc: 'Quality control & NCR',
  missingHse: 'HSE & video monitoring',
  missingActualCosts: 'Actual project costs',
  missingInvoices: 'Employer payment applications',
  systemAdminRole: 'System administrator',
}

const FA: typeof EN = {
  home: 'خانه',
  alerts: 'همهٔ هشدارها',
  estimate: 'برآورد و کنترل هزینه',
  inbox: 'کارتابل من',
  schedule: 'برنامه و پیشرفت',
  site: 'اجرای کارگاه',
  quality: 'کیفیت و ایمنی',
  finance: 'مالی و هزینه‌ها',
  contracts: 'قراردادها و پیمانکاران',
  reports: 'گزارش‌ها',
  background: 'بک‌گراند محاسبات',
  store: 'جدول داده‌ها (Store)',
  scheduleIntel: 'تحلیل زمان‌بندی و مسیر بحرانی',
  evm: 'شاخص‌های ارزش کسب‌شده (EVM)',
  workshopSchedule: 'برنامهٔ زمان‌بندی کارگاه',
  hrGate: 'منابع انسانی و تردد',
  warehouse: 'انبار و مصالح',
  qcNcr: 'کنترل کیفیت و NCR',
  hseCctv: 'HSE و نظارت تصویری',
  actualCosts: 'هزینه‌های واقعی پروژه',
  employerInvoices: 'صورت‌وضعیت‌های کارفرما',
  unavailableMachines: 'ماشین‌آلات و تجهیزات (ماژول آن هنوز در سامانه ساخته نشده است)',
  unavailableClaims: 'دعاوی و مکاتبات قراردادی (ماژول آن هنوز در سامانه ساخته نشده است)',
  missingAccess: (label: string) => `${label} (دسترسی این نقش تعریف نشده است)`,
  missingScheduleIntel: 'تحلیل زمان‌بندی',
  missingEvm: 'شاخص‌های EVM',
  missingWorkshopSchedule: 'برنامهٔ زمان‌بندی دفتر فنی',
  missingHrGate: 'منابع انسانی و تردد',
  missingWarehouse: 'انبار و مصالح',
  missingQc: 'کنترل کیفیت و NCR',
  missingHse: 'HSE و نظارت تصویری',
  missingActualCosts: 'هزینه‌های واقعی پروژه',
  missingInvoices: 'صورت‌وضعیت‌های کارفرما',
  systemAdminRole: 'مدیر سامانه',
}

const DE: typeof EN = {
  home: 'Start',
  alerts: 'Alle Warnungen',
  estimate: 'Kostenschätzung & Steuerung',
  inbox: 'Mein Posteingang',
  schedule: 'Terminplan & Fortschritt',
  site: 'Baustellenausführung',
  quality: 'Qualität & Arbeitsschutz',
  finance: 'Finanzen & Kosten',
  contracts: 'Verträge & Nachunternehmer',
  reports: 'Berichte',
  background: 'Berechnungshintergrund',
  store: 'Datentabelle (Store)',
  scheduleIntel: 'Terminanalyse & kritischer Pfad',
  evm: 'Earned-Value-Kennzahlen (EVM)',
  workshopSchedule: 'Baustellen-Terminplan',
  hrGate: 'Personal & Zutritt',
  warehouse: 'Lager & Materialien',
  qcNcr: 'Qualitätskontrolle & NCR',
  hseCctv: 'HSE & Videoüberwachung',
  actualCosts: 'Ist-Kosten des Projekts',
  employerInvoices: 'Auftraggeber-Abschlagsrechnungen',
  unavailableMachines: 'Geräte & Maschinen (Modul noch nicht vorhanden)',
  unavailableClaims: 'Claims & Vertragskorrespondenz (Modul noch nicht vorhanden)',
  missingAccess: (label: string) => `${label} (keine Berechtigung für diese Rolle)`,
  missingScheduleIntel: 'Terminanalyse',
  missingEvm: 'EVM-Kennzahlen',
  missingWorkshopSchedule: 'Terminplan technisches Büro',
  missingHrGate: 'Personal & Zutritt',
  missingWarehouse: 'Lager & Materialien',
  missingQc: 'Qualitätskontrolle & NCR',
  missingHse: 'HSE & Videoüberwachung',
  missingActualCosts: 'Ist-Kosten des Projekts',
  missingInvoices: 'Auftraggeber-Abschlagsrechnungen',
  systemAdminRole: 'Systemadministrator',
}

export type ManagerNavCopy = typeof EN

export function getManagerNavCopy(locale: FormLocale | string): ManagerNavCopy {
  return pickMessages(locale, { en: EN, fa: FA, de: DE })
}
