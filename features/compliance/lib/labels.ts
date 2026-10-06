/**
 * Localized standard labels — code + name per locale.
 * Fallback chain: requested locale → en → catalog default.
 */

import { getStandardByKey } from './catalog'

export type ComplianceLabelLocale = 'en' | 'fa' | 'de' | 'fr' | 'ar'

export interface StandardLabel {
  code: string
  name: string
}

type LabelMap = Record<string, StandardLabel>

const EN: LabelMap = {
  iso_9001: { code: 'ISO 9001', name: 'Quality Management Systems' },
  iso_14001: { code: 'ISO 14001', name: 'Environmental Management Systems' },
  iso_45001: { code: 'ISO 45001', name: 'Occupational Health & Safety Management' },
  iso_19650: { code: 'ISO 19650', name: 'BIM / Information Management' },
  iso_50001: { code: 'ISO 50001', name: 'Energy Management Systems' },
  ifc_4: { code: 'IFC 4', name: 'Open BIM Data Model' },
  de_din_general: { code: 'DIN', name: 'DIN Standards' },
  de_din_en: { code: 'DIN EN', name: 'DIN EN European Standards' },
  de_vob: { code: 'VOB', name: 'VOB Construction Contract Procedures' },
  de_dguv: { code: 'DGUV', name: 'DGUV Accident Prevention Rules' },
  de_arbschg: { code: 'ArbSchG', name: 'Occupational Safety Act' },
  de_betr_sichv: { code: 'BetrSichV', name: 'Industrial Safety Regulation' },
  de_trbs: { code: 'TRBS', name: 'Technical Rules for Operational Safety' },
  de_mbo: { code: 'MBO', name: 'Model Building Code' },
  de_din_4108: { code: 'DIN 4108', name: 'Thermal Protection in Buildings' },
  de_din_4109: { code: 'DIN 4109', name: 'Sound Insulation in Buildings' },
  de_bimschg: { code: 'BIMSchG', name: 'BIM Submission Act' },
  de_dgnb: { code: 'DGNB', name: 'German Sustainable Building Council' },
  de_geg: { code: 'GEG', name: 'Building Energy Act' },
  eu_en_1990: { code: 'EN 1990', name: 'Eurocode — Basis of Structural Design' },
  eu_en_1991: { code: 'EN 1991', name: 'Eurocode 1 — Actions on Structures' },
  eu_en_1992: { code: 'EN 1992', name: 'Eurocode 2 — Concrete Structures' },
  eu_en_1993: { code: 'EN 1993', name: 'Eurocode 3 — Steel Structures' },
  eu_en_1994: { code: 'EN 1994', name: 'Eurocode 4 — Composite Structures' },
  eu_en_1995: { code: 'EN 1995', name: 'Eurocode 5 — Timber Structures' },
  eu_en_1996: { code: 'EN 1996', name: 'Eurocode 6 — Masonry Structures' },
  eu_en_1997: { code: 'EN 1997', name: 'Eurocode 7 — Geotechnical Design' },
  eu_en_1998: { code: 'EN 1998', name: 'Eurocode 8 — Seismic Design' },
  eu_en_1999: { code: 'EN 1999', name: 'Eurocode 9 — Aluminium Structures' },
  eu_en_general: { code: 'EN', name: 'European Standards (EN)' },
  eu_en_81: { code: 'EN 81', name: 'Safety Rules for Lifts' },
  eu_directive_89_391: { code: '89/391/EEC', name: 'EU Framework Directive — OHS' },
  eu_directive_92_57: { code: '92/57/EEC', name: 'Temporary/Mobile Construction Sites' },
  eu_cpr_305: { code: 'CPR 305/2011', name: 'Construction Products Regulation' },
  eu_emas: { code: 'EMAS', name: 'Eco-Management & Audit Scheme' },
  eu_breeam: { code: 'BREEAM', name: 'BREEAM Environmental Assessment' },
  eu_epbd: { code: 'EPBD', name: 'Energy Performance of Buildings Directive' },
  us_ibc: { code: 'IBC', name: 'International Building Code' },
  us_irc: { code: 'IRC', name: 'International Residential Code' },
  us_iecc: { code: 'IECC', name: 'International Energy Conservation Code' },
  us_imc: { code: 'IMC', name: 'International Mechanical Code' },
  us_ipc: { code: 'IPC', name: 'International Plumbing Code' },
  us_ifc_fire: { code: 'IFC Fire', name: 'International Fire Code' },
  us_aci_318: { code: 'ACI 318', name: 'Structural Concrete' },
  us_astm_general: { code: 'ASTM', name: 'ASTM Standards' },
  us_aisc_360: { code: 'AISC 360', name: 'Structural Steel Buildings' },
  us_asce_7: { code: 'ASCE 7', name: 'Minimum Design Loads' },
  us_aashto: { code: 'AASHTO', name: 'Highway & Bridge Design' },
  us_osha_1926: { code: 'OSHA 1926', name: 'Construction Safety' },
  us_osha_1910: { code: 'OSHA 1910', name: 'General Industry Safety' },
  us_nfpa_70e: { code: 'NFPA 70E', name: 'Electrical Safety in Workplace' },
  us_nfpa_101: { code: 'NFPA 101', name: 'Life Safety Code' },
  us_epa_nepa: { code: 'NEPA', name: 'Environmental Protection' },
  us_leed: { code: 'LEED', name: 'LEED Green Building Certification' },
  us_ashrae_901: { code: 'ASHRAE 90.1', name: 'Energy Standard for Buildings' },
  ca_nbcc: { code: 'NBC', name: 'National Building Code of Canada' },
  ca_nfc: { code: 'NFC', name: 'National Fire Code of Canada' },
  ca_npl: { code: 'NPC', name: 'National Plumbing Code of Canada' },
  ca_csa_general: { code: 'CSA', name: 'CSA Standards' },
  ca_csa_a23: { code: 'CSA A23', name: 'Concrete Materials & Construction' },
  ca_csa_s16: { code: 'CSA S16', name: 'Design of Steel Structures' },
  ca_csa_o86: { code: 'CSA O86', name: 'Engineering Design in Wood' },
  ca_electrical_code: { code: 'CEC', name: 'Canadian Electrical Code' },
  ca_ohs_ontario: { code: 'OHSA ON', name: 'Ontario OHS Act' },
  ca_ohs_alberta: { code: 'OHS AB', name: 'Alberta OHS Code' },
  ca_ohs_bc: { code: 'OHS BC', name: 'WorkSafeBC Regulations' },
  ca_cepaa: { code: 'CEPA', name: 'Canadian Environmental Protection Act' },
  ca_leed_ca: { code: 'LEED Canada', name: 'LEED Canada Certification' },
  ca_national_energy_code: { code: 'NECB', name: 'National Energy Code for Buildings' },
  ir_national_building: { code: 'مقررات ملی', name: 'مقررات ملی ساختمان ایران' },
  ir_standard_2800: { code: 'استاندارد 2800', name: 'طراحی لرزه‌ای ساختمان‌ها (ISIRI 2800)' },
  ir_standard_413: { code: 'استاندارد 413', name: 'طراحی و اجرای سازه‌های بتنی (آبا)' },
  ir_standard_414: { code: 'استاندارد 414', name: 'طراحی، محاسبه و اجرای سازه‌های فولادی' },
  ir_national_technical: { code: 'مشخصات فنی', name: 'مشخصات فنی و عمومی ابنیه (مفهوم)' },
  ir_isiri_general: { code: 'ISIRI', name: 'استانداردهای ملی ایران (موسسه استاندارد)' },
  ir_hse: { code: 'HSE ایران', name: 'مقررات ایمنی، بهداشت و محیط زیست کار — وزارت کار' },
  ir_ohs_construction: { code: 'ایمنی کارگاه', name: 'آیین‌نامه ایمنی کارگاه‌های ساختمانی' },
  ir_fire_safety: { code: 'ایمنی حریق', name: 'مقررات ایمنی حریق و شرایط اضطراری' },
  ir_electrical_safety: { code: 'ایمنی برق', name: 'مقررات ایمنی برق در ساختمان و کارگاه' },
  ir_development_bylaw_12: { code: 'طرح توسعه ۱۲', name: 'طرح توسعه — الزامات ساخت و ساز (بند ۱۲)' },
  ir_development_bylaw_13: { code: 'طرح توسعه ۱۳', name: 'طرح توسعه — الزامات ساخت و ساز (بند ۱۳)' },
  ir_municipal_building: { code: 'کد شهرداری', name: 'ضوابط و کدهای ساختمانی شهرداری‌ها' },
  ir_road_highway: { code: 'راه و بزرگراه', name: 'استانداردهای راه، بزرگراه و پل (سازمان راه)' },
  ir_environmental_law: { code: 'محیط زیست', name: 'قانون حفاظت و بهسازی محیط زیست' },
  ir_wastewater: { code: 'فاضلاب', name: 'استانداردهای تخلیه فاضلاب و پساب' },
  ir_air_quality: { code: 'کیفیت هوا', name: 'استانداردهای کیفیت هوا و انتشار آلاینده‌ها' },
  ir_energy_efficiency: { code: 'بهینه‌سازی انرژی', name: 'ضوابط بهره‌وری انرژی در ساختمان' },
}

const FA: LabelMap = {
  ...EN,
  iso_9001: { code: 'ISO 9001', name: 'سیستم‌های مدیریت کیفیت' },
  iso_14001: { code: 'ISO 14001', name: 'سیستم‌های مدیریت محیط زیست' },
  iso_45001: { code: 'ISO 45001', name: 'سیستم‌های مدیریت ایمنی و بهداشت شغلی' },
  iso_19650: { code: 'ISO 19650', name: 'مدیریت اطلاعات BIM' },
  iso_50001: { code: 'ISO 50001', name: 'سیستم‌های مدیریت انرژی' },
  ifc_4: { code: 'IFC 4', name: 'مدل داده باز BIM' },
  de_din_general: { code: 'DIN', name: 'استانداردهای DIN آلمان' },
  de_din_en: { code: 'DIN EN', name: 'استانداردهای اروپایی DIN EN' },
  de_vob: { code: 'VOB', name: 'رویه‌های قراردادی ساخت و ساز آلمان' },
  de_dguv: { code: 'DGUV', name: 'قوانین پیشگیری از حوادث DGUV' },
  de_arbschg: { code: 'ArbSchG', name: 'قانون ایمنی شغلی آلمان' },
  de_betr_sichv: { code: 'BetrSichV', name: 'آیین‌نامه ایمنی بهره‌برداری' },
  de_trbs: { code: 'TRBS', name: 'قواعد فنی ایمنی بهره‌برداری' },
  de_mbo: { code: 'MBO', name: 'آیین‌نامه نمونه ساختمان' },
  de_din_4108: { code: 'DIN 4108', name: 'حفاظت حرارتی در ساختمان' },
  de_din_4109: { code: 'DIN 4109', name: 'عایق‌بندی صوتی در ساختمان' },
  de_bimschg: { code: 'BIMSchG', name: 'قانون ارائه مدل BIM' },
  de_dgnb: { code: 'DGNB', name: 'شورای ساختمان پایدار آلمان' },
  de_geg: { code: 'GEG', name: 'قانون انرژی ساختمان آلمان' },
  eu_en_1990: { code: 'EN 1990', name: 'یوروکد — مبانی طراحی سازه' },
  eu_en_1991: { code: 'EN 1991', name: 'یوروکد ۱ — بارگذاری بر سازه‌ها' },
  eu_en_1992: { code: 'EN 1992', name: 'یوروکد ۲ — سازه‌های بتنی' },
  eu_en_1993: { code: 'EN 1993', name: 'یوروکد ۳ — سازه‌های فولادی' },
  eu_en_1994: { code: 'EN 1994', name: 'یوروکد ۴ — سازه‌های مرکب' },
  eu_en_1995: { code: 'EN 1995', name: 'یوروکد ۵ — سازه‌های چوبی' },
  eu_en_1996: { code: 'EN 1996', name: 'یوروکد ۶ — سازه‌های بنایی' },
  eu_en_1997: { code: 'EN 1997', name: 'یوروکد ۷ — طراحی ژئوتکنیک' },
  eu_en_1998: { code: 'EN 1998', name: 'یوروکد ۸ — طراحی لرزه‌ای' },
  eu_en_1999: { code: 'EN 1999', name: 'یوروکد ۹ — سازه‌های آلومینیومی' },
  eu_en_general: { code: 'EN', name: 'استانداردهای اروپایی (EN)' },
  eu_en_81: { code: 'EN 81', name: 'قواعد ایمنی آسانسورها' },
  eu_directive_89_391: { code: '89/391/EEC', name: 'دستورالعمل چارچوب اتحادیه اروپا — ایمنی شغلی' },
  eu_directive_92_57: { code: '92/57/EEC', name: 'کارگاه‌های موقت/سیار ساختمانی' },
  eu_cpr_305: { code: 'CPR 305/2011', name: 'مقررات محصولات ساختمانی اتحادیه اروپا' },
  eu_emas: { code: 'EMAS', name: 'طرح مدیریت و ممیزی محیط زیست' },
  eu_breeam: { code: 'BREEAM', name: 'ارزیابی زیست‌محیطی ساختمان BREEAM' },
  eu_epbd: { code: 'EPBD', name: 'دستورالعمل عملکرد انرژی ساختمان‌ها' },
  us_ibc: { code: 'IBC', name: 'کد بین‌المللی ساختمان' },
  us_irc: { code: 'IRC', name: 'کد بین‌المللی ساختمان‌های مسکونی' },
  us_iecc: { code: 'IECC', name: 'کد بین‌المللی صرفه‌جویی انرژی' },
  us_imc: { code: 'IMC', name: 'کد بین‌المللی تاسیسات مکانیکی' },
  us_ipc: { code: 'IPC', name: 'کد بین‌المللی لوله‌کشی' },
  us_ifc_fire: { code: 'IFC Fire', name: 'کد بین‌المللی حریق' },
  us_aci_318: { code: 'ACI 318', name: 'بتن سازه‌ای' },
  us_astm_general: { code: 'ASTM', name: 'استانداردهای ASTM' },
  us_aisc_360: { code: 'AISC 360', name: 'ساختمان‌های فولادی سازه‌ای' },
  us_asce_7: { code: 'ASCE 7', name: 'حداقل بارهای طراحی' },
  us_aashto: { code: 'AASHTO', name: 'طراحی راه و پل' },
  us_osha_1926: { code: 'OSHA 1926', name: 'ایمنی ساخت و ساز' },
  us_osha_1910: { code: 'OSHA 1910', name: 'ایمنی صنعت عمومی' },
  us_nfpa_70e: { code: 'NFPA 70E', name: 'ایمنی برق در محیط کار' },
  us_nfpa_101: { code: 'NFPA 101', name: 'کد ایمنی جان' },
  us_epa_nepa: { code: 'NEPA', name: 'حفاظت محیط زیست' },
  us_leed: { code: 'LEED', name: 'گواهی ساختمان سبز LEED' },
  us_ashrae_901: { code: 'ASHRAE 90.1', name: 'استاندارد انرژی برای ساختمان‌ها' },
  ca_nbcc: { code: 'NBC', name: 'کد ملی ساختمان کانادا' },
  ca_nfc: { code: 'NFC', name: 'کد ملی حریق کانادا' },
  ca_npl: { code: 'NPC', name: 'کد ملی لوله‌کشی کانادا' },
  ca_csa_general: { code: 'CSA', name: 'استانداردهای CSA' },
  ca_csa_a23: { code: 'CSA A23', name: 'مصالح و اجرای بتن' },
  ca_csa_s16: { code: 'CSA S16', name: 'طراحی سازه‌های فولادی' },
  ca_csa_o86: { code: 'CSA O86', name: 'طراحی مهندسی چوب' },
  ca_electrical_code: { code: 'CEC', name: 'کد برق کانادا' },
  ca_ohs_ontario: { code: 'OHSA ON', name: 'قانون ایمنی انتاریو' },
  ca_ohs_alberta: { code: 'OHS AB', name: 'کد ایمنی آلبرتا' },
  ca_ohs_bc: { code: 'OHS BC', name: 'مقررات WorkSafeBC' },
  ca_cepaa: { code: 'CEPA', name: 'قانون حفاظت محیط زیست کانادا' },
  ca_leed_ca: { code: 'LEED Canada', name: 'گواهی LEED کانادا' },
  ca_national_energy_code: { code: 'NECB', name: 'کد ملی انرژی ساختمان کانادا' },
}

const LOCALE_MAP: Partial<Record<ComplianceLabelLocale, LabelMap>> = {
  en: EN,
  fa: FA,
}

export function getStandardLabel(key: string, locale: string): StandardLabel {
  const map = LOCALE_MAP[locale as ComplianceLabelLocale] ?? EN
  const localized = map[key]
  if (localized) return localized
  const std = getStandardByKey(key)
  if (std) return { code: std.code, name: std.name }
  return { code: key, name: key }
}

export function getCategoryLabel(category: string, locale: string): string {
  const labels: Record<string, Record<string, string>> = {
    en: { safety: 'Safety', quality: 'Quality', environmental: 'Environmental', bim: 'BIM', contract: 'Contract', general: 'General' },
    fa: { safety: 'ایمنی', quality: 'کیفیت', environmental: 'محیط زیست', bim: 'BIM', contract: 'قرارداد', general: 'عمومی' },
  }
  const lang = locale in labels ? locale : 'en'
  return labels[lang]?.[category] ?? category
}
