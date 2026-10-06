'use client'

import { FieldGrid, SectionHeader, SubsectionTitle, TextField } from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

export function ProjectTeamSection() {
  const { t } = useProjectFormI18n()

  return (
    <div>
      <SectionHeader title={t('sections.projectTeam.title')} description={t('sections.projectTeam.description')} />

      <FieldGrid cols={2}>
        <SubsectionTitle>{t('subsections.management')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="projectDirector" label={t('fields.projectDirector')} />
        <TextField<ProjectInitializationFormValues> name="projectManager" label={t('fields.projectManager')} required />
        <TextField<ProjectInitializationFormValues> name="constructionManager" label={t('fields.constructionManager')} />

        <SubsectionTitle>{t('subsections.engineering')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="leadEngineer" label={t('fields.leadEngineer')} />
        <TextField<ProjectInitializationFormValues> name="structuralEngineer" label={t('fields.structuralEngineer')} />
        <TextField<ProjectInitializationFormValues> name="mepEngineer" label={t('fields.mepEngineer')} />

        <SubsectionTitle>{t('subsections.qa')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="qaManager" label={t('fields.qaManager')} />
        <TextField<ProjectInitializationFormValues> name="qcInspector" label={t('fields.qcInspector')} />

        <SubsectionTitle>{t('subsections.commercial')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="commercialManager" label={t('fields.commercialManager')} />
        <TextField<ProjectInitializationFormValues> name="procurementLead" label={t('fields.procurementLead')} />
      </FieldGrid>
    </div>
  )
}
