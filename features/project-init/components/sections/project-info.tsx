'use client'

import dynamic from 'next/dynamic'
import { FieldGrid, NumberField, SectionHeader, SelectField, SubsectionTitle, TextField, TextareaField } from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

const SiteLocationPicker = dynamic(
  () => import('../site-location-picker').then((mod) => ({ default: mod.SiteLocationPicker })),
  {
    ssr: false,
    loading: () => (
      <div className="md:col-span-2 flex h-40 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        …
      </div>
    ),
  }
)

export function ProjectInfoSection() {
  const { t, options } = useProjectFormI18n()

  return (
    <div>
      <SectionHeader title={t('sections.projectInfo.title')} description={t('sections.projectInfo.description')} />

      <FieldGrid cols={2}>
        <SubsectionTitle>{t('subsections.basicInfo')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="projectName" label={t('fields.projectName')} required />
        <TextField<ProjectInitializationFormValues> name="projectCode" label={t('fields.projectCode')} required />
        <SelectField<ProjectInitializationFormValues> name="projectType" label={t('fields.projectType')} required options={options.projectTypes} />
        <SelectField<ProjectInitializationFormValues> name="status" label={t('fields.status')} required options={options.projectStatuses} />
        <TextareaField<ProjectInitializationFormValues> name="description" label={t('fields.description')} className="md:col-span-2" />

        <SubsectionTitle>{t('subsections.location')}</SubsectionTitle>
        <SiteLocationPicker />
        <NumberField<ProjectInitializationFormValues> name="siteArea" label={t('fields.siteArea')} className="md:col-span-2" />

        <SubsectionTitle>{t('subsections.client')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="clientName" label={t('fields.clientName')} required />
        <TextField<ProjectInitializationFormValues> name="clientContact" label={t('fields.clientContact')} />
        <TextField<ProjectInitializationFormValues> name="clientEmail" label={t('fields.clientEmail')} type="email" />
        <TextField<ProjectInitializationFormValues> name="clientPhone" label={t('fields.clientPhone')} />

        <SubsectionTitle>{t('subsections.organization')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="organizationName" label={t('fields.organizationName')} />
        <TextField<ProjectInitializationFormValues> name="department" label={t('fields.department')} />

        <SubsectionTitle>{t('subsections.contract')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="contractType" label={t('fields.contractType')} required options={options.contractTypes} />
        <TextField<ProjectInitializationFormValues> name="contractNumber" label={t('fields.contractNumber')} />
        <NumberField<ProjectInitializationFormValues> name="contractValue" label={t('fields.contractValue')} />
        <TextField<ProjectInitializationFormValues> name="contractStartDate" label={t('fields.contractStartDate')} type="date" />
        <TextField<ProjectInitializationFormValues> name="contractEndDate" label={t('fields.contractEndDate')} type="date" />

        <SubsectionTitle>{t('subsections.classification')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues>
          name="buildingClassification"
          label={t('fields.buildingClassification')}
          required
          options={options.buildingClassifications}
        />
        <SelectField<ProjectInitializationFormValues> name="projectPhase" label={t('fields.projectPhase')} required options={options.projectPhases} />
        <SelectField<ProjectInitializationFormValues> name="sector" label={t('fields.sector')} options={options.sectors} />

        <SubsectionTitle>{t('subsections.workforce')}</SubsectionTitle>
        <NumberField<ProjectInitializationFormValues> name="estimatedWorkforce" label={t('fields.estimatedWorkforce')} />
        <NumberField<ProjectInitializationFormValues> name="peakWorkforce" label={t('fields.peakWorkforce')} />

        <SubsectionTitle>{t('subsections.notes')}</SubsectionTitle>
        <TextareaField<ProjectInitializationFormValues> name="internalNotes" label={t('fields.internalNotes')} />
        <TextareaField<ProjectInitializationFormValues> name="publicNotes" label={t('fields.publicNotes')} />
      </FieldGrid>
    </div>
  )
}
