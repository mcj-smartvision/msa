'use client'

import { useEffect, useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { CONSTRUCTION_TYPES, REGULATORY_REGIONS } from '@/features/compliance/lib/catalog'
import { BIM_LEVELS } from '@/features/project-init/lib/constants'
import { ComplianceStandardsSelector } from '../compliance-standards-selector'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import {
FieldGrid,
MultiSelectField,
SectionHeader,
SelectField,
SubsectionTitle,
SwitchField,
TextField,
} from '../form-fields'
import { useProjectFormI18n } from '../project-form-i18n'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'

export function StandardsLocationSection() {
  const { watch, setValue } = useFormContext<ProjectInitializationFormValues>()
  const { t, options, locale } = useProjectFormI18n()
  const regulatoryRegion = watch('regulatoryRegion')
  const regulatoryRegions = watch('regulatoryRegions') ?? []
  const useCustomFramework = regulatoryRegion === 'custom'

  const regulatoryOptions = useMemo(
    () =>
      REGULATORY_REGIONS.filter((item) => item.value !== 'custom').map((item) => ({
        value: item.value,
        label: t(`options.regulatoryRegions.${item.value}`) || item.label,
      })),
    [t, locale]
  )

  const constructionTypeOptions = useMemo(
    () =>
      CONSTRUCTION_TYPES.map((item) => ({
        value: item.value,
        label: t(`options.constructionTypes.${item.value}`) || item.label,
      })),
    [t, locale]
  )

  const bimLevelOptions = BIM_LEVELS.map((item) => ({
    value: item.value,
    label: options.bimLevels.find((o) => o.value === item.value)?.label ?? item.label,
  }))

  useEffect(() => {
    if (useCustomFramework) return
    const primary = regulatoryRegions[0] ?? ''
    if (primary && primary !== regulatoryRegion) {
      setValue('regulatoryRegion', primary, { shouldDirty: true })
    }
  }, [regulatoryRegions, regulatoryRegion, useCustomFramework, setValue])

  return (
    <div>
      <SectionHeader
        title={t('sections.standardsLocation.title')}
        description={t('sections.standardsLocation.description')}
      />

      <FieldGrid cols={2}>
        <SubsectionTitle>{t('subsections.complianceFramework')}</SubsectionTitle>

        <div className="md:col-span-2 flex items-start gap-3 rounded-lg border p-3">
          <Checkbox
            id="use-custom-regulatory"
            checked={useCustomFramework}
            onChange={(e) => {
              if (e.target.checked) {
                setValue('regulatoryRegion', 'custom', { shouldDirty: true })
                setValue('regulatoryRegions', [], { shouldDirty: true })
              } else {
                const next = regulatoryRegions[0] ?? 'germany'
                setValue('regulatoryRegion', next, { shouldDirty: true })
                if (regulatoryRegions.length === 0) {
                  setValue('regulatoryRegions', [next], { shouldDirty: true })
                }
              }
            }}
          />
          <div>
            <Label htmlFor="use-custom-regulatory" className="cursor-pointer">
              {t('fields.useCustomRegulatory')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">{t('descriptions.useCustomRegulatory')}</p>
          </div>
        </div>

        {!useCustomFramework ? (
          <MultiSelectField<ProjectInitializationFormValues>
            name="regulatoryRegions"
            label={t('fields.regulatoryRegions')}
            required
            options={regulatoryOptions}
            description={t('descriptions.regulatoryRegions')}
            className="md:col-span-2"
          />
        ) : (
          <>
            <TextField<ProjectInitializationFormValues>
              name="customRegulatoryNote"
              label={t('fields.customRegulatoryNote')}
              description={t('descriptions.customRegulatoryNote')}
              className="md:col-span-2"
            />
            <TextField<ProjectInitializationFormValues>
              name="customStandardNote"
              label={t('fields.customStandardNote')}
              description={t('descriptions.customStandardNote')}
              className="md:col-span-2"
            />
          </>
        )}

        <SelectField<ProjectInitializationFormValues>
          name="constructionType"
          label={t('fields.constructionType')}
          required
          options={constructionTypeOptions}
          description={t('descriptions.constructionType')}
        />

        <ComplianceStandardsSelector />

        <SubsectionTitle>{t('subsections.region')}</SubsectionTitle>
        <SelectField<ProjectInitializationFormValues> name="region" label={t('fields.region')} required options={options.regions} />
        <SelectField<ProjectInitializationFormValues> name="timezone" label={t('fields.timezone')} required options={options.timezones} />

        <SubsectionTitle>{t('subsections.bimSettings')}</SubsectionTitle>
        <SwitchField<ProjectInitializationFormValues>
          name="bimEnabled"
          label={t('fields.bimEnabled')}
          description={t('descriptions.bimEnabled')}
        />
        <SelectField<ProjectInitializationFormValues> name="bimLevel" label={t('fields.bimLevel')} options={bimLevelOptions} />
        <SwitchField<ProjectInitializationFormValues>
          name="modelCoordinationRequired"
          label={t('fields.modelCoordinationRequired')}
          description={t('descriptions.modelCoordinationRequired')}
          className="md:col-span-2"
        />
      </FieldGrid>
    </div>
  )
}
