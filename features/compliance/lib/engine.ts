/**
 * Compliance Engine — resolves standards from region, construction type, and user selection.
 */

import { customStandardKey, isCustomStandardKey, listCustomStandards } from './custom-standards'
import { getStandardByKey, listStandards } from './catalog'
import {
computeDefaultSelectedKeys,
computeDefaultSelectedKeysForRegions,
computeMandatoryStandardKeys,
computeMandatoryStandardKeysForRegions,
getAvailableStandardKeys,
getAvailableStandardKeysForRegions,
} from './region-standards'
import type {
ComplianceResolutionInput,
ComplianceResolutionResult,
ComplianceStandard,
ConstructionTypeKey,
CustomStandardEntry,
RegulatoryRegionKey,
} from './types'

const ALL_CONSTRUCTION_TYPES: ConstructionTypeKey[] = [
  'general_building', 'industrial_building', 'industrial_plant', 'infrastructure',
  'bridge', 'tunnel', 'railway', 'utility',
]

function isRegulatoryRegion(value: string): value is RegulatoryRegionKey {
  return ['germany', 'european_union', 'united_states', 'canada', 'iran', 'international', 'custom'].includes(value)
}

function isConstructionType(value: string): value is ConstructionTypeKey {
  return ALL_CONSTRUCTION_TYPES.includes(value as ConstructionTypeKey)
}

function groupByFamily(standards: ComplianceStandard[]): Record<string, ComplianceStandard[]> {
  return standards.reduce<Record<string, ComplianceStandard[]>>((acc, std) => {
    const list = acc[std.family] ?? []
    list.push(std)
    acc[std.family] = list
    return acc
  }, {})
}

function ensureMandatoryIncluded(selected: string[], mandatory: string[]): string[] {
  return [...new Set([...mandatory, ...selected])]
}

function mergeCatalogAndCustom(
  catalogKeys: string[],
  customEntries: CustomStandardEntry[]
): ComplianceStandard[] {
  const catalog = listStandards(catalogKeys)
  const custom = listCustomStandards(customEntries)
  const seen = new Set<string>()
  const merged: ComplianceStandard[] = []
  for (const std of [...catalog, ...custom]) {
    if (seen.has(std.key)) continue
    seen.add(std.key)
    merged.push(std)
  }
  return merged
}

export function resolveComplianceProfile(input: ComplianceResolutionInput): ComplianceResolutionResult {
  const regions =
    input.regulatoryRegions && input.regulatoryRegions.length > 0
      ? input.regulatoryRegions.filter((r) => r !== 'custom')
      : []
  const region = isRegulatoryRegion(input.regulatoryRegion) ? input.regulatoryRegion : 'custom'
  const useMulti = regions.length > 0 && region !== 'custom'
  const constructionType = isConstructionType(input.constructionType)
    ? input.constructionType
    : 'general_building'

  const mandatoryKeys = useMulti
    ? computeMandatoryStandardKeysForRegions(regions, constructionType)
    : computeMandatoryStandardKeys(region, constructionType)
  const availableKeys = new Set(
    useMulti ? getAvailableStandardKeysForRegions(regions) : getAvailableStandardKeys(region)
  )
  const customEntries = input.customStandards ?? []
  const customKeys = customEntries.map((e) => customStandardKey(e.id))

  let catalogSelectedKeys: string[]
  if (input.selectedStandards && input.selectedStandards.length > 0) {
    catalogSelectedKeys = ensureMandatoryIncluded(
      input.selectedStandards.filter(
        (k) => !isCustomStandardKey(k) && (availableKeys.has(k) || mandatoryKeys.includes(k))
      ),
      mandatoryKeys
    )
  } else if (region === 'custom') {
    catalogSelectedKeys = []
  } else {
    catalogSelectedKeys = useMulti
      ? computeDefaultSelectedKeysForRegions(regions, constructionType)
      : computeDefaultSelectedKeys(region, constructionType)
  }

  const selectedKeys = [...new Set([...catalogSelectedKeys, ...customKeys])]
  const activatedStandards = mergeCatalogAndCustom(catalogSelectedKeys, customEntries)
  const standardsByFamily = groupByFamily(activatedStandards)
  const mandatoryStandards = listStandards(mandatoryKeys.filter((k) => catalogSelectedKeys.includes(k)))
  const optionalStandards = activatedStandards.filter(
    (s) => !mandatoryKeys.includes(s.key) && !isCustomStandardKey(s.key)
  )
  const customStandardsResolved = listCustomStandards(customEntries)

  const customNotes: string[] = []
  if (input.customRegulatoryNote?.trim()) customNotes.push(input.customRegulatoryNote.trim())
  if (input.customStandardNote?.trim()) customNotes.push(input.customStandardNote.trim())
  for (const entry of customEntries) {
    if (entry.description?.trim()) {
      customNotes.push(`${entry.code}: ${entry.description.trim()}`)
    }
  }

  return {
    regulatoryRegion: useMulti ? regions.join('+') : region,
    constructionType,
    selectedStandards: selectedKeys,
    customStandards: customEntries,
    mandatoryStandards,
    optionalStandards,
    additionalStandards: input.additionalStandards ?? [],
    activatedStandards,
    standardsByFamily,
    aiComplianceContext: {
      regulatoryRegion: region,
      constructionType,
      standardKeys: activatedStandards.map((s) => s.key),
      mandatoryStandardKeys: mandatoryStandards.map((s) => s.key),
      customStandardKeys: customStandardsResolved.map((s) => s.key),
      optionalStandardKeys: optionalStandards.map((s) => s.key),
      standardCodes: activatedStandards.map((s) => s.code),
      aiReferenceIds: activatedStandards.map((s) => s.aiReferenceId),
      families: [...new Set(activatedStandards.map((s) => s.family))],
      customNotes,
    },
  }
}

export function getAiReferenceIds(input: ComplianceResolutionInput): string[] {
  return resolveComplianceProfile(input).aiComplianceContext.aiReferenceIds
}

export function summarizeComplianceProfile(input: ComplianceResolutionInput): string {
  const result = resolveComplianceProfile(input)
  const families = Object.keys(result.standardsByFamily).join(', ')
  return `${result.activatedStandards.length} standards active (${families || 'none — configure custom notes'})`
}

export function getStandardMeta(key: string) {
  return getStandardByKey(key)
}
