/**
 * Full standard lists per regulatory region + mandatory rules.
 */

import type { ConstructionTypeKey, RegulatoryRegionKey } from './types'

export const REGION_AVAILABLE_STANDARDS: Record<RegulatoryRegionKey, string[]> = {
  germany: [
    'eu_en_1990', 'eu_en_1991', 'eu_en_1992', 'eu_en_1993', 'eu_en_1994', 'eu_en_1995',
    'eu_en_1997', 'eu_en_1998', 'de_din_general', 'de_din_en', 'de_din_en_1090', 'de_vob', 'de_dguv',
    'de_arbschg', 'de_betr_sichv', 'de_trbs', 'de_mbo', 'de_din_4108', 'de_din_4109', 'de_din_1045',
    'de_din_1052', 'de_din_1054', 'de_din_1055', 'de_din_18345', 'de_din_488', 'de_din_18202',
    'de_din_1045_1', 'de_din_en_206', 'de_bimschg', 'de_dgnb', 'de_geg', 'iso_9001', 'iso_14001',
    'iso_45001', 'iso_19650',
  ],
  european_union: [
    'eu_en_1990', 'eu_en_1991', 'eu_en_1992', 'eu_en_1993', 'eu_en_1994', 'eu_en_1995',
    'eu_en_1996', 'eu_en_1997', 'eu_en_1998', 'eu_en_1999', 'eu_en_general', 'eu_en_81',
    'eu_directive_89_391', 'eu_directive_92_57', 'eu_cpr_305', 'eu_emas', 'eu_breeam', 'eu_epbd',
    'iso_9001', 'iso_14001', 'iso_45001', 'iso_19650',
  ],
  united_states: [
    'us_ibc', 'us_irc', 'us_iecc', 'us_imc', 'us_ipc', 'us_ifc_fire',
    'us_aci_318', 'us_astm_general', 'us_aisc_360', 'us_asce_7', 'us_aashto',
    'us_osha_1926', 'us_osha_1910', 'us_nfpa_70e', 'us_nfpa_101',
    'us_epa_nepa', 'us_leed', 'us_ashrae_901', 'iso_9001', 'iso_14001', 'iso_45001',
  ],
  canada: [
    'ca_nbcc', 'ca_nfc', 'ca_npl', 'ca_csa_general', 'ca_csa_a23', 'ca_csa_s16', 'ca_csa_o86',
    'ca_electrical_code', 'ca_ohs_ontario', 'ca_ohs_alberta', 'ca_ohs_bc',
    'ca_cepaa', 'ca_leed_ca', 'ca_national_energy_code', 'iso_9001', 'iso_14001', 'iso_45001',
  ],
  iran: [
    'ir_national_building', 'ir_standard_2800', 'ir_standard_413', 'ir_standard_414',
    'ir_national_technical', 'ir_isiri_general', 'ir_hse', 'ir_ohs_construction',
    'ir_fire_safety', 'ir_electrical_safety', 'ir_development_bylaw_12', 'ir_development_bylaw_13',
    'ir_municipal_building', 'ir_road_highway', 'ir_environmental_law', 'ir_wastewater',
    'ir_air_quality', 'ir_energy_efficiency', 'iso_9001', 'iso_14001', 'iso_45001', 'iso_19650',
  ],
  international: ['iso_9001', 'iso_14001', 'iso_45001', 'iso_19650', 'iso_50001', 'ifc_4'],
  custom: [],
}

export const REGION_MANDATORY_STANDARDS: Record<RegulatoryRegionKey, string[]> = {
  germany: ['eu_en_1990', 'de_din_general', 'de_vob', 'de_dguv'],
  european_union: ['eu_en_1990', 'eu_en_1992', 'iso_45001'],
  united_states: ['us_ibc', 'us_osha_1926', 'us_aci_318'],
  canada: ['ca_nbcc', 'ca_nfc', 'ca_csa_general'],
  iran: ['ir_national_building', 'ir_standard_2800', 'ir_national_technical', 'ir_hse'],
  international: ['iso_9001', 'iso_45001'],
  custom: [],
}

export const TYPE_MANDATORY_STANDARDS: Partial<Record<ConstructionTypeKey, string[]>> = {
  bridge: ['ir_standard_2800', 'ir_road_highway', 'us_aashto', 'eu_en_1991'],
  railway: ['ir_road_highway', 'eu_en_1991'],
  infrastructure: ['ir_road_highway', 'us_aashto'],
  tunnel: ['eu_en_1997', 'us_osha_1926', 'ir_fire_safety'],
  industrial_plant: ['iso_45001', 'iso_14001', 'ir_environmental_law'],
  industrial_building: ['ir_standard_413', 'ir_standard_414'],
  utility: ['ca_electrical_code', 'ir_electrical_safety'],
}

export const TYPE_RECOMMENDED_STANDARDS: Partial<Record<ConstructionTypeKey, string[]>> = {
  general_building: ['ir_standard_413', 'ir_fire_safety'],
  bridge: ['ir_standard_414'],
  tunnel: ['ir_standard_2800'],
}

/** Optional certifications available in every non-custom region */
export const GLOBAL_OPTIONAL_STANDARDS = ['us_leed', 'eu_breeam', 'de_dgnb', 'iso_50001', 'ifc_4']

export function getAvailableStandardKeys(region: string): string[] {
  if (region in REGION_AVAILABLE_STANDARDS) {
    const base = REGION_AVAILABLE_STANDARDS[region as RegulatoryRegionKey]
    if (region === 'custom') return []
    return [...new Set([...base, ...GLOBAL_OPTIONAL_STANDARDS])]
  }
  return []
}

/** Merge available standards from multiple regulatory regions (e.g. Germany + EU). */
export function getAvailableStandardKeysForRegions(regions: string[]): string[] {
  const keys = new Set<string>()
  for (const region of regions) {
    if (region === 'custom') continue
    for (const key of getAvailableStandardKeys(region)) keys.add(key)
  }
  return [...keys]
}

export function computeMandatoryStandardKeys(region: string, constructionType: string): string[] {
  const regionKey = region in REGION_MANDATORY_STANDARDS ? (region as RegulatoryRegionKey) : 'custom'
  const base = REGION_MANDATORY_STANDARDS[regionKey] ?? []
  const typeMandatory = TYPE_MANDATORY_STANDARDS[constructionType as ConstructionTypeKey] ?? []
  const available = new Set(getAvailableStandardKeys(regionKey))
  return [...new Set([...base, ...typeMandatory])].filter((k) => available.has(k))
}

export function computeMandatoryStandardKeysForRegions(regions: string[], constructionType: string): string[] {
  const keys = new Set<string>()
  const available = new Set(getAvailableStandardKeysForRegions(regions))
  for (const region of regions) {
    if (region === 'custom') continue
    for (const key of computeMandatoryStandardKeys(region, constructionType)) {
      if (available.has(key)) keys.add(key)
    }
  }
  return [...keys]
}

export function computeRecommendedStandardKeys(region: string, constructionType: string): string[] {
  const regionKey = region in REGION_AVAILABLE_STANDARDS ? (region as RegulatoryRegionKey) : 'custom'
  const recommended = TYPE_RECOMMENDED_STANDARDS[constructionType as ConstructionTypeKey] ?? []
  const available = new Set(getAvailableStandardKeys(regionKey))
  return recommended.filter((k) => available.has(k))
}

export function computeRecommendedStandardKeysForRegions(regions: string[], constructionType: string): string[] {
  const keys = new Set<string>()
  const available = new Set(getAvailableStandardKeysForRegions(regions))
  for (const region of regions) {
    for (const key of computeRecommendedStandardKeys(region, constructionType)) {
      if (available.has(key)) keys.add(key)
    }
  }
  return [...keys]
}

export function computeDefaultSelectedKeys(region: string, constructionType: string): string[] {
  return [...new Set([...computeMandatoryStandardKeys(region, constructionType), ...computeRecommendedStandardKeys(region, constructionType)])]
}

export function computeDefaultSelectedKeysForRegions(regions: string[], constructionType: string): string[] {
  return [
    ...new Set([
      ...computeMandatoryStandardKeysForRegions(regions, constructionType),
      ...computeRecommendedStandardKeysForRegions(regions, constructionType),
    ]),
  ]
}
