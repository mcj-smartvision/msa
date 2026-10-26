/**
 * @file features/manager/lib/i18n/dashboard-copy.ts
 * @purpose برچسب‌های شِل داشبورد مدیر — FA / EN / DE
 * @safe-to-edit YES
 * @affects features/manager/config MANAGER_DASHBOARD_COPY
 * @depends-on shared/lib/i18n/active-locale, shared/lib/i18n/pick-messages
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { getActiveLocale, liveMessages } from '@/shared/lib/i18n/active-locale'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

const EN = {
  loadFailed: 'Failed to load the dashboard',
  modulesNav: 'Module menu',
  helpAndTour: 'Help & system tour',
  helpBadge: 'Interactive',
  helpHint: '5-step tour, glossary and shortcuts',
  controlCenter: 'Control Center',
  settings: 'Settings',
  notifications: 'Notifications',
  notificationsCount: (count: string) => `Notifications, ${count} items`,
  notificationsEmpty: 'No new notifications.',
  changeRequest: 'Change request',
  awaitingYou: 'Awaiting your approval',
  criticalAlert: (domain: string) => `Critical alert · ${domain}`,
  allAlertsTitle: 'All active alerts',
  backToDashboard: 'Back to dashboard',
  alertFilters: 'Alert filters',
  allWithCount: (n: string) => `All (${n})`,
  criticalWithCount: (n: string) => `Critical (${n})`,
  warningWithCount: (n: string) => `Medium risk (${n})`,
  allDomains: 'All domains',
  noFilterMatch: 'No alert matches this filter.',
  expandMenu: 'Expand menu',
  collapseMenu: 'Collapse menu',
  closeMenu: 'Close menu',
  openModules: 'Open module menu',
  pickProject: 'Select project',
  pickProjectPlaceholder: 'Select project…',
  commandRoom: (name: string) => `${name} command room`,
  startTour: 'Start tour',
  startTourTitle: 'A short 5-step tour of the main areas',
  periodGroup: 'Time period',
  syncAria: 'Sync data',
  syncLast: (when: string) => `Last sync: ${when}`,
  syncRelative: (when: string) => `Synced ${when}`,
  syncIdle: 'Sync',
  loading: 'Loading…',
  helpCenter: 'Help center',
  helpTitle: 'Help',
  retry: 'Retry',
  storeTitle: 'Data table (Store)',
  storeHint:
    'This shared table is the source of activity progress. Search the numbers or download as JSON/CSV.',
  contractEnd: (date: string) => `Contract finish ${date} · `,
  today: (date: string) => `Today ${date}`,
  sCurveTitle: 'Project progress S-curve',
  sCurveHint:
    'Planned value (PV), recorded actual progress and earned value (EV) as cumulative %, from the first progress report to today. The “today” point matches the cards above.',
  periodToday: 'Today',
  periodWeek: 'This week',
  periodMonth: 'This month',
}

const FA: typeof EN = {
  loadFailed: 'بارگذاری داشبورد ناموفق بود',
  modulesNav: 'منوی ماژول‌ها',
  helpAndTour: 'راهنما و تور سیستم',
  helpBadge: 'تعاملی',
  helpHint: 'تور 5 مرحله‌ای، اصطلاحات و میانبرها',
  controlCenter: 'Control Center',
  settings: 'تنظیمات',
  notifications: 'اعلان‌ها',
  notificationsCount: (count: string) => `اعلان‌ها، ${count} مورد`,
  notificationsEmpty: 'اعلان تازه‌ای نیست.',
  changeRequest: 'درخواست تغییر',
  awaitingYou: 'منتظر تأیید شما',
  criticalAlert: (domain: string) => `هشدار بحرانی · ${domain}`,
  allAlertsTitle: 'همهٔ هشدارهای فعال',
  backToDashboard: 'بازگشت به داشبورد',
  alertFilters: 'فیلتر هشدارها',
  allWithCount: (n: string) => `همه (${n})`,
  criticalWithCount: (n: string) => `بحرانی (${n})`,
  warningWithCount: (n: string) => `ریسک متوسط (${n})`,
  allDomains: 'همهٔ حوزه‌ها',
  noFilterMatch: 'هشداری با این فیلتر وجود ندارد.',
  expandMenu: 'باز کردن منو',
  collapseMenu: 'جمع کردن منو',
  closeMenu: 'بستن منو',
  openModules: 'باز کردن منوی ماژول‌ها',
  pickProject: 'انتخاب پروژه',
  pickProjectPlaceholder: 'انتخاب پروژه…',
  commandRoom: (name: string) => `اتاق فرمان ${name}`,
  startTour: 'شروع تور',
  startTourTitle: 'یک تور کوتاه 5 مرحله‌ای از بخش‌های اصلی',
  periodGroup: 'بازهٔ زمانی',
  syncAria: 'همگام‌سازی داده‌ها',
  syncLast: (when: string) => `آخرین همگام‌سازی: ${when}`,
  syncRelative: (when: string) => `همگام‌سازی ${when}`,
  syncIdle: 'همگام‌سازی',
  loading: 'در حال بارگذاری…',
  helpCenter: 'مرکز راهنما',
  helpTitle: 'راهنما',
  retry: 'تلاش دوباره',
  storeTitle: 'جدول داده‌ها (Store)',
  storeHint:
    'همین جدول منبع مشترک پیشرفت فعالیت‌هاست. عددها را می‌توانید جستجو کنید یا با JSON و CSV دانلود کنید.',
  contractEnd: (date: string) => `پایان قراردادی ${date} · `,
  today: (date: string) => `امروز ${date}`,
  sCurveTitle: 'منحنی S پیشرفت پروژه',
  sCurveHint:
    'خط برنامه (PV)، پیشرفت واقعی ثبت‌شده و ارزش کسب‌شده (EV) به درصد تجمعی، از اولین گزارش ثبت‌شدهٔ پیشرفت تا امروز. نقطهٔ «امروز» دقیقاً همان مقادیر کارت‌های بالای صفحه است.',
  periodToday: 'امروز',
  periodWeek: 'هفتهٔ جاری',
  periodMonth: 'ماه جاری',
}

const DE: typeof EN = {
  loadFailed: 'Dashboard konnte nicht geladen werden',
  modulesNav: 'Modulmenü',
  helpAndTour: 'Hilfe & Systemtour',
  helpBadge: 'Interaktiv',
  helpHint: '5-Schritt-Tour, Fachbegriffe und Shortcuts',
  controlCenter: 'Control Center',
  settings: 'Einstellungen',
  notifications: 'Benachrichtigungen',
  notificationsCount: (count: string) => `Benachrichtigungen, ${count} Einträge`,
  notificationsEmpty: 'Keine neuen Benachrichtigungen.',
  changeRequest: 'Änderungsantrag',
  awaitingYou: 'Wartet auf Ihre Freigabe',
  criticalAlert: (domain: string) => `Kritische Warnung · ${domain}`,
  allAlertsTitle: 'Alle aktiven Warnungen',
  backToDashboard: 'Zurück zum Dashboard',
  alertFilters: 'Warnungsfilter',
  allWithCount: (n: string) => `Alle (${n})`,
  criticalWithCount: (n: string) => `Kritisch (${n})`,
  warningWithCount: (n: string) => `Mittleres Risiko (${n})`,
  allDomains: 'Alle Bereiche',
  noFilterMatch: 'Keine Warnung entspricht diesem Filter.',
  expandMenu: 'Menü aufklappen',
  collapseMenu: 'Menü einklappen',
  closeMenu: 'Menü schließen',
  openModules: 'Modulmenü öffnen',
  pickProject: 'Projekt wählen',
  pickProjectPlaceholder: 'Projekt wählen…',
  commandRoom: (name: string) => `Lagezentrum ${name}`,
  startTour: 'Tour starten',
  startTourTitle: 'Kurze 5-Schritt-Tour der Hauptbereiche',
  periodGroup: 'Zeitraum',
  syncAria: 'Daten synchronisieren',
  syncLast: (when: string) => `Letzte Sync: ${when}`,
  syncRelative: (when: string) => `Sync ${when}`,
  syncIdle: 'Sync',
  loading: 'Wird geladen…',
  helpCenter: 'Hilfecenter',
  helpTitle: 'Hilfe',
  retry: 'Erneut versuchen',
  storeTitle: 'Datentabelle (Store)',
  storeHint:
    'Diese gemeinsame Tabelle ist die Quelle des Vorgangsfortschritts. Zahlen suchen oder als JSON/CSV laden.',
  contractEnd: (date: string) => `Vertragsende ${date} · `,
  today: (date: string) => `Heute ${date}`,
  sCurveTitle: 'Projektfortschritt S-Kurve',
  sCurveHint:
    'Planned Value (PV), erfasster Ist-Fortschritt und Earned Value (EV) als kumulierte %, vom ersten Fortschrittsbericht bis heute. Der Punkt „heute“ entspricht den Karten oben.',
  periodToday: 'Heute',
  periodWeek: 'Diese Woche',
  periodMonth: 'Dieser Monat',
}

export type ManagerDashboardCopy = typeof EN

export function getManagerDashboardCopy(locale?: FormLocale): ManagerDashboardCopy {
  return pickMessages(locale ?? getActiveLocale(), { en: EN, fa: FA, de: DE })
}

/** Drop-in live catalog — follows LocaleProvider. */
export const MANAGER_DASHBOARD_COPY = liveMessages(getManagerDashboardCopy)
