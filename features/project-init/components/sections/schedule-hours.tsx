'use client'

import { FieldGrid, NumberField, SectionHeader, SelectField, SubsectionTitle, SwitchField, TextField } from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

export function ScheduleHoursSection() {
  const { t, options } = useProjectFormI18n()

  return (
    <div>
      <SectionHeader title={t('sections.scheduleHours.title')} description={t('sections.scheduleHours.description')} />

      <FieldGrid cols={2}>
        <SubsectionTitle>{t('subsections.dates')}</SubsectionTitle>
        <TextField<ProjectInitializationFormValues> name="plannedStartDate" label={t('fields.plannedStartDate')} type="date" required />
        <TextField<ProjectInitializationFormValues> name="plannedFinishDate" label={t('fields.plannedFinishDate')} type="date" required />
        <TextField<ProjectInitializationFormValues> name="actualStartDate" label={t('fields.actualStartDate')} type="date" />

        <SubsectionTitle>{t('subsections.calendar')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues>
          name="workingDaysPerWeek"
          label={t('fields.workingDaysPerWeek')}
          required
          options={options.workingDays}
        />
        <SelectField<ProjectInitializationFormValues>
          name="publicHolidayCalendar"
          label={t('fields.publicHolidayCalendar')}
          required
          options={options.holidayCalendars}
        />

        <SubsectionTitle>{t('subsections.shiftHours')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="shiftPattern" label={t('fields.shiftPattern')} required options={options.shiftPatterns} />
        <NumberField<ProjectInitializationFormValues> name="dailyWorkHours" label={t('fields.dailyWorkHours')} required />
        <SwitchField<ProjectInitializationFormValues>
          name="nightShiftEnabled"
          label={t('fields.nightShiftEnabled')}
          description={t('descriptions.nightShiftEnabled')}
          className="md:col-span-2"
        />

        <SubsectionTitle>{t('subsections.progressSettings')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues>
          name="progressMeasurementMethod"
          label={t('fields.progressMeasurementMethod')}
          required
          options={options.progressMethods}
        />
        <SelectField<ProjectInitializationFormValues>
          name="reportingFrequency"
          label={t('fields.reportingFrequency')}
          required
          options={options.reportingFrequencies}
        />

        <SubsectionTitle>{t('subsections.delayAnalysis')}</SubsectionTitle>
        <SwitchField<ProjectInitializationFormValues>
          name="delayAnalysisEnabled"
          label={t('fields.delayAnalysisEnabled')}
          description={t('descriptions.delayAnalysisEnabled')}
        />
        <SwitchField<ProjectInitializationFormValues>
          name="criticalPathMonitoring"
          label={t('fields.criticalPathMonitoring')}
          description={t('descriptions.criticalPathMonitoring')}
        />
      </FieldGrid>
    </div>
  )
}
