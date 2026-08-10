import type { FormLocale } from '@/lib/project-init/i18n/types'
import { CONSTRUCTION_ROLES } from '@/lib/admin/construction-roles'

type LocaleKey = 'en' | 'fa' | 'fr' | 'de'

/** Multilingual position titles keyed by positions.key */
export const POSITION_LABELS: Record<string, Record<LocaleKey, string>> = {
  project_manager: { en: 'Project Manager', fa: 'مدیر پروژه', fr: 'Chef de projet', de: 'Projektleiter' },
  site_manager: { en: 'Site Manager', fa: 'مدیر کارگاه', fr: 'Directeur de site', de: 'Bauleiter' },
  site_supervisor: { en: 'Site Supervisor', fa: 'سرپرست کارگاه', fr: 'Superviseur de site', de: 'Bauüberwacher' },
  technical_office: {
    en: 'Technical Office Manager',
    fa: 'مدیر دفتر فنی',
    fr: 'Bureau technique',
    de: 'Technisches Büro',
  },
  civil_engineer: { en: 'Civil Engineer', fa: 'مهندس عمران', fr: 'Ingénieur civil', de: 'Bauingenieur' },
  architect: { en: 'Architect', fa: 'معمار', fr: 'Architecte', de: 'Architekt' },
  structural_engineer: { en: 'Structural Engineer', fa: 'مهندس سازه', fr: 'Ingénieur structure', de: 'Tragwerksplaner' },
  mep_engineer: { en: 'MEP Engineer', fa: 'مهندس MEP', fr: 'Ingénieur MEP', de: 'TGA-Ingenieur' },
  hse_officer: { en: 'HSE Officer', fa: 'مسئول ایمنی', fr: 'Responsable HSE', de: 'HSE-Beauftragter' },
  qa_qc_inspector: { en: 'QA/QC Inspector', fa: 'بازرس QA/QC', fr: 'Inspecteur QA/QC', de: 'QA/QC-Prüfer' },
  surveyor: { en: 'Surveyor', fa: 'نقشه‌بردار', fr: 'Géomètre', de: 'Vermessungsingenieur' },
  storekeeper: { en: 'Storekeeper', fa: 'انباردار', fr: 'Magasinier', de: 'Lagerverwalter' },
  procurement_officer: { en: 'Procurement Officer', fa: 'مسئول خرید', fr: 'Acheteur', de: 'Einkaufsbeauftragter' },
  project_accountant: { en: 'Project Accountant', fa: 'حسابدار پروژه', fr: 'Comptable projet', de: 'Projektbuchhalter' },
  planning_engineer: { en: 'Planning Engineer', fa: 'مهندس برنامه‌ریزی', fr: 'Planificateur', de: 'Planungsingenieur' },
  document_controller: { en: 'Document Controller', fa: 'مسئول مستندات', fr: 'Gestionnaire documentaire', de: 'Dokumentencontroller' },
  foreman: { en: 'Foreman', fa: 'سرکارگر', fr: 'Contremaître', de: 'Vorarbeiter' },
  contractor: { en: 'Contractor', fa: 'پیمانکار', fr: 'Entrepreneur', de: 'Auftragnehmer' },
  subcontractor: { en: 'Subcontractor', fa: 'پیمانکار جزء', fr: 'Sous-traitant', de: 'Subunternehmer' },
  finance_admin: { en: 'Finance/Admin Officer', fa: 'مسئول مالی/اداری', fr: 'Administration/Finance', de: 'Finanz/Admin' },
  equipment_manager: { en: 'Equipment Manager', fa: 'مدیر تجهیزات', fr: 'Responsable équipements', de: 'Gerätemanager' },
  security: { en: 'Security', fa: 'حراست', fr: 'Sécurité', de: 'Sicherheit' },
  worker: { en: 'Worker', fa: 'کارگر', fr: 'Ouvrier', de: 'Arbeiter' },
  visitor: { en: 'Visitor / Temporary Access', fa: 'بازدیدکننده', fr: 'Visiteur', de: 'Besucher' },
}

export function getPositionLabel(
  position: { key: string; title: string; name_en?: string | null; name_fa?: string | null; name_fr?: string | null; name_de?: string | null },
  locale: FormLocale
): string {
  const loc = (['en', 'fa', 'fr', 'de'].includes(locale) ? locale : 'fa') as LocaleKey
  const dbKey = `name_${loc}` as 'name_en' | 'name_fa' | 'name_fr' | 'name_de'
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
    name_fr: POSITION_LABELS[role.key]?.fr ?? role.title,
    name_de: POSITION_LABELS[role.key]?.de ?? role.title,
    description: role.description,
    is_active: true,
  }))
}
