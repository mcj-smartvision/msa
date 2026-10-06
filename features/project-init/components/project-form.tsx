'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm, FormProvider, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { FORM_STEPS } from '@/features/project-init/lib/constants'
import { ProjectFormI18nProvider, useProjectFormI18n } from './project-form-i18n'
import {
buildSubmissionPayload,
defaultFormValues,
projectInitializationSchema,
STEP_FIELD_NAMES,
STEP_SCHEMAS,
type ProjectInitializationFormValues,
} from '@/features/project-init/lib/schema'
import { ProjectInfoSection } from './sections/project-info'
import { ProjectTeamSection } from './sections/project-team'
import { TechnicalInfoSection } from './sections/technical-info'
import { ScheduleHoursSection } from './sections/schedule-hours'
import { StandardsLocationSection } from './sections/standards-location'
import { ScheduleUploadSection } from './sections/schedule-upload'
import { ProjectDocumentsSection } from './sections/project-documents'
import { ProjectSettingsSection } from './sections/project-settings'

const SECTION_COMPONENTS = [
  ProjectInfoSection,
  ProjectTeamSection,
  TechnicalInfoSection,
  ScheduleHoursSection,
  StandardsLocationSection,
  ScheduleUploadSection,
  ProjectDocumentsSection,
  ProjectSettingsSection,
] as const

interface ProjectFormProps {
  onSubmitted?: (payload: ReturnType<typeof buildSubmissionPayload>) => void
}

export function ProjectForm({ onSubmitted }: ProjectFormProps) {
  const [step, setStep] = useState(0)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const { locale } = useLocale()

  const methods = useForm<ProjectInitializationFormValues>({
    resolver: zodResolver(projectInitializationSchema),
    defaultValues: defaultFormValues,
    mode: 'onBlur',
  })

  const { handleSubmit, trigger, getValues, setError, formState, setValue } = methods

  useEffect(() => {
    setValue('interfaceLanguage', locale, { shouldDirty: true })
    setValue('language', locale, { shouldDirty: true })
  }, [locale, setValue])

  const progress = ((step + 1) / FORM_STEPS.length) * 100
  const ActiveSection = SECTION_COMPONENTS[step]

  return (
    <FormProvider {...methods}>
      <ProjectFormI18nProvider>
        <ProjectFormBody
          step={step}
          setStep={setStep}
          submitSuccess={submitSuccess}
          setSubmitSuccess={setSubmitSuccess}
          progress={progress}
          ActiveSection={ActiveSection}
          onSubmitted={onSubmitted}
          handleSubmit={handleSubmit}
          trigger={trigger}
          getValues={getValues}
          setError={setError}
          formState={formState}
        />
      </ProjectFormI18nProvider>
    </FormProvider>
  )
}

function ProjectFormBody({
  step,
  setStep,
  submitSuccess,
  setSubmitSuccess,
  progress,
  ActiveSection,
  onSubmitted,
  handleSubmit,
  trigger,
  getValues,
  setError,
  formState,
}: {
  step: number
  setStep: React.Dispatch<React.SetStateAction<number>>
  submitSuccess: boolean
  setSubmitSuccess: React.Dispatch<React.SetStateAction<boolean>>
  progress: number
  ActiveSection: (typeof SECTION_COMPONENTS)[number]
  onSubmitted?: ProjectFormProps['onSubmitted']
  handleSubmit: ReturnType<typeof useForm<ProjectInitializationFormValues>>['handleSubmit']
  trigger: ReturnType<typeof useForm<ProjectInitializationFormValues>>['trigger']
  getValues: ReturnType<typeof useForm<ProjectInitializationFormValues>>['getValues']
  setError: ReturnType<typeof useForm<ProjectInitializationFormValues>>['setError']
  formState: ReturnType<typeof useForm<ProjectInitializationFormValues>>['formState']
}) {
  const { t } = useProjectFormI18n()
  const { locale } = useLocale()
  const currentStep = FORM_STEPS[step]
  const stepMeta = t(`steps.${currentStep.key}.title`)
  const [stepValidationFailed, setStepValidationFailed] = useState(false)

  function scrollToFirstInvalidField(fields: (keyof ProjectInitializationFormValues)[]) {
    window.setTimeout(() => {
      for (const field of fields) {
        const el =
          document.querySelector<HTMLElement>(`[data-field="${String(field)}"]`) ??
          document.getElementById(String(field))
        const wrapper = el?.closest('.space-y-2')
        const hasError = wrapper?.querySelector('.text-destructive')
        if (!hasError) continue
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus?.()
          break
        }
      }
    }, 100)
  }

  async function goNext() {
    const fields = STEP_FIELD_NAMES[step] as (keyof ProjectInitializationFormValues)[]
    const fieldValid = await trigger(fields as FieldPath<ProjectInitializationFormValues>[], { shouldFocus: true })
    if (!fieldValid) {
      setStepValidationFailed(true)
      requestAnimationFrame(() => scrollToFirstInvalidField(fields))
      return
    }

    const stepSchema = STEP_SCHEMAS[step]
    const allValues = getValues()
    const stepSlice = Object.fromEntries(fields.map((field) => [field, allValues[field]]))
    const sectionResult = stepSchema.safeParse(stepSlice)
    if (!sectionResult.success) {
      for (const issue of sectionResult.error.issues) {
        const fieldName = issue.path[0]
        if (typeof fieldName === 'string') {
          setError(fieldName as FieldPath<ProjectInitializationFormValues>, { message: issue.message })
        }
      }
      setStepValidationFailed(true)
      requestAnimationFrame(() => scrollToFirstInvalidField(fields))
      return
    }

    setStepValidationFailed(false)
    setStep((s) => Math.min(s + 1, FORM_STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function onSubmit(values: ProjectInitializationFormValues) {
    const parsed = projectInitializationSchema.parse({
      ...values,
      interfaceLanguage: locale,
      language: values.language || locale,
    })
    const payload = buildSubmissionPayload(parsed)
    console.log('Project Initialization Payload:', JSON.stringify(payload, null, 2))
    setSubmitSuccess(true)
    onSubmitted?.(payload)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="lg:hidden space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{stepMeta}</span>
          <span className="text-muted-foreground">
            {t('ui.step')} {step + 1} {t('ui.stepOf')} {FORM_STEPS.length}
          </span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="hidden lg:block">
          <nav className="sticky top-6 space-y-1">
            {FORM_STEPS.map((s, index) => (
              <button
                key={s.key}
                type="button"
                onClick={() => index < step && setStep(index)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2.5 transition-colors',
                  index === step
                    ? 'bg-primary text-primary-foreground'
                    : index < step
                      ? 'hover:bg-muted text-foreground'
                      : 'text-muted-foreground cursor-default'
                )}
              >
                <p className="text-xs font-medium opacity-80">
                  {t('ui.step')} {index + 1}
                </p>
                <p className="text-sm font-semibold leading-tight">{t(`steps.${s.key}.title`)}</p>
              </button>
            ))}
          </nav>
        </aside>

        <Card>
          <CardContent className="pt-6">
            {submitSuccess ? (
              <div className="py-10 text-center space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">{t('ui.successTitle')}</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">{t('ui.successDescription')}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild size="lg">
                    <Link href="/admin/projects">{t('ui.goToProjects')}</Link>
                  </Button>
                  <Button type="button" variant="outline" size="lg" onClick={() => setSubmitSuccess(false)}>
                    {t('ui.registerAnother')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ActiveSection />

                {stepValidationFailed && Object.keys(formState.errors).length > 0 ? (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>{t('ui.fixErrors')}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="sticky bottom-0 z-10 -mx-6 px-6 py-4 mt-8 bg-card/95 backdrop-blur border-t flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('ui.back')}
                  </Button>

                  {step < FORM_STEPS.length - 1 ? (
                    <Button type="button" onClick={goNext}>
                      {t('ui.next')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" size="lg" className="min-w-[180px]">
                      {t('ui.submit')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
