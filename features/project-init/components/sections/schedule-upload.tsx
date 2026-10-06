'use client'

import { Badge } from '@/shared/components/ui/badge'
import { FieldGrid, FileDropzone, SectionHeader, SwitchField } from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

const FORMAT_BADGES = [
  { ext: '.xlsx', label: 'Excel' },
  { ext: '.csv', label: 'Excel CSV' },
  { ext: '.xer', label: 'Primavera P6' },
  { ext: '.mpp', label: 'MS Project' },
  { ext: '.xml', label: 'MS Project XML' },
]

export function ScheduleUploadSection() {
  const { t } = useProjectFormI18n()

  return (
    <div>
      <SectionHeader title={t('sections.scheduleUpload.title')} description={t('sections.scheduleUpload.description')} />

      <FieldGrid cols={1}>
        <div className="space-y-2">
          <FileDropzone<ProjectInitializationFormValues>
            name="scheduleFileName"
            label={t('fields.scheduleFileName')}
            description={t('descriptions.scheduleFileName')}
            accept=".xer,.mpp,.xml,.xlsx,.csv"
          />
          <p className="text-xs text-muted-foreground">{t('descriptions.scheduleAcceptedFormats')}</p>
          <div className="flex flex-wrap gap-2">
            {FORMAT_BADGES.map((f) => (
              <Badge key={f.ext} variant="outline" className="text-xs font-normal">
                {f.label} <span className="text-muted-foreground ms-1">{f.ext}</span>
              </Badge>
            ))}
          </div>
        </div>

        <SwitchField<ProjectInitializationFormValues>
          name="validateScheduleOnUpload"
          label={t('fields.validateScheduleOnUpload')}
          description={t('descriptions.validateScheduleOnUpload')}
        />
        <SwitchField<ProjectInitializationFormValues>
          name="autoLinkActivities"
          label={t('fields.autoLinkActivities')}
          description={t('descriptions.autoLinkActivities')}
        />
        <SwitchField<ProjectInitializationFormValues>
          name="requireBaselineApproval"
          label={t('fields.requireBaselineApproval')}
          description={t('descriptions.requireBaselineApproval')}
        />
      </FieldGrid>
    </div>
  )
}
