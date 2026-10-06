'use client'

import { FieldGrid, FileDropzone, SectionHeader, SubsectionTitle, TextareaField } from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

export function ProjectDocumentsSection() {
  const { t } = useProjectFormI18n()

  return (
    <div>
      <SectionHeader title={t('sections.projectDocuments.title')} description={t('sections.projectDocuments.description')} />

      <FieldGrid cols={2}>
        <SubsectionTitle>{t('subsections.contractDocuments')}</SubsectionTitle>
        <FileDropzone<ProjectInitializationFormValues>
          name="contractDocumentsFile"
          label={t('fields.contractDocumentsFile')}
          accept=".pdf,.doc,.docx"
        />
        <TextareaField<ProjectInitializationFormValues> name="contractDocumentsNote" label={t('fields.contractDocumentsNote')} rows={2} />

        <SubsectionTitle>{t('subsections.drawings')}</SubsectionTitle>
        <FileDropzone<ProjectInitializationFormValues> name="drawingsFile" label={t('fields.drawingsFile')} accept=".pdf,.dwg,.dxf" />
        <TextareaField<ProjectInitializationFormValues> name="drawingsNote" label={t('fields.drawingsNote')} rows={2} />

        <SubsectionTitle>{t('subsections.specifications')}</SubsectionTitle>
        <FileDropzone<ProjectInitializationFormValues> name="specificationsFile" label={t('fields.specificationsFile')} accept=".pdf,.doc,.docx" />
        <TextareaField<ProjectInitializationFormValues> name="specificationsNote" label={t('fields.specificationsNote')} rows={2} />

        <SubsectionTitle>{t('subsections.permits')}</SubsectionTitle>
        <FileDropzone<ProjectInitializationFormValues> name="permitsFile" label={t('fields.permitsFile')} accept=".pdf,.jpg,.png" />
        <TextareaField<ProjectInitializationFormValues> name="permitsNote" label={t('fields.permitsNote')} rows={2} />
      </FieldGrid>
    </div>
  )
}
