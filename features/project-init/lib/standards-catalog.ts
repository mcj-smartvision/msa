/**
 * Construction standards catalog for SitePilot AI compliance checks.
 * Each entry includes a stable `value` id used in the database and by AI to load the correct rule set.
 */

export type StandardRegion = 'US' | 'CA' | 'DE' | 'EU' | 'IR' | 'INTL'
export type StandardCategory = 'safety' | 'quality' | 'environmental'

export interface ConstructionStandard {
  /** Stable slug — stored on project and passed to AI */
  value: string
  /** Human-readable label in dropdowns */
  label: string
  region: StandardRegion
  category: StandardCategory
  /** Official code or document number when applicable */
  code?: string
}

const REGION_LABELS: Record<StandardRegion, string> = {
  US: 'United States',
  CA: 'Canada',
  DE: 'Germany',
  EU: 'Europe (EU / Eurocodes)',
  IR: 'Iran',
  INTL: 'International',
}

/** All catalogued standards — extend this list as new jurisdictions are onboarded */
export const CONSTRUCTION_STANDARDS: ConstructionStandard[] = [
  // ── International ──
  { value: 'iso_45001', label: 'ISO 45001 — Occupational Health & Safety', region: 'INTL', category: 'safety', code: 'ISO 45001' },
  { value: 'iso_9001', label: 'ISO 9001 — Quality Management', region: 'INTL', category: 'quality', code: 'ISO 9001' },
  { value: 'iso_14001', label: 'ISO 14001 — Environmental Management', region: 'INTL', category: 'environmental', code: 'ISO 14001' },
  { value: 'iso_50001', label: 'ISO 50001 — Energy Management', region: 'INTL', category: 'environmental', code: 'ISO 50001' },
  { value: 'iso_19650', label: 'ISO 19650 — BIM / Information Management', region: 'INTL', category: 'quality', code: 'ISO 19650' },
  { value: 'ifc_4', label: 'IFC 4 — Open BIM Data Model', region: 'INTL', category: 'quality', code: 'IFC 4' },

  // ── United States — Safety ──
  { value: 'us_osha_1926', label: 'OSHA 29 CFR 1926 — Construction Safety', region: 'US', category: 'safety', code: '29 CFR 1926' },
  { value: 'us_osha_1910', label: 'OSHA 29 CFR 1910 — General Industry', region: 'US', category: 'safety', code: '29 CFR 1910' },
  { value: 'us_niosh', label: 'NIOSH — Occupational Safety Guidelines', region: 'US', category: 'safety', code: 'NIOSH' },
  { value: 'us_ansi_z10', label: 'ANSI/ASSP Z10 — OHS Management Systems', region: 'US', category: 'safety', code: 'ANSI Z10' },
  { value: 'us_nfpa_70e', label: 'NFPA 70E — Electrical Safety in Workplace', region: 'US', category: 'safety', code: 'NFPA 70E' },
  { value: 'us_nfpa_101', label: 'NFPA 101 — Life Safety Code', region: 'US', category: 'safety', code: 'NFPA 101' },
  { value: 'us_msha', label: 'MSHA — Mine Safety (when applicable)', region: 'US', category: 'safety', code: 'MSHA' },

  // ── United States — Quality / Building ──
  { value: 'us_ibc', label: 'IBC — International Building Code', region: 'US', category: 'quality', code: 'IBC' },
  { value: 'us_irc', label: 'IRC — International Residential Code', region: 'US', category: 'quality', code: 'IRC' },
  { value: 'us_iecc', label: 'IECC — International Energy Conservation Code', region: 'US', category: 'quality', code: 'IECC' },
  { value: 'us_imc', label: 'IMC — International Mechanical Code', region: 'US', category: 'quality', code: 'IMC' },
  { value: 'us_ipc', label: 'IPC — International Plumbing Code', region: 'US', category: 'quality', code: 'IPC' },
  { value: 'us_ifc_fire', label: 'IFC — International Fire Code', region: 'US', category: 'quality', code: 'IFC' },
  { value: 'us_astm_general', label: 'ASTM — American Society for Testing & Materials', region: 'US', category: 'quality', code: 'ASTM' },
  { value: 'us_aci_318', label: 'ACI 318 — Structural Concrete', region: 'US', category: 'quality', code: 'ACI 318' },
  { value: 'us_aisc_360', label: 'AISC 360 — Structural Steel Buildings', region: 'US', category: 'quality', code: 'AISC 360' },
  { value: 'us_asce_7', label: 'ASCE 7 — Minimum Design Loads', region: 'US', category: 'quality', code: 'ASCE 7' },
  { value: 'us_aashto', label: 'AASHTO — Highway & Bridge Design', region: 'US', category: 'quality', code: 'AASHTO' },
  { value: 'us_nesc', label: 'NESC — National Electrical Safety Code', region: 'US', category: 'quality', code: 'NESC' },
  { value: 'us_ul', label: 'UL Standards — Product Safety Certification', region: 'US', category: 'quality', code: 'UL' },

  // ── United States — Environmental ──
  { value: 'us_epa_nepa', label: 'EPA / NEPA — Environmental Protection', region: 'US', category: 'environmental', code: 'EPA' },
  { value: 'us_leed', label: 'LEED — Green Building Certification', region: 'US', category: 'environmental', code: 'LEED' },
  { value: 'us_well', label: 'WELL Building Standard', region: 'US', category: 'environmental', code: 'WELL' },
  { value: 'us_ashrae_901', label: 'ASHRAE 90.1 — Energy Standard for Buildings', region: 'US', category: 'environmental', code: 'ASHRAE 90.1' },
  { value: 'us_cercla', label: 'CERCLA / Superfund — Hazardous Sites', region: 'US', category: 'environmental', code: 'CERCLA' },

  // ── Canada — Safety ──
  { value: 'ca_csa_z1000', label: 'CSA Z1000 — OHS Management', region: 'CA', category: 'safety', code: 'CSA Z1000' },
  { value: 'ca_csa_z1001', label: 'CSA Z1001 — OHS Training', region: 'CA', category: 'safety', code: 'CSA Z1001' },
  { value: 'ca_ccohs', label: 'CCOHS — Canadian Centre for OHS', region: 'CA', category: 'safety', code: 'CCOHS' },
  { value: 'ca_ohs_alberta', label: 'Alberta OHS Code', region: 'CA', category: 'safety', code: 'AB OHS' },
  { value: 'ca_ohs_bc', label: 'BC Workers Compensation Act / OHS Regulation', region: 'CA', category: 'safety', code: 'BC OHS' },
  { value: 'ca_ohs_ontario', label: 'Ontario OHSA — Occupational Health & Safety Act', region: 'CA', category: 'safety', code: 'OHSA' },
  { value: 'ca_ohs_quebec', label: 'Quebec LSST — Act Respecting OHS', region: 'CA', category: 'safety', code: 'LSST' },

  // ── Canada — Quality / Building ──
  { value: 'ca_nbcc', label: 'NBCC — National Building Code of Canada', region: 'CA', category: 'quality', code: 'NBCC' },
  { value: 'ca_nfc', label: 'NFC — National Fire Code of Canada', region: 'CA', category: 'quality', code: 'NFC' },
  { value: 'ca_npl', label: 'NPC — National Plumbing Code of Canada', region: 'CA', category: 'quality', code: 'NPC' },
  { value: 'ca_csa_a23', label: 'CSA A23 — Concrete Materials & Construction', region: 'CA', category: 'quality', code: 'CSA A23' },
  { value: 'ca_csa_s16', label: 'CSA S16 — Design of Steel Structures', region: 'CA', category: 'quality', code: 'CSA S16' },
  { value: 'ca_csa_o86', label: 'CSA O86 — Engineering Design in Wood', region: 'CA', category: 'quality', code: 'CSA O86' },
  { value: 'ca_csa_b651', label: 'CSA B651 — Accessible Design for Built Environment', region: 'CA', category: 'quality', code: 'CSA B651' },
  { value: 'ca_provincial_bc_building', label: 'BC Building Code (Provincial)', region: 'CA', category: 'quality', code: 'BCBC' },
  { value: 'ca_provincial_ontario_building', label: 'Ontario Building Code', region: 'CA', category: 'quality', code: 'OBC' },

  // ── Canada — Environmental ──
  { value: 'ca_cepaa', label: 'CEPA — Canadian Environmental Protection Act', region: 'CA', category: 'environmental', code: 'CEPA' },
  { value: 'ca_leed_ca', label: 'LEED Canada', region: 'CA', category: 'environmental', code: 'LEED CA' },
  { value: 'ca_boma_best', label: 'BOMA BEST — Building Environmental Standards', region: 'CA', category: 'environmental', code: 'BOMA BEST' },
  { value: 'ca_national_energy_code', label: 'NECB — National Energy Code of Canada for Buildings', region: 'CA', category: 'environmental', code: 'NECB' },

  // ── Germany — Safety ──
  { value: 'de_arbschg', label: 'ArbSchG — Arbeitsschutzgesetz', region: 'DE', category: 'safety', code: 'ArbSchG' },
  { value: 'de_betr_sichv', label: 'BetrSichV — Betriebssicherheitsverordnung', region: 'DE', category: 'safety', code: 'BetrSichV' },
  { value: 'de_dguv', label: 'DGUV — German Social Accident Insurance Rules', region: 'DE', category: 'safety', code: 'DGUV' },
  { value: 'de_trbs', label: 'TRBS — Technical Rules for Operational Safety', region: 'DE', category: 'safety', code: 'TRBS' },
  { value: 'de_bgi', label: 'BGI / BGR — Trade Association Safety Rules', region: 'DE', category: 'safety', code: 'BGI' },
  { value: 'de_si_gefahrstoffv', label: 'GefStoffV — Hazardous Substances Ordinance', region: 'DE', category: 'safety', code: 'GefStoffV' },

  // ── Germany — Quality / Building ──
  { value: 'de_din_general', label: 'DIN Standards — Deutsches Institut für Normung', region: 'DE', category: 'quality', code: 'DIN' },
  { value: 'de_vob_c', label: 'VOB/C — German Construction Contract Procedures', region: 'DE', category: 'quality', code: 'VOB/C' },
  { value: 'de_vob_b', label: 'VOB/B — General Contract Conditions for Construction', region: 'DE', category: 'quality', code: 'VOB/B' },
  { value: 'de_mbo', label: 'MBO — Model Building Code (Musterbauordnung)', region: 'DE', category: 'quality', code: 'MBO' },
  { value: 'de_din_1045', label: 'DIN 1045 / DIN EN 1992 — Concrete Structures', region: 'DE', category: 'quality', code: 'DIN EN 1992' },
  { value: 'de_din_en_1090', label: 'DIN EN 1090 — Steel & Aluminium Structures', region: 'DE', category: 'quality', code: 'DIN EN 1090' },
  { value: 'de_vde', label: 'VDE — Electrical Standards', region: 'DE', category: 'quality', code: 'VDE' },
  { value: 'de_din_4108', label: 'DIN 4108 — Thermal Protection in Buildings', region: 'DE', category: 'quality', code: 'DIN 4108' },
  { value: 'de_din_4109', label: 'DIN 4109 — Sound Insulation in Buildings', region: 'DE', category: 'quality', code: 'DIN 4109' },

  // ── Germany — Environmental ──
  { value: 'de_bimschg', label: 'BImSchG — Federal Immission Control Act', region: 'DE', category: 'environmental', code: 'BImSchG' },
  { value: 'de_dgnb', label: 'DGNB — German Sustainable Building Council', region: 'DE', category: 'environmental', code: 'DGNB' },
  { value: 'de_kfw', label: 'KfW Efficiency House Standards', region: 'DE', category: 'environmental', code: 'KfW' },
  { value: 'de_geg', label: 'GEG — Building Energy Act (Gebäudeenergiegesetz)', region: 'DE', category: 'environmental', code: 'GEG' },

  // ── Europe (EU) — Safety ──
  { value: 'eu_directive_89_391', label: 'EU Framework Directive 89/391/EEC — OHS', region: 'EU', category: 'safety', code: '89/391/EEC' },
  { value: 'eu_directive_92_57', label: 'EU Directive 92/57/EEC — Temporary/Mobile Construction Sites', region: 'EU', category: 'safety', code: '92/57/EEC' },
  { value: 'eu_machinery_2006_42', label: 'EU Machinery Directive 2006/42/EC', region: 'EU', category: 'safety', code: '2006/42/EC' },
  { value: 'eu_reach', label: 'EU REACH — Chemical Substances Regulation', region: 'EU', category: 'safety', code: 'REACH' },
  { value: 'eu_uk_hse_cdm', label: 'UK HSE CDM Regulations 2015', region: 'EU', category: 'safety', code: 'CDM 2015' },
  { value: 'eu_fr_inrs', label: 'France INRS — OHS Reference', region: 'EU', category: 'safety', code: 'INRS' },

  // ── Europe (EU) — Quality / Eurocodes ──
  { value: 'eu_en_1990', label: 'EN 1990 — Eurocode: Basis of Structural Design', region: 'EU', category: 'quality', code: 'EN 1990' },
  { value: 'eu_en_1991', label: 'EN 1991 — Eurocode 1: Actions on Structures', region: 'EU', category: 'quality', code: 'EN 1991' },
  { value: 'eu_en_1992', label: 'EN 1992 — Eurocode 2: Concrete Structures', region: 'EU', category: 'quality', code: 'EN 1992' },
  { value: 'eu_en_1993', label: 'EN 1993 — Eurocode 3: Steel Structures', region: 'EU', category: 'quality', code: 'EN 1993' },
  { value: 'eu_en_1994', label: 'EN 1994 — Eurocode 4: Composite Structures', region: 'EU', category: 'quality', code: 'EN 1994' },
  { value: 'eu_en_1995', label: 'EN 1995 — Eurocode 5: Timber Structures', region: 'EU', category: 'quality', code: 'EN 1995' },
  { value: 'eu_en_1996', label: 'EN 1996 — Eurocode 6: Masonry Structures', region: 'EU', category: 'quality', code: 'EN 1996' },
  { value: 'eu_en_1997', label: 'EN 1997 — Eurocode 7: Geotechnical Design', region: 'EU', category: 'quality', code: 'EN 1997' },
  { value: 'eu_en_1998', label: 'EN 1998 — Eurocode 8: Seismic Design', region: 'EU', category: 'quality', code: 'EN 1998' },
  { value: 'eu_en_1999', label: 'EN 1999 — Eurocode 9: Aluminium Structures', region: 'EU', category: 'quality', code: 'EN 1999' },
  { value: 'eu_cpr_305', label: 'EU CPR 305/2011 — Construction Products Regulation', region: 'EU', category: 'quality', code: '305/2011/EU' },
  { value: 'eu_en_81', label: 'EN 81 — Safety Rules for Lifts', region: 'EU', category: 'quality', code: 'EN 81' },
  { value: 'eu_bs_en', label: 'BS EN — British Adopted European Standards', region: 'EU', category: 'quality', code: 'BS EN' },

  // ── Europe — Environmental ──
  { value: 'eu_emas', label: 'EU EMAS — Eco-Management & Audit Scheme', region: 'EU', category: 'environmental', code: 'EMAS' },
  { value: 'eu_breeam', label: 'BREEAM — Building Research Environmental Assessment', region: 'EU', category: 'environmental', code: 'BREEAM' },
  { value: 'eu_epbd', label: 'EU EPBD — Energy Performance of Buildings Directive', region: 'EU', category: 'environmental', code: 'EPBD' },
  { value: 'eu_waste_framework', label: 'EU Waste Framework Directive 2008/98/EC', region: 'EU', category: 'environmental', code: '2008/98/EC' },
  { value: 'eu_water_framework', label: 'EU Water Framework Directive 2000/60/EC', region: 'EU', category: 'environmental', code: '2000/60/EC' },

  // ── Iran — Safety ──
  { value: 'ir_hse_regulations', label: 'Iran HSE Regulations — Ministry of Labour', region: 'IR', category: 'safety', code: 'IR HSE' },
  { value: 'ir_ohs_construction', label: 'Iran Construction Site Safety Bylaws', region: 'IR', category: 'safety', code: 'IR CSS' },
  { value: 'ir_fire_safety', label: 'Iran Fire Safety & Emergency Regulations', region: 'IR', category: 'safety', code: 'IR Fire' },
  { value: 'ir_electrical_safety', label: 'Iran Electrical Safety Code (IEEE-IR adapted)', region: 'IR', category: 'safety', code: 'IR Elec' },

  // ── Iran — Quality / Building ──
  { value: 'ir_national_building_codes', label: 'Iran National Building Regulations (Melli)', region: 'IR', category: 'quality', code: 'Melli' },
  { value: 'ir_standard_2800', label: 'Iran Standard 2800 — Seismic Design of Buildings', region: 'IR', category: 'quality', code: 'ISIRI 2800' },
  { value: 'ir_standard_413', label: 'Iran Standard 413 — Concrete Structures (Aba)', region: 'IR', category: 'quality', code: 'ISIRI 413' },
  { value: 'ir_standard_414', label: 'Iran Standard 414 — Steel Structures Design', region: 'IR', category: 'quality', code: 'ISIRI 414' },
  { value: 'ir_development_bylaw_12', label: '12th Development Plan — Construction Requirements', region: 'IR', category: 'quality', code: 'Plan 12' },
  { value: 'ir_development_bylaw_13', label: '13th Development Plan — Construction Requirements', region: 'IR', category: 'quality', code: 'Plan 13' },
  { value: 'ir_municipal_building_code', label: 'Tehran / Municipal Building Codes', region: 'IR', category: 'quality', code: 'Municipal' },
  { value: 'ir_road_highway_standards', label: 'Iran Road & Highway Construction Standards', region: 'IR', category: 'quality', code: 'IR Roads' },
  { value: 'ir_isiri_general', label: 'ISIRI — Institute of Standards & Industrial Research', region: 'IR', category: 'quality', code: 'ISIRI' },

  // ── Iran — Environmental ──
  { value: 'ir_environmental_protection_law', label: 'Iran Environmental Protection Law', region: 'IR', category: 'environmental', code: 'IEPL' },
  { value: 'ir_wastewater_standards', label: 'Iran Wastewater Discharge Standards', region: 'IR', category: 'environmental', code: 'IR WW' },
  { value: 'ir_air_quality', label: 'Iran Air Quality & Emissions Standards', region: 'IR', category: 'environmental', code: 'IR Air' },
  { value: 'ir_energy_efficiency_buildings', label: 'Iran Energy Efficiency in Buildings Directive', region: 'IR', category: 'environmental', code: 'IR Energy' },
]

export const STANDARDS_REGIONS = [
  { value: 'ALL', label: 'All regions' },
  { value: 'US', label: REGION_LABELS.US },
  { value: 'CA', label: REGION_LABELS.CA },
  { value: 'DE', label: REGION_LABELS.DE },
  { value: 'EU', label: REGION_LABELS.EU },
  { value: 'IR', label: REGION_LABELS.IR },
  { value: 'INTL', label: REGION_LABELS.INTL },
] as const

export function getStandardsByCategory(category: StandardCategory, regionFilter: string = 'ALL') {
  return CONSTRUCTION_STANDARDS.filter(
    (s) => s.category === category && (regionFilter === 'ALL' || s.region === regionFilter)
  )
}

export function toSelectOptions(standards: ConstructionStandard[]) {
  return standards.map((s) => ({
    value: s.value,
    label: `[${s.region}] ${s.label}`,
  }))
}

export function toGroupedSelectOptions(standards: ConstructionStandard[]) {
  const groups = new Map<StandardRegion, ConstructionStandard[]>()
  for (const s of standards) {
    const list = groups.get(s.region) ?? []
    list.push(s)
    groups.set(s.region, list)
  }

  return Array.from(groups.entries()).map(([region, items]) => ({
    group: REGION_LABELS[region],
    options: items.map((s) => ({ value: s.value, label: s.label })),
  }))
}

export function findStandard(value: string | undefined) {
  if (!value) return undefined
  return CONSTRUCTION_STANDARDS.find((s) => s.value === value)
}
