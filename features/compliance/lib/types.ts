/**
 * Construction Compliance — core types for the hierarchical compliance engine.
 * Designed so new regions/standards can be added via catalog + DB seed without schema changes.
 */

export type RegulatoryRegionKey =
  | 'germany'
  | 'european_union'
  | 'united_states'
  | 'canada'
  | 'iran'
  | 'international'
  | 'custom'

export type ConstructionTypeKey =
  | 'general_building'
  | 'industrial_building'
  | 'industrial_plant'
  | 'infrastructure'
  | 'bridge'
  | 'tunnel'
  | 'railway'
  | 'utility'

export type ComplianceStandardCategory = 'safety' | 'quality' | 'environmental' | 'bim' | 'contract' | 'general'

export type AdditionalStandardKey =
  | 'iso_9001'
  | 'iso_14001'
  | 'iso_45001'
  | 'iso_19650'
  | 'leed'
  | 'breeam'
  | 'dgnb'
  | 'custom'

/** Canonical standard record — stable `key` is used by AI and stored in DB */
export interface ComplianceStandard {
  key: string
  code: string
  name: string
  category: ComplianceStandardCategory
  /** Document family label shown in UI (e.g. "Eurocodes", "DIN") */
  family: string
  aiReferenceId: string
  description?: string
}

/** User-defined standard entry from the project initialization form */
export interface CustomStandardEntry {
  id: string
  code: string
  name: string
  description?: string
  category?: ComplianceStandardCategory | string
}

export interface ComplianceResolutionInput {
  regulatoryRegion: RegulatoryRegionKey | string
  /** When multiple frameworks apply (e.g. Germany + EU), merge their standards */
  regulatoryRegions?: string[]
  constructionType: ConstructionTypeKey | string
  /** User-selected catalog standard keys (mandatory keys are always enforced) */
  selectedStandards?: string[]
  /** Standards defined by the user when not in the catalog */
  customStandards?: CustomStandardEntry[]
  additionalStandards?: string[]
  customRegulatoryNote?: string
  customStandardNote?: string
}

/** Output consumed by project persistence and AI analysis pipelines */
export interface ComplianceResolutionResult {
  regulatoryRegion: string
  constructionType: string
  selectedStandards: string[]
  customStandards: CustomStandardEntry[]
  mandatoryStandards: ComplianceStandard[]
  optionalStandards: ComplianceStandard[]
  additionalStandards: string[]
  /** Final activated set — deduplicated */
  activatedStandards: ComplianceStandard[]
  /** Grouped by family for dashboard display */
  standardsByFamily: Record<string, ComplianceStandard[]>
  /** Compact payload for AI prompts and rule engines */
  aiComplianceContext: {
    regulatoryRegion: string
    constructionType: string
    standardKeys: string[]
    mandatoryStandardKeys: string[]
    customStandardKeys: string[]
    optionalStandardKeys: string[]
    standardCodes: string[]
    aiReferenceIds: string[]
    families: string[]
    customNotes: string[]
  }
}

export interface ProjectComplianceRecord {
  projectId: string
  regulatoryRegion: string
  constructionType: string
  additionalStandards: string[]
  activatedStandardsJson: ComplianceStandard[]
  aiComplianceContextJson: ComplianceResolutionResult['aiComplianceContext']
  customRegulatoryNote?: string
  customStandardNote?: string
}
