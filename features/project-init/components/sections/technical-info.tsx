'use client'

import { FieldGrid, NumberField, SectionHeader, SelectField, SubsectionTitle, TextField } from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

export function TechnicalInfoSection() {
  const { t, options } = useProjectFormI18n()

  return (
    <div>
      <SectionHeader title={t('sections.technicalInfo.title')} description={t('sections.technicalInfo.description')} />

      <FieldGrid cols={2}>
        <SubsectionTitle>{t('subsections.structure')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="structureType" label={t('fields.structureType')} required options={options.structureTypes} />
        <TextField<ProjectInitializationFormValues> name="primaryMaterial" label={t('fields.primaryMaterial')} />

        <SubsectionTitle>{t('subsections.foundation')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="foundationType" label={t('fields.foundationType')} required options={options.foundationTypes} />
        <SelectField<ProjectInitializationFormValues> name="soilClassification" label={t('fields.soilClassification')} options={options.soilClassifications} />

        <SubsectionTitle>{t('subsections.buildingInfo')}</SubsectionTitle>
        <NumberField<ProjectInitializationFormValues> name="numberOfFloors" label={t('fields.numberOfFloors')} />
        <NumberField<ProjectInitializationFormValues> name="totalBuiltArea" label={t('fields.totalBuiltArea')} />
        <NumberField<ProjectInitializationFormValues> name="basementLevels" label={t('fields.basementLevels')} />

        <SubsectionTitle>{t('subsections.designInfo')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="designStage" label={t('fields.designStage')} required options={options.designStages} />
        <TextField<ProjectInitializationFormValues> name="designStandard" label={t('fields.designStandard')} />
        <TextField<ProjectInitializationFormValues> name="architectFirm" label={t('fields.architectFirm')} />
      </FieldGrid>
    </div>
  )
}
