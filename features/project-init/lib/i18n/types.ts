/**
 * @file features/project-init/lib/i18n/types.ts
 * @purpose تنظیمات و برچسب‌ها — راه‌اندازی پروژه (types)
 * @safe-to-edit YES
 * @affects راه‌اندازی پروژه
 * @depends-on nothing
 */

/** App UI locales — Persian default; English and German also supported. */
export type FormLocale = 'en' | 'de' | 'fa'

/** Display order in the language switcher (default fa first). */
export const FORM_LOCALES: FormLocale[] = ['fa', 'en', 'de']

export const RTL_LOCALES: FormLocale[] = ['fa']

export type OptionMap = Record<string, string>

export interface FormDictionary {
  ui: {
    back: string
    next: string
    submit: string
    step: string
    stepOf: string
    selectPlaceholder: string
    fixErrors: string
    successMessage: string
    successTitle: string
    successDescription: string
    goToProjects: string
    registerAnother: string
    countrySearchPlaceholder: string
    selected: string
    languageHint: string
    mandatoryStandard: string
    selectMandatoryOnly: string
    selectAllStandards: string
    addCustomStandard: string
    removeCustomStandard: string
    catalogStandards: string
    customStandardsShort: string
    customStandardCodePlaceholder: string
    customStandardNamePlaceholder: string
    customStandardDescPlaceholder: string
    showOnMap: string
    mapSearching: string
    mapLoading: string
    mapAddressPlaceholder: string
  }
  steps: Record<
    string,
    {
      title: string
      description: string
    }
  >
  subsections: Record<string, string>
  sections: Record<
    string,
    {
      title: string
      description: string
    }
  >
  fields: Record<string, string>
  descriptions: Record<string, string>
  options: {
    projectTypes: OptionMap
    projectStatuses: OptionMap
    contractTypes: OptionMap
    buildingClassifications: OptionMap
    projectPhases: OptionMap
    sectors: OptionMap
    countries: OptionMap
    structureTypes: OptionMap
    foundationTypes: OptionMap
    soilClassifications: OptionMap
    designStages: OptionMap
    workingDays: OptionMap
    holidayCalendars: OptionMap
    shiftPatterns: OptionMap
    progressMethods: OptionMap
    reportingFrequencies: OptionMap
    regions: OptionMap
    timezones: OptionMap
    standardsRegions: OptionMap
    bimLevels: OptionMap
    currencies: OptionMap
    languages: OptionMap
    dateFormats: OptionMap
    weatherProviders: OptionMap
    regulatoryRegions: OptionMap
    constructionTypes: OptionMap
    additionalStandards: OptionMap
  }
  standardRegionGroups: OptionMap
  standards: OptionMap
  validation: Record<string, string>
}
