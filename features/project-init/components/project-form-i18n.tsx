'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import {
PROJECT_TYPES,
PROJECT_STATUSES,
CONTRACT_TYPES,
BUILDING_CLASSIFICATIONS,
PROJECT_PHASES,
SECTORS,
COUNTRIES,
STRUCTURE_TYPES,
FOUNDATION_TYPES,
SOIL_CLASSIFICATIONS,
DESIGN_STAGES,
WORKING_DAYS_OPTIONS,
HOLIDAY_CALENDARS,
SHIFT_PATTERNS,
PROGRESS_METHODS,
REPORTING_FREQUENCIES,
REGIONS,
TIMEZONES,
STANDARDS_REGIONS,
BIM_LEVELS,
CURRENCIES,
LANGUAGES,
DATE_FORMATS,
WEATHER_PROVIDERS,
} from '@/features/project-init/lib/constants'
import type { FormDictionary, FormLocale } from '@/features/project-init/lib/i18n/types'
import { getDictionary, isRtlLocale, tPath } from '@/features/project-init/lib/i18n/utils'

interface ProjectFormI18nContextValue {
  locale: FormLocale
  dir: 'ltr' | 'rtl'
  dict: FormDictionary
  t: (path: string) => string
  options: {
    projectTypes: { value: string; label: string }[]
    projectStatuses: { value: string; label: string }[]
    contractTypes: { value: string; label: string }[]
    buildingClassifications: { value: string; label: string }[]
    projectPhases: { value: string; label: string }[]
    sectors: { value: string; label: string }[]
    countries: { value: string; label: string }[]
    structureTypes: { value: string; label: string }[]
    foundationTypes: { value: string; label: string }[]
    soilClassifications: { value: string; label: string }[]
    designStages: { value: string; label: string }[]
    workingDays: { value: string; label: string }[]
    holidayCalendars: { value: string; label: string }[]
    shiftPatterns: { value: string; label: string }[]
    progressMethods: { value: string; label: string }[]
    reportingFrequencies: { value: string; label: string }[]
    regions: { value: string; label: string }[]
    timezones: { value: string; label: string }[]
    standardsRegions: { value: string; label: string }[]
    bimLevels: { value: string; label: string }[]
    currencies: { value: string; label: string }[]
    languages: { value: string; label: string }[]
    dateFormats: { value: string; label: string }[]
    weatherProviders: { value: string; label: string }[]
  }
  translateValidation: (message?: string) => string | undefined
}

const ProjectFormI18nContext = createContext<ProjectFormI18nContextValue | null>(null)

function buildOptions(dict: FormDictionary) {
  return {
    projectTypes: PROJECT_TYPES.map((item) => ({
      value: item.value,
      label: dict.options.projectTypes[item.value] ?? item.value,
    })),
    projectStatuses: PROJECT_STATUSES.map((item) => ({
      value: item.value,
      label: dict.options.projectStatuses[item.value] ?? item.value,
    })),
    contractTypes: CONTRACT_TYPES.map((item) => ({
      value: item.value,
      label: dict.options.contractTypes[item.value] ?? item.value,
    })),
    buildingClassifications: BUILDING_CLASSIFICATIONS.map((item) => ({
      value: item.value,
      label: dict.options.buildingClassifications[item.value] ?? item.value,
    })),
    projectPhases: PROJECT_PHASES.map((item) => ({
      value: item.value,
      label: dict.options.projectPhases[item.value] ?? item.value,
    })),
    sectors: SECTORS.map((item) => ({
      value: item.value,
      label: dict.options.sectors[item.value] ?? item.value,
    })),
    countries: COUNTRIES.map((item) => ({
      value: item.value,
      label: dict.options.countries[item.value] ?? item.value,
    })),
    structureTypes: STRUCTURE_TYPES.map((item) => ({
      value: item.value,
      label: dict.options.structureTypes[item.value] ?? item.value,
    })),
    foundationTypes: FOUNDATION_TYPES.map((item) => ({
      value: item.value,
      label: dict.options.foundationTypes[item.value] ?? item.value,
    })),
    soilClassifications: SOIL_CLASSIFICATIONS.map((item) => ({
      value: item.value,
      label: dict.options.soilClassifications[item.value] ?? item.value,
    })),
    designStages: DESIGN_STAGES.map((item) => ({
      value: item.value,
      label: dict.options.designStages[item.value] ?? item.value,
    })),
    workingDays: WORKING_DAYS_OPTIONS.map((item) => ({
      value: item.value,
      label: dict.options.workingDays[item.value] ?? item.value,
    })),
    holidayCalendars: HOLIDAY_CALENDARS.map((item) => ({
      value: item.value,
      label: dict.options.holidayCalendars[item.value] ?? item.value,
    })),
    shiftPatterns: SHIFT_PATTERNS.map((item) => ({
      value: item.value,
      label: dict.options.shiftPatterns[item.value] ?? item.value,
    })),
    progressMethods: PROGRESS_METHODS.map((item) => ({
      value: item.value,
      label: dict.options.progressMethods[item.value] ?? item.value,
    })),
    reportingFrequencies: REPORTING_FREQUENCIES.map((item) => ({
      value: item.value,
      label: dict.options.reportingFrequencies[item.value] ?? item.value,
    })),
    regions: REGIONS.map((item) => ({
      value: item.value,
      label: dict.options.regions[item.value] ?? item.value,
    })),
    timezones: TIMEZONES.map((item) => ({
      value: item.value,
      label: dict.options.timezones[item.value] ?? item.value,
    })),
    standardsRegions: STANDARDS_REGIONS.map((item) => ({
      value: item.value,
      label: dict.options.standardsRegions[item.value] ?? item.value,
    })),
    bimLevels: BIM_LEVELS.map((item) => ({
      value: item.value,
      label: dict.options.bimLevels[item.value] ?? item.value,
    })),
    currencies: CURRENCIES.map((item) => ({
      value: item.value,
      label: dict.options.currencies[item.value] ?? item.value,
    })),
    languages: LANGUAGES.map((item) => ({
      value: item.value,
      label: dict.options.languages[item.value] ?? item.value,
    })),
    dateFormats: DATE_FORMATS.map((item) => ({
      value: item.value,
      label: dict.options.dateFormats[item.value] ?? item.value,
    })),
    weatherProviders: WEATHER_PROVIDERS.map((item) => ({
      value: item.value,
      label: dict.options.weatherProviders[item.value] ?? item.value,
    })),
  }
}

export function ProjectFormI18nProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale()
  const dict = getDictionary(locale)

  const value = useMemo<ProjectFormI18nContextValue>(
    () => ({
      locale,
      dir: isRtlLocale(locale) ? 'rtl' : 'ltr',
      dict,
      t: (path: string) => tPath(dict, path),
      options: buildOptions(dict),
      translateValidation: (message?: string) => {
        if (!message) return undefined
        if (message.startsWith('validation.')) {
          const key = message.replace('validation.', '')
          return dict.validation[key] ?? message
        }
        return message
      },
    }),
    [locale, dict]
  )

  return <ProjectFormI18nContext.Provider value={value}>{children}</ProjectFormI18nContext.Provider>
}

export function useProjectFormI18n() {
  const ctx = useContext(ProjectFormI18nContext)
  if (!ctx) {
    throw new Error('useProjectFormI18n must be used within ProjectFormI18nProvider')
  }
  return ctx
}

/** Safe hook for fields outside provider during SSR edge cases */
export function useProjectFormI18nSafe() {
  const ctx = useContext(ProjectFormI18nContext)
  const dict = getDictionary('en')
  if (ctx) return ctx
  return {
    locale: 'en' as FormLocale,
    dir: 'ltr' as const,
    dict,
    t: (path: string) => tPath(dict, path),
    options: buildOptions(dict),
    translateValidation: (message?: string) => message,
  }
}
