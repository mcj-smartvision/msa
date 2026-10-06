'use client'

import { FieldGrid, SectionHeader, SelectField, SubsectionTitle, SwitchField } from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

export function ProjectSettingsSection() {
  const { t, options } = useProjectFormI18n()

  return (
    <div>
      <SectionHeader title={t('sections.projectSettings.title')} description={t('sections.projectSettings.description')} />

      <FieldGrid cols={2}>
        <SubsectionTitle>{t('subsections.regionalSettings')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="currency" label={t('fields.currency')} required options={options.currencies} />
        <SelectField<ProjectInitializationFormValues> name="language" label={t('fields.language')} required options={options.languages} />
        <SelectField<ProjectInitializationFormValues> name="dateFormat" label={t('fields.dateFormat')} required options={options.dateFormats} />

        <SubsectionTitle>{t('subsections.weatherProvider')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="weatherProvider" label={t('fields.weatherProvider')} required options={options.weatherProviders} />
        <SwitchField<ProjectInitializationFormValues>
          name="enableWeatherAlerts"
          label={t('fields.enableWeatherAlerts')}
          description={t('descriptions.enableWeatherAlerts')}
        />

        <SubsectionTitle>{t('subsections.dashboardModules')}</SubsectionTitle>
        <SwitchField<ProjectInitializationFormValues> name="enableSafetyDashboard" label={t('fields.enableSafetyDashboard')} />
        <SwitchField<ProjectInitializationFormValues> name="enableProgressDashboard" label={t('fields.enableProgressDashboard')} />
        <SwitchField<ProjectInitializationFormValues> name="enableCostDashboard" label={t('fields.enableCostDashboard')} />

        <SubsectionTitle>{t('subsections.permissions')}</SubsectionTitle>
        <SwitchField<ProjectInitializationFormValues> name="allowFieldReporting" label={t('fields.allowFieldReporting')} />
        <SwitchField<ProjectInitializationFormValues> name="allowPhotoUpload" label={t('fields.allowPhotoUpload')} />
        <SwitchField<ProjectInitializationFormValues>
          name="requireApprovalForReports"
          label={t('fields.requireApprovalForReports')}
          description={t('descriptions.requireApprovalForReports')}
          className="md:col-span-2"
        />
      </FieldGrid>
    </div>
  )
}
