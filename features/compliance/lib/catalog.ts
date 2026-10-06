/**
 * Data-driven compliance catalog.
 * Add new countries by extending REGULATORY_REGIONS + REGION_BASE_STANDARDS.
 * Add construction-type refinements in TYPE_ADDITIONAL_STANDARDS.
 */

import type {
AdditionalStandardKey,
ComplianceStandard,
ConstructionTypeKey,
RegulatoryRegionKey,
} from './types'

export const REGULATORY_REGIONS = [
  { value: 'germany', label: 'Germany' },
  { value: 'european_union', label: 'European Union' },
  { value: 'united_states', label: 'United States' },
  { value: 'canada', label: 'Canada' },
  { value: 'iran', label: 'Iran' },
  { value: 'international', label: 'International' },
  { value: 'custom', label: 'Custom' },
] as const

export const CONSTRUCTION_TYPES = [
  { value: 'general_building', label: 'General Building' },
  { value: 'industrial_building', label: 'Industrial Building' },
  { value: 'industrial_plant', label: 'Industrial Plant' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'railway', label: 'Railway' },
  { value: 'utility', label: 'Utility' },
] as const

export const ADDITIONAL_STANDARDS_OPTIONS = [
  { value: 'iso_9001', label: 'ISO 9001 — Quality Management' },
  { value: 'iso_14001', label: 'ISO 14001 — Environmental Management' },
  { value: 'iso_45001', label: 'ISO 45001 — Occupational Health & Safety' },
  { value: 'iso_19650', label: 'ISO 19650 — BIM / Information Management' },
  { value: 'leed', label: 'LEED — Green Building Certification' },
  { value: 'breeam', label: 'BREEAM — Building Environmental Assessment' },
  { value: 'dgnb', label: 'DGNB — German Sustainable Building Council' },
  { value: 'custom', label: 'Custom Standard (specify in notes)' },
] as const

/** Master standards registry — extend here; keys must remain stable for AI + DB */
export const COMPLIANCE_STANDARDS: Record<string, ComplianceStandard> = {
  // ── International / ISO ──
  iso_9001: { key: 'iso_9001', code: 'ISO 9001', name: 'Quality Management Systems', category: 'quality', family: 'ISO', aiReferenceId: 'iso_9001' },
  iso_14001: { key: 'iso_14001', code: 'ISO 14001', name: 'Environmental Management Systems', category: 'environmental', family: 'ISO', aiReferenceId: 'iso_14001' },
  iso_45001: { key: 'iso_45001', code: 'ISO 45001', name: 'Occupational Health & Safety Management', category: 'safety', family: 'ISO', aiReferenceId: 'iso_45001' },
  iso_19650: { key: 'iso_19650', code: 'ISO 19650', name: 'BIM / Information Management', category: 'bim', family: 'ISO', aiReferenceId: 'iso_19650' },

  // ── Germany ──
  de_din_general: { key: 'de_din_general', code: 'DIN', name: 'DIN Standards', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_general' },
  de_din_en: { key: 'de_din_en', code: 'DIN EN', name: 'DIN EN European Standards', category: 'quality', family: 'DIN EN', aiReferenceId: 'de_din_en_1090' },
  de_vob: { key: 'de_vob', code: 'VOB', name: 'VOB Construction Contract Procedures', category: 'contract', family: 'VOB', aiReferenceId: 'de_vob_c' },
  de_dguv: { key: 'de_dguv', code: 'DGUV', name: 'DGUV Accident Prevention Rules', category: 'safety', family: 'DGUV', aiReferenceId: 'de_dguv' },
  de_dgnb: { key: 'de_dgnb', code: 'DGNB', name: 'German Sustainable Building Council', category: 'environmental', family: 'DGNB', aiReferenceId: 'de_dgnb' },

  // ── Eurocodes (EU + DE) ──
  eu_en_1990: { key: 'eu_en_1990', code: 'EN 1990', name: 'Eurocode — Basis of Structural Design', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1990' },
  eu_en_1991: { key: 'eu_en_1991', code: 'EN 1991', name: 'Eurocode 1 — Actions on Structures', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1991' },
  eu_en_1992: { key: 'eu_en_1992', code: 'EN 1992', name: 'Eurocode 2 — Concrete Structures', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1992' },
  eu_en_1993: { key: 'eu_en_1993', code: 'EN 1993', name: 'Eurocode 3 — Steel Structures', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1993' },
  eu_en_1994: { key: 'eu_en_1994', code: 'EN 1994', name: 'Eurocode 4 — Composite Structures', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1994' },
  eu_en_1995: { key: 'eu_en_1995', code: 'EN 1995', name: 'Eurocode 5 — Timber Structures', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1995' },
  eu_en_1996: { key: 'eu_en_1996', code: 'EN 1996', name: 'Eurocode 6 — Masonry Structures', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1996' },
  eu_en_1997: { key: 'eu_en_1997', code: 'EN 1997', name: 'Eurocode 7 — Geotechnical Design', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1997' },
  eu_en_1998: { key: 'eu_en_1998', code: 'EN 1998', name: 'Eurocode 8 — Seismic Design', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1998' },
  eu_en_1999: { key: 'eu_en_1999', code: 'EN 1999', name: 'Eurocode 9 — Aluminium Structures', category: 'quality', family: 'Eurocodes', aiReferenceId: 'eu_en_1999' },
  eu_en_general: { key: 'eu_en_general', code: 'EN', name: 'European Standards (EN)', category: 'quality', family: 'EN', aiReferenceId: 'eu_bs_en' },
  eu_directive_89_391: { key: 'eu_directive_89_391', code: '89/391/EEC', name: 'EU Framework Directive — OHS', category: 'safety', family: 'EU Directives', aiReferenceId: 'eu_directive_89_391' },
  eu_directive_92_57: { key: 'eu_directive_92_57', code: '92/57/EEC', name: 'Temporary/Mobile Construction Sites', category: 'safety', family: 'EU Directives', aiReferenceId: 'eu_directive_92_57' },
  eu_cpr_305: { key: 'eu_cpr_305', code: 'CPR 305/2011', name: 'Construction Products Regulation', category: 'quality', family: 'EU Directives', aiReferenceId: 'eu_cpr_305' },
  eu_emas: { key: 'eu_emas', code: 'EMAS', name: 'Eco-Management & Audit Scheme', category: 'environmental', family: 'EMAS', aiReferenceId: 'eu_emas' },
  eu_epbd: { key: 'eu_epbd', code: 'EPBD', name: 'Energy Performance of Buildings Directive', category: 'environmental', family: 'EU Directives', aiReferenceId: 'eu_epbd' },

  // ── Germany (extended) ──
  de_arbschg: { key: 'de_arbschg', code: 'ArbSchG', name: 'Occupational Safety Act', category: 'safety', family: 'German Law', aiReferenceId: 'de_arbschg' },
  de_betr_sichv: { key: 'de_betr_sichv', code: 'BetrSichV', name: 'Industrial Safety Regulation', category: 'safety', family: 'German Law', aiReferenceId: 'de_betr_sichv' },
  de_trbs: { key: 'de_trbs', code: 'TRBS', name: 'Technical Rules for Operational Safety', category: 'safety', family: 'TRBS', aiReferenceId: 'de_trbs' },
  de_mbo: { key: 'de_mbo', code: 'MBO', name: 'Model Building Code', category: 'quality', family: 'German Law', aiReferenceId: 'de_mbo' },
  de_din_4108: { key: 'de_din_4108', code: 'DIN 4108', name: 'Thermal Protection in Buildings', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_4108' },
  de_din_4109: { key: 'de_din_4109', code: 'DIN 4109', name: 'Sound Insulation in Buildings', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_4109' },
  de_din_1045: { key: 'de_din_1045', code: 'DIN 1045', name: 'Concrete and Reinforced Concrete (legacy)', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_1045' },
  de_din_1045_1: { key: 'de_din_1045_1', code: 'DIN 1045-1', name: 'Concrete — Properties, Production and Conformity', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_1045_1' },
  de_din_1052: { key: 'de_din_1052', code: 'DIN 1052', name: 'Timber Structures — Design and Construction', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_1052' },
  de_din_1054: { key: 'de_din_1054', code: 'DIN 1054', name: 'Subsoil — Bearing Capacity & Settlement', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_1054' },
  de_din_1055: { key: 'de_din_1055', code: 'DIN 1055', name: 'Actions on Structures — Load Assumptions', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_1055' },
  de_din_488: { key: 'de_din_488', code: 'DIN 488', name: 'Reinforcing Steel — Shapes & Dimensions', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_488' },
  de_din_18202: { key: 'de_din_18202', code: 'DIN 18202', name: 'Tolerances in Building Construction', category: 'quality', family: 'DIN', aiReferenceId: 'de_din_18202' },
  de_din_18345: { key: 'de_din_18345', code: 'DIN 18345', name: 'General Construction Contract Procedures (VOB/C)', category: 'contract', family: 'DIN', aiReferenceId: 'de_din_18345' },
  de_din_en_1090: { key: 'de_din_en_1090', code: 'DIN EN 1090', name: 'Execution of Steel and Aluminium Structures', category: 'quality', family: 'DIN EN', aiReferenceId: 'de_din_en_1090' },
  de_din_en_206: { key: 'de_din_en_206', code: 'DIN EN 206', name: 'Concrete — Specification, Performance, Production', category: 'quality', family: 'DIN EN', aiReferenceId: 'de_din_en_206' },
  de_bimschg: { key: 'de_bimschg', code: 'BIMSchG', name: 'BIM Submission Act', category: 'bim', family: 'German Law', aiReferenceId: 'de_bimschg' },
  de_geg: { key: 'de_geg', code: 'GEG', name: 'Building Energy Act', category: 'environmental', family: 'German Law', aiReferenceId: 'de_geg' },

  // ── United States (extended) ──
  us_ibc: { key: 'us_ibc', code: 'IBC', name: 'International Building Code', category: 'quality', family: 'IBC', aiReferenceId: 'us_ibc' },
  us_irc: { key: 'us_irc', code: 'IRC', name: 'International Residential Code', category: 'quality', family: 'IRC', aiReferenceId: 'us_irc' },
  us_iecc: { key: 'us_iecc', code: 'IECC', name: 'International Energy Conservation Code', category: 'environmental', family: 'IECC', aiReferenceId: 'us_iecc' },
  us_imc: { key: 'us_imc', code: 'IMC', name: 'International Mechanical Code', category: 'quality', family: 'IMC', aiReferenceId: 'us_imc' },
  us_ipc: { key: 'us_ipc', code: 'IPC', name: 'International Plumbing Code', category: 'quality', family: 'IPC', aiReferenceId: 'us_ipc' },
  us_ifc_fire: { key: 'us_ifc_fire', code: 'IFC Fire', name: 'International Fire Code', category: 'safety', family: 'IFC', aiReferenceId: 'us_ifc_fire' },
  us_aci_318: { key: 'us_aci_318', code: 'ACI 318', name: 'Structural Concrete', category: 'quality', family: 'ACI', aiReferenceId: 'us_aci_318' },
  us_astm_general: { key: 'us_astm_general', code: 'ASTM', name: 'ASTM Standards', category: 'quality', family: 'ASTM', aiReferenceId: 'us_astm_general' },
  us_aisc_360: { key: 'us_aisc_360', code: 'AISC 360', name: 'Structural Steel Buildings', category: 'quality', family: 'AISC', aiReferenceId: 'us_aisc_360' },
  us_asce_7: { key: 'us_asce_7', code: 'ASCE 7', name: 'Minimum Design Loads', category: 'quality', family: 'ASCE', aiReferenceId: 'us_asce_7' },
  us_osha_1926: { key: 'us_osha_1926', code: 'OSHA 1926', name: 'Construction Safety', category: 'safety', family: 'OSHA', aiReferenceId: 'us_osha_1926' },
  us_osha_1910: { key: 'us_osha_1910', code: 'OSHA 1910', name: 'General Industry Safety', category: 'safety', family: 'OSHA', aiReferenceId: 'us_osha_1910' },
  us_nfpa_70e: { key: 'us_nfpa_70e', code: 'NFPA 70E', name: 'Electrical Safety in Workplace', category: 'safety', family: 'NFPA', aiReferenceId: 'us_nfpa_70e' },
  us_nfpa_101: { key: 'us_nfpa_101', code: 'NFPA 101', name: 'Life Safety Code', category: 'safety', family: 'NFPA', aiReferenceId: 'us_nfpa_101' },
  us_epa_nepa: { key: 'us_epa_nepa', code: 'NEPA', name: 'Environmental Protection', category: 'environmental', family: 'EPA', aiReferenceId: 'us_epa_nepa' },
  us_ashrae_901: { key: 'us_ashrae_901', code: 'ASHRAE 90.1', name: 'Energy Standard for Buildings', category: 'environmental', family: 'ASHRAE', aiReferenceId: 'us_ashrae_901' },

  // ── Canada (extended) ──
  ca_nbcc: { key: 'ca_nbcc', code: 'NBC', name: 'National Building Code of Canada', category: 'quality', family: 'NBC', aiReferenceId: 'ca_nbcc' },
  ca_nfc: { key: 'ca_nfc', code: 'NFC', name: 'National Fire Code of Canada', category: 'safety', family: 'National Fire Code', aiReferenceId: 'ca_nfc' },
  ca_npl: { key: 'ca_npl', code: 'NPC', name: 'National Plumbing Code of Canada', category: 'quality', family: 'NPC', aiReferenceId: 'ca_npl' },
  ca_csa_general: { key: 'ca_csa_general', code: 'CSA', name: 'CSA Standards', category: 'quality', family: 'CSA', aiReferenceId: 'ca_csa_s16' },
  ca_csa_a23: { key: 'ca_csa_a23', code: 'CSA A23', name: 'Concrete Materials & Construction', category: 'quality', family: 'CSA', aiReferenceId: 'ca_csa_a23' },
  ca_csa_s16: { key: 'ca_csa_s16', code: 'CSA S16', name: 'Design of Steel Structures', category: 'quality', family: 'CSA', aiReferenceId: 'ca_csa_s16' },
  ca_csa_o86: { key: 'ca_csa_o86', code: 'CSA O86', name: 'Engineering Design in Wood', category: 'quality', family: 'CSA', aiReferenceId: 'ca_csa_o86' },
  ca_electrical_code: { key: 'ca_electrical_code', code: 'CEC', name: 'Canadian Electrical Code', category: 'quality', family: 'Canadian Electrical Code', aiReferenceId: 'ca_csa_general' },
  ca_ohs_ontario: { key: 'ca_ohs_ontario', code: 'OHSA ON', name: 'Ontario OHS Act', category: 'safety', family: 'Canadian OHS', aiReferenceId: 'ca_ohs_ontario' },
  ca_ohs_alberta: { key: 'ca_ohs_alberta', code: 'OHS AB', name: 'Alberta OHS Code', category: 'safety', family: 'Canadian OHS', aiReferenceId: 'ca_ohs_alberta' },
  ca_ohs_bc: { key: 'ca_ohs_bc', code: 'OHS BC', name: 'WorkSafeBC Regulations', category: 'safety', family: 'Canadian OHS', aiReferenceId: 'ca_ohs_bc' },
  ca_cepaa: { key: 'ca_cepaa', code: 'CEPA', name: 'Canadian Environmental Protection Act', category: 'environmental', family: 'CEPA', aiReferenceId: 'ca_cepaa' },
  ca_leed_ca: { key: 'ca_leed_ca', code: 'LEED Canada', name: 'LEED Canada Certification', category: 'environmental', family: 'LEED', aiReferenceId: 'ca_leed_ca' },
  ca_national_energy_code: { key: 'ca_national_energy_code', code: 'NECB', name: 'National Energy Code for Buildings', category: 'environmental', family: 'NECB', aiReferenceId: 'ca_national_energy_code' },

  // ── Iran (extended) ──
  ir_national_building: { key: 'ir_national_building', code: 'Melli', name: 'Iranian National Building Regulations', category: 'quality', family: 'National Building Regulations', aiReferenceId: 'ir_national_building_codes' },
  ir_standard_2800: { key: 'ir_standard_2800', code: 'ISIRI 2800', name: 'Standard No. 2800 — Seismic Design', category: 'quality', family: 'Standard 2800', aiReferenceId: 'ir_standard_2800' },
  ir_standard_413: { key: 'ir_standard_413', code: 'ISIRI 413', name: 'Concrete Structures Design & Construction', category: 'quality', family: 'Standard 413', aiReferenceId: 'ir_standard_413' },
  ir_standard_414: { key: 'ir_standard_414', code: 'ISIRI 414', name: 'Steel Structures Design & Construction', category: 'quality', family: 'Standard 414', aiReferenceId: 'ir_standard_414' },
  ir_national_technical: { key: 'ir_national_technical', code: 'NTS', name: 'National Technical Specifications', category: 'quality', family: 'National Technical Specifications', aiReferenceId: 'ir_isiri_general' },
  ir_isiri_general: { key: 'ir_isiri_general', code: 'ISIRI', name: 'Institute of Standards & Industrial Research', category: 'quality', family: 'ISIRI', aiReferenceId: 'ir_isiri_general' },
  ir_hse: { key: 'ir_hse', code: 'IR HSE', name: 'Iran HSE Regulations', category: 'safety', family: 'HSE', aiReferenceId: 'ir_hse_regulations' },
  ir_ohs_construction: { key: 'ir_ohs_construction', code: 'IR OHS Site', name: 'Construction Site Safety Bylaws', category: 'safety', family: 'HSE', aiReferenceId: 'ir_ohs_construction' },
  ir_fire_safety: { key: 'ir_fire_safety', code: 'IR Fire', name: 'Fire Safety & Emergency Regulations', category: 'safety', family: 'Fire Safety', aiReferenceId: 'ir_fire_safety' },
  ir_electrical_safety: { key: 'ir_electrical_safety', code: 'IR Electrical', name: 'Electrical Safety Code', category: 'safety', family: 'Electrical Safety', aiReferenceId: 'ir_electrical_safety' },
  ir_development_bylaw_12: { key: 'ir_development_bylaw_12', code: 'Bylaw 12', name: 'Development Plan — Construction Requirements (12)', category: 'quality', family: 'Development Plan', aiReferenceId: 'ir_development_bylaw_12' },
  ir_development_bylaw_13: { key: 'ir_development_bylaw_13', code: 'Bylaw 13', name: 'Development Plan — Construction Requirements (13)', category: 'quality', family: 'Development Plan', aiReferenceId: 'ir_development_bylaw_13' },
  ir_municipal_building: { key: 'ir_municipal_building', code: 'Municipal', name: 'Municipal Building Codes', category: 'quality', family: 'Municipal Codes', aiReferenceId: 'ir_municipal_building' },
  ir_road_highway: { key: 'ir_road_highway', code: 'IR Roads', name: 'Iran Road & Highway Standards', category: 'quality', family: 'Highway', aiReferenceId: 'ir_road_highway_standards' },
  ir_environmental_law: { key: 'ir_environmental_law', code: 'IR Env Law', name: 'Environmental Protection Law', category: 'environmental', family: 'Environmental', aiReferenceId: 'ir_environmental_law' },
  ir_wastewater: { key: 'ir_wastewater', code: 'IR Wastewater', name: 'Wastewater Discharge Standards', category: 'environmental', family: 'Environmental', aiReferenceId: 'ir_wastewater' },
  ir_air_quality: { key: 'ir_air_quality', code: 'IR Air', name: 'Air Quality & Emissions Standards', category: 'environmental', family: 'Environmental', aiReferenceId: 'ir_air_quality' },
  ir_energy_efficiency: { key: 'ir_energy_efficiency', code: 'IR Energy', name: 'Energy Efficiency in Buildings', category: 'environmental', family: 'Energy', aiReferenceId: 'ir_energy_efficiency' },

  // ── International ──
  iso_50001: { key: 'iso_50001', code: 'ISO 50001', name: 'Energy Management Systems', category: 'environmental', family: 'ISO', aiReferenceId: 'iso_50001' },
  ifc_4: { key: 'ifc_4', code: 'IFC 4', name: 'Open BIM Data Model', category: 'bim', family: 'buildingSMART', aiReferenceId: 'ifc_4' },

  // ── Sustainability add-ons ──
  us_leed: { key: 'us_leed', code: 'LEED', name: 'LEED Green Building Certification', category: 'environmental', family: 'LEED', aiReferenceId: 'us_leed' },
  eu_breeam: { key: 'eu_breeam', code: 'BREEAM', name: 'BREEAM Environmental Assessment', category: 'environmental', family: 'BREEAM', aiReferenceId: 'eu_breeam' },

  // ── Construction-type specific ──
  us_aashto: { key: 'us_aashto', code: 'AASHTO', name: 'Highway & Bridge Design', category: 'quality', family: 'AASHTO', aiReferenceId: 'us_aashto' },
  eu_en_81: { key: 'eu_en_81', code: 'EN 81', name: 'Safety Rules for Lifts', category: 'safety', family: 'EN', aiReferenceId: 'eu_en_81' },
}

/** Base standards auto-activated per regulatory region (user does NOT pick these manually) */
export const REGION_BASE_STANDARDS: Record<RegulatoryRegionKey, string[]> = {
  germany: [
    'eu_en_1990', 'eu_en_1991', 'eu_en_1992', 'eu_en_1993', 'eu_en_1997', 'eu_en_1998',
    'de_din_general', 'de_din_en', 'de_vob', 'de_dguv',
  ],
  european_union: [
    'eu_en_1990', 'eu_en_1991', 'eu_en_1992', 'eu_en_1993', 'eu_en_1997', 'eu_en_1998',
    'eu_en_general', 'iso_9001', 'iso_14001', 'iso_45001',
  ],
  united_states: [
    'us_ibc', 'us_aci_318', 'us_astm_general', 'us_aisc_360', 'us_osha_1926',
  ],
  canada: [
    'ca_nbcc', 'ca_csa_general', 'ca_electrical_code', 'ca_nfc',
  ],
  iran: [
    'ir_national_building', 'ir_standard_2800', 'ir_national_technical', 'ir_hse',
  ],
  international: [
    'iso_9001', 'iso_14001', 'iso_45001', 'iso_19650',
  ],
  custom: [],
}

/** Extra standards activated when a specific construction type is selected */
export const TYPE_ADDITIONAL_STANDARDS: Partial<Record<ConstructionTypeKey, string[]>> = {
  bridge: ['us_aashto', 'eu_en_1991', 'ir_road_highway'],
  railway: ['eu_en_1991', 'ir_road_highway'],
  infrastructure: ['us_aashto', 'ir_road_highway'],
  tunnel: ['eu_en_1997', 'us_osha_1926'],
  industrial_plant: ['iso_45001', 'iso_14001'],
  utility: ['ca_electrical_code', 'us_osha_1926'],
}

/** Map optional multi-select keys to catalog standard keys */
export const ADDITIONAL_STANDARD_MAP: Record<AdditionalStandardKey, string[]> = {
  iso_9001: ['iso_9001'],
  iso_14001: ['iso_14001'],
  iso_45001: ['iso_45001'],
  iso_19650: ['iso_19650'],
  leed: ['us_leed'],
  breeam: ['eu_breeam'],
  dgnb: ['de_dgnb'],
  custom: [],
}

export function getStandardByKey(key: string): ComplianceStandard | undefined {
  return COMPLIANCE_STANDARDS[key]
}

export function listStandards(keys: string[]): ComplianceStandard[] {
  const seen = new Set<string>()
  const result: ComplianceStandard[] = []
  for (const key of keys) {
    if (seen.has(key)) continue
    const std = COMPLIANCE_STANDARDS[key]
    if (std) {
      seen.add(key)
      result.push(std)
    }
  }
  return result
}
