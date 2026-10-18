/**
 * @file shared/lib/i18n/position-labels.ts
 * @purpose تنظیمات و برچسب‌ها — زیرساخت مشترک سامانه (position-labels)
 * @safe-to-edit YES
 * @affects زیرساخت مشترک سامانه
 * @depends-on features/project-init/lib/i18n/types, features/admin/lib/construction-roles
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types';
import { CONSTRUCTION_ROLES } from '@/features/admin/lib/construction-roles';

type LocaleKey = 'en' | 'fa' | 'de'

/** Multilingual position titles keyed by positions.key */
export const POSITION_LABELS: Record<string, Record<LocaleKey, string>> = {
  project_manager: { en: 'Project Manager', fa: 'مدیر پروژه', de: 'Projektleiter' },
  site_manager: { en: 'Site Manager', fa: 'مدیر کارگاه', de: 'Bauleiter' },
  site_supervisor: { en: 'Site Supervisor', fa: 'سرپرست کارگاه', de: 'Polier' },
  technical_office: {
    en: 'Technical Office Manager',
    fa: 'مدیر دفتر فنی',
    de: 'Leiter Technisches Büro',
  },
  civil_engineer: { en: 'Civil Engineer', fa: 'مهندس عمران', de: 'Bauingenieur' },
  architect: { en: 'Architect', fa: 'معمار', de: 'Architekt' },
  structural_engineer: { en: 'Structural Engineer', fa: 'مهندس سازه', de: 'Tragwerksplaner' },
  mep_engineer: { en: 'MEP Engineer', fa: 'مهندس MEP', de: 'TGA-Ingenieur' },
  hse_officer: { en: 'HSE Officer', fa: 'مسئول ایمنی', de: 'HSE-Beauftragter' },
  qa_qc_inspector: { en: 'QA/QC Inspector', fa: 'بازرس کنترل کیفیت', de: 'QA/QC-Prüfer' },
  surveyor: { en: 'Surveyor', fa: 'نقشه‌بردار', de: 'Vermessungsingenieur' },
  storekeeper: { en: 'Storekeeper', fa: 'انباردار', de: 'Lagerverwalter' },
  procurement_officer: { en: 'Procurement Officer', fa: 'مسئول خرید', de: 'Einkaufsbeauftragter' },
  project_accountant: { en: 'Project Accountant', fa: 'حسابدار پروژه', de: 'Projektbuchhalter' },
  planning_engineer: { en: 'Planning Engineer', fa: 'مهندس برنامه‌ریزی', de: 'Planungsingenieur' },
  document_controller: { en: 'Document Controller', fa: 'مسئول مستندات', de: 'Dokumentencontroller' },
  foreman: { en: 'Foreman', fa: 'سرکارگر', de: 'Vorarbeiter' },
  contractor: { en: 'Contractor', fa: 'پیمانکار', de: 'Auftragnehmer' },
  subcontractor: { en: 'Subcontractor', fa: 'پیمانکار جزء', de: 'Nachunternehmer' },
  finance_admin: { en: 'Finance/Admin Officer', fa: 'مسئول مالی/اداری', de: 'Finanz-/Verwaltungsbeauftragter' },
  equipment_manager: { en: 'Equipment Manager', fa: 'مدیر تجهیزات', de: 'Gerätemanager' },
  security: { en: 'Security', fa: 'حراست', de: 'Sicherheit' },
  worker: { en: 'Worker', fa: 'کارگر', de: 'Arbeiter' },
  visitor: { en: 'Visitor / Temporary Access', fa: 'بازدیدکننده', de: 'Besucher' },
}

export function getPositionLabel(
  position: { key: string; title: string; name_en?: string | null; name_fa?: string | null; name_fr?: string | null; name_de?: string | null },
  locale: FormLocale
): string {
  const loc = (['en', 'fa', 'de'].includes(locale) ? locale : 'fa') as LocaleKey
  const dbKey = `name_${loc}` as 'name_en' | 'name_fa' | 'name_de'
  const fromDb = position[dbKey]
  if (fromDb) return fromDb
  return POSITION_LABELS[position.key]?.[loc] ?? POSITION_LABELS[position.key]?.fa ?? position.title
}

export function getSeedPositionRows(projectId: string) {
  return CONSTRUCTION_ROLES.map((role) => ({
    project_id: projectId,
    key: role.key,
    title: role.title,
    name_en: POSITION_LABELS[role.key]?.en ?? role.title,
    name_fa: POSITION_LABELS[role.key]?.fa ?? role.title,
    /** Legacy DB column — UI locales are fa/en/de only. */
    name_fr: POSITION_LABELS[role.key]?.en ?? role.title,
    name_de: POSITION_LABELS[role.key]?.de ?? role.title,
    description: role.description,
    is_active: true,
  }))
}
