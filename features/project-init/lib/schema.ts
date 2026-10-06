import { z } from 'zod'
import { resolveComplianceProfile } from '@/features/compliance/lib/engine'
import type { CustomStandardEntry } from '@/features/compliance/lib/types'

const optionalString = z.string().optional().or(z.literal(''))
const optionalNumber = z.coerce.number().optional().or(z.nan()).transform((v) => (Number.isNaN(v) ? undefined : v))

/** Section 1 — Project Information */
export const projectInfoSchema = z.object({
  projectName: z.string().min(2, 'validation.projectNameRequired'),
  projectCode: z.string().min(2, 'validation.projectCodeRequired'),
  projectType: z.string().min(1, 'validation.projectTypeRequired'),
  status: z.string().min(1, 'validation.statusRequired'),
  description: optionalString,
  clientName: z.string().min(2, 'validation.clientNameRequired'),
  clientContact: optionalString,
  clientEmail: z.string().email('validation.invalidEmail').optional().or(z.literal('')),
  clientPhone: optionalString,
  organizationName: optionalString,
  department: optionalString,
  contractType: z.string().min(1, 'validation.contractTypeRequired'),
  contractNumber: optionalString,
  contractValue: optionalNumber,
  contractStartDate: optionalString,
  contractEndDate: optionalString,
  buildingClassification: z.string().min(1, 'validation.buildingClassificationRequired'),
  projectPhase: z.string().min(1, 'validation.projectPhaseRequired'),
  sector: optionalString,
  estimatedWorkforce: optionalNumber,
  peakWorkforce: optionalNumber,
  internalNotes: optionalString,
  publicNotes: optionalString,
  address: z.string().min(3, 'validation.addressRequired'),
  city: z.string().min(2, 'validation.cityRequired'),
  country: z.string().min(1, 'validation.countryRequired'),
  latitude: optionalString,
  longitude: optionalString,
  siteArea: optionalNumber,
})

/** Section 2 — Project Team (role names; member IDs resolved server-side) */
export const projectTeamSchema = z.object({
  projectDirector: optionalString,
  projectManager: z.string().min(2, 'validation.projectManagerRequired'),
  constructionManager: optionalString,
  leadEngineer: optionalString,
  structuralEngineer: optionalString,
  mepEngineer: optionalString,
  qaManager: optionalString,
  qcInspector: optionalString,
  commercialManager: optionalString,
  procurementLead: optionalString,
})

/** Section 3 — Technical Information */
export const technicalInfoSchema = z.object({
  structureType: z.string().min(1, 'validation.structureTypeRequired'),
  primaryMaterial: optionalString,
  foundationType: z.string().min(1, 'validation.foundationTypeRequired'),
  soilClassification: optionalString,
  numberOfFloors: optionalNumber,
  totalBuiltArea: optionalNumber,
  basementLevels: optionalNumber,
  designStage: z.string().min(1, 'validation.designStageRequired'),
  designStandard: optionalString,
  architectFirm: optionalString,
})

/** Section 4 — Schedule & Working Hours (base object for merge / field keys) */
const scheduleHoursObjectSchema = z.object({
  plannedStartDate: z.string().min(1, 'validation.plannedStartRequired'),
  plannedFinishDate: z.string().min(1, 'validation.plannedFinishRequired'),
  actualStartDate: optionalString,
  workingDaysPerWeek: z.string().min(1, 'validation.workingDaysRequired'),
  publicHolidayCalendar: z.string().min(1, 'validation.holidayCalendarRequired'),
  shiftPattern: z.string().min(1, 'validation.shiftPatternRequired'),
  dailyWorkHours: z.coerce.number().min(1, 'validation.dailyWorkHoursMin').max(24, 'validation.dailyWorkHoursMax'),
  nightShiftEnabled: z.boolean().default(false),
  progressMeasurementMethod: z.string().min(1, 'validation.progressMethodRequired'),
  reportingFrequency: z.string().min(1, 'validation.reportingFrequencyRequired'),
  delayAnalysisEnabled: z.boolean().default(true),
  criticalPathMonitoring: z.boolean().default(true),
})

const scheduleDateRefine = {
  check: (data: { plannedStartDate?: string; plannedFinishDate?: string }) =>
    !data.plannedStartDate || !data.plannedFinishDate || data.plannedFinishDate >= data.plannedStartDate,
  message: 'validation.finishDateAfterStart' as const,
  path: ['plannedFinishDate'] as const,
}

/** Step-level schema includes date-order validation for section 4 */
export const scheduleHoursSchema = scheduleHoursObjectSchema.refine(scheduleDateRefine.check, {
  message: scheduleDateRefine.message,
  path: [...scheduleDateRefine.path],
})

/** User-defined standard not in the regional catalog */
export const customStandardEntrySchema = z.object({
  id: z.string(),
  code: z.string().min(1, 'validation.customStandardCodeRequired'),
  name: z.string().min(2, 'validation.customStandardNameRequired'),
  description: optionalString,
  category: optionalString,
})

export type CustomStandardFormEntry = z.output<typeof customStandardEntrySchema>

function toCustomStandardEntries(
  entries:
    | ReadonlyArray<{
        id?: string
        code?: string
        name?: string
        description?: string
        category?: string
      }>
    | undefined
): CustomStandardEntry[] {
  if (!entries?.length) return []
  return entries.map((entry) => ({
    id: entry.id ?? '',
    code: entry.code ?? '',
    name: entry.name ?? '',
    description: entry.description || undefined,
    category: entry.category || undefined,
  }))
}

/** Section 5 — Construction Compliance & Location */
export const standardsLocationSchema = z.object({
  region: z.string().min(1, 'validation.regionRequired'),
  timezone: z.string().min(1, 'validation.timezoneRequired'),
  /** One or more regulatory frameworks (e.g. Germany + European Union together) */
  regulatoryRegions: z.array(z.string()).default([]),
  /** Primary region kept for backward-compatible payloads */
  regulatoryRegion: z.string().min(1, 'validation.regulatoryRegionRequired'),
  constructionType: z.string().min(1, 'validation.constructionTypeRequired'),
  /** User-selected compliance standards (mandatory keys enforced in UI + engine) */
  selectedStandards: z.array(z.string()).default([]),
  /** Standards added manually when not listed in the catalog */
  customStandards: z.array(customStandardEntrySchema).default([]),
  additionalStandards: z.array(z.string()).default([]),
  customRegulatoryNote: optionalString,
  customStandardNote: optionalString,
  bimEnabled: z.boolean().default(false),
  bimLevel: optionalString,
  modelCoordinationRequired: z.boolean().default(false),
})

/** Section 6 — Schedule Upload */
export const scheduleUploadSchema = z.object({
  scheduleFileName: optionalString,
  validateScheduleOnUpload: z.boolean().default(true),
  autoLinkActivities: z.boolean().default(false),
  requireBaselineApproval: z.boolean().default(true),
})

/** Section 7 — Project Documents */
export const projectDocumentsSchema = z.object({
  contractDocumentsFile: optionalString,
  contractDocumentsNote: optionalString,
  drawingsFile: optionalString,
  drawingsNote: optionalString,
  specificationsFile: optionalString,
  specificationsNote: optionalString,
  permitsFile: optionalString,
  permitsNote: optionalString,
})

/** Section 8 — Project Settings */
export const projectSettingsSchema = z.object({
  interfaceLanguage: optionalString,
  currency: z.string().min(1, 'validation.currencyRequired'),
  language: z.string().min(1, 'validation.languageRequired'),
  dateFormat: z.string().min(1, 'validation.dateFormatRequired'),
  weatherProvider: z.string().min(1, 'validation.weatherProviderRequired'),
  enableWeatherAlerts: z.boolean().default(true),
  enableSafetyDashboard: z.boolean().default(true),
  enableProgressDashboard: z.boolean().default(true),
  enableCostDashboard: z.boolean().default(false),
  allowFieldReporting: z.boolean().default(true),
  allowPhotoUpload: z.boolean().default(true),
  requireApprovalForReports: z.boolean().default(false),
})

/** Full form schema — hidden UUID/template IDs are assigned server-side on submit */
export const projectInitializationSchema = projectInfoSchema
  .merge(projectTeamSchema)
  .merge(technicalInfoSchema)
  .merge(scheduleHoursObjectSchema)
  .merge(standardsLocationSchema)
  .merge(scheduleUploadSchema)
  .merge(projectDocumentsSchema)
  .merge(projectSettingsSchema)
  .refine(scheduleDateRefine.check, {
    message: scheduleDateRefine.message,
    path: [...scheduleDateRefine.path],
  })
  .superRefine((data, ctx) => {
    if (data.regulatoryRegion === 'custom') return
    if (!data.regulatoryRegions?.length) {
      ctx.addIssue({ code: 'custom', path: ['regulatoryRegions'], message: 'validation.regulatoryRegionRequired' })
    }
  })

export type ProjectInitializationFormValues = z.output<typeof projectInitializationSchema>

export const STEP_SCHEMAS = [
  projectInfoSchema,
  projectTeamSchema,
  technicalInfoSchema,
  scheduleHoursSchema,
  standardsLocationSchema,
  scheduleUploadSchema,
  projectDocumentsSchema,
  projectSettingsSchema,
] as const

export const STEP_FIELD_NAMES: (keyof ProjectInitializationFormValues)[][] = [
  Object.keys(projectInfoSchema.shape) as (keyof ProjectInitializationFormValues)[],
  Object.keys(projectTeamSchema.shape) as (keyof ProjectInitializationFormValues)[],
  Object.keys(technicalInfoSchema.shape) as (keyof ProjectInitializationFormValues)[],
  Object.keys(scheduleHoursObjectSchema.shape) as (keyof ProjectInitializationFormValues)[],
  Object.keys(standardsLocationSchema.shape) as (keyof ProjectInitializationFormValues)[],
  Object.keys(scheduleUploadSchema.shape) as (keyof ProjectInitializationFormValues)[],
  Object.keys(projectDocumentsSchema.shape) as (keyof ProjectInitializationFormValues)[],
  Object.keys(projectSettingsSchema.shape) as (keyof ProjectInitializationFormValues)[],
]

export const defaultFormValues: ProjectInitializationFormValues = {
  interfaceLanguage: '',
  projectName: '',
  projectCode: '',
  projectType: '',
  status: 'planning',
  description: '',
  clientName: '',
  clientContact: '',
  clientEmail: '',
  clientPhone: '',
  organizationName: '',
  department: '',
  contractType: '',
  contractNumber: '',
  contractValue: undefined,
  contractStartDate: '',
  contractEndDate: '',
  buildingClassification: '',
  projectPhase: 'pre_construction',
  sector: '',
  estimatedWorkforce: undefined,
  peakWorkforce: undefined,
  internalNotes: '',
  publicNotes: '',
  address: '',
  city: '',
  country: 'IR',
  latitude: '',
  longitude: '',
  siteArea: undefined,
  projectDirector: '',
  projectManager: '',
  constructionManager: '',
  leadEngineer: '',
  structuralEngineer: '',
  mepEngineer: '',
  qaManager: '',
  qcInspector: '',
  commercialManager: '',
  procurementLead: '',
  structureType: '',
  primaryMaterial: '',
  foundationType: '',
  soilClassification: '',
  numberOfFloors: undefined,
  totalBuiltArea: undefined,
  basementLevels: undefined,
  designStage: '',
  designStandard: '',
  architectFirm: '',
  plannedStartDate: '',
  plannedFinishDate: '',
  actualStartDate: '',
  workingDaysPerWeek: '6',
  publicHolidayCalendar: 'national',
  shiftPattern: 'single',
  dailyWorkHours: 8,
  nightShiftEnabled: false,
  progressMeasurementMethod: 'physical',
  reportingFrequency: 'weekly',
  delayAnalysisEnabled: true,
  criticalPathMonitoring: true,
  region: 'middle_east',
  timezone: 'Asia/Tehran',
  regulatoryRegion: '',
  regulatoryRegions: [] as string[],
  constructionType: '',
  selectedStandards: [],
  customStandards: [],
  additionalStandards: [],
  customRegulatoryNote: '',
  customStandardNote: '',
  bimEnabled: false,
  bimLevel: 'none',
  modelCoordinationRequired: false,
  scheduleFileName: '',
  validateScheduleOnUpload: true,
  autoLinkActivities: false,
  requireBaselineApproval: true,
  contractDocumentsFile: '',
  contractDocumentsNote: '',
  drawingsFile: '',
  drawingsNote: '',
  specificationsFile: '',
  specificationsNote: '',
  permitsFile: '',
  permitsNote: '',
  currency: 'USD',
  language: 'en',
  dateFormat: 'YYYY-MM-DD',
  weatherProvider: 'openweather',
  enableWeatherAlerts: true,
  enableSafetyDashboard: true,
  enableProgressDashboard: true,
  enableCostDashboard: false,
  allowFieldReporting: true,
  allowPhotoUpload: true,
  requireApprovalForReports: false,
}

/** Payload shape sent to the API — server assigns hidden IDs */
export interface ProjectInitializationPayload {
  language: Record<string, unknown>
  project: Record<string, unknown>
  team: Record<string, unknown>
  technical: Record<string, unknown>
  schedule: Record<string, unknown>
  standards: Record<string, unknown>
  compliance: Record<string, unknown>
  uploads: Record<string, unknown>
  documents: Record<string, unknown>
  settings: Record<string, unknown>
  submittedAt: string
}

export function buildSubmissionPayload(values: ProjectInitializationFormValues): ProjectInitializationPayload {
  const primaryRegion = values.regulatoryRegions?.[0] ?? values.regulatoryRegion
  const complianceProfile = resolveComplianceProfile({
    regulatoryRegion: primaryRegion,
    regulatoryRegions: values.regulatoryRegions ?? [],
    constructionType: values.constructionType,
    selectedStandards: values.selectedStandards ?? [],
    customStandards: toCustomStandardEntries(values.customStandards),
    additionalStandards: values.additionalStandards ?? [],
    customRegulatoryNote: values.customRegulatoryNote,
    customStandardNote: values.customStandardNote,
  })

  return {
    language: {
      interfaceLanguage: values.interfaceLanguage,
    },
    project: {
      name: values.projectName,
      code: values.projectCode,
      type: values.projectType,
      status: values.status,
      description: values.description,
      clientName: values.clientName,
      clientContact: values.clientContact,
      clientEmail: values.clientEmail,
      clientPhone: values.clientPhone,
      organizationName: values.organizationName,
      department: values.department,
      contractType: values.contractType,
      contractNumber: values.contractNumber,
      contractValue: values.contractValue,
      contractStartDate: values.contractStartDate,
      contractEndDate: values.contractEndDate,
      buildingClassification: values.buildingClassification,
      projectPhase: values.projectPhase,
      sector: values.sector,
      estimatedWorkforce: values.estimatedWorkforce,
      peakWorkforce: values.peakWorkforce,
      internalNotes: values.internalNotes,
      publicNotes: values.publicNotes,
      location: {
        address: values.address,
        city: values.city,
        country: values.country,
        latitude: values.latitude,
        longitude: values.longitude,
        siteArea: values.siteArea,
      },
    },
    team: {
      projectDirector: values.projectDirector,
      projectManager: values.projectManager,
      constructionManager: values.constructionManager,
      leadEngineer: values.leadEngineer,
      structuralEngineer: values.structuralEngineer,
      mepEngineer: values.mepEngineer,
      qaManager: values.qaManager,
      qcInspector: values.qcInspector,
      commercialManager: values.commercialManager,
      procurementLead: values.procurementLead,
    },
    technical: {
      structureType: values.structureType,
      primaryMaterial: values.primaryMaterial,
      foundationType: values.foundationType,
      soilClassification: values.soilClassification,
      numberOfFloors: values.numberOfFloors,
      totalBuiltArea: values.totalBuiltArea,
      basementLevels: values.basementLevels,
      designStage: values.designStage,
      designStandard: values.designStandard,
      architectFirm: values.architectFirm,
    },
    schedule: {
      plannedStartDate: values.plannedStartDate,
      plannedFinishDate: values.plannedFinishDate,
      actualStartDate: values.actualStartDate,
      workingDaysPerWeek: values.workingDaysPerWeek,
      publicHolidayCalendar: values.publicHolidayCalendar,
      shiftPattern: values.shiftPattern,
      dailyWorkHours: values.dailyWorkHours,
      nightShiftEnabled: values.nightShiftEnabled,
      progressMeasurementMethod: values.progressMeasurementMethod,
      reportingFrequency: values.reportingFrequency,
      delayAnalysisEnabled: values.delayAnalysisEnabled,
      criticalPathMonitoring: values.criticalPathMonitoring,
    },
    standards: {
      region: values.region,
      timezone: values.timezone,
      bimEnabled: values.bimEnabled,
      bimLevel: values.bimLevel,
      modelCoordinationRequired: values.modelCoordinationRequired,
    },
    compliance: {
      regulatoryRegion: primaryRegion,
      regulatoryRegions: values.regulatoryRegions ?? [],
      constructionType: values.constructionType,
      selectedStandards: values.selectedStandards ?? [],
      customStandards: toCustomStandardEntries(values.customStandards),
      additionalStandards: values.additionalStandards ?? [],
      customRegulatoryNote: values.customRegulatoryNote || null,
      customStandardNote: values.customStandardNote || null,
      mandatoryStandards: complianceProfile.mandatoryStandards,
      optionalStandards: complianceProfile.optionalStandards,
      activatedStandards: complianceProfile.activatedStandards,
      standardsByFamily: complianceProfile.standardsByFamily,
      aiComplianceContext: complianceProfile.aiComplianceContext,
    },
    uploads: {
      scheduleFileName: values.scheduleFileName,
      validateScheduleOnUpload: values.validateScheduleOnUpload,
      autoLinkActivities: values.autoLinkActivities,
      requireBaselineApproval: values.requireBaselineApproval,
    },
    documents: {
      contractDocumentsFile: values.contractDocumentsFile,
      contractDocumentsNote: values.contractDocumentsNote,
      drawingsFile: values.drawingsFile,
      drawingsNote: values.drawingsNote,
      specificationsFile: values.specificationsFile,
      specificationsNote: values.specificationsNote,
      permitsFile: values.permitsFile,
      permitsNote: values.permitsNote,
    },
    settings: {
      currency: values.currency,
      language: values.language,
      dateFormat: values.dateFormat,
      weatherProvider: values.weatherProvider,
      enableWeatherAlerts: values.enableWeatherAlerts,
      enableSafetyDashboard: values.enableSafetyDashboard,
      enableProgressDashboard: values.enableProgressDashboard,
      enableCostDashboard: values.enableCostDashboard,
      allowFieldReporting: values.allowFieldReporting,
      allowPhotoUpload: values.allowPhotoUpload,
      requireApprovalForReports: values.requireApprovalForReports,
    },
    submittedAt: new Date().toISOString(),
  }
}
