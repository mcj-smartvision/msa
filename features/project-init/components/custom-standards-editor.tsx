'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Plus, Trash2, BookPlus } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import { createCustomStandardId } from '@/features/compliance/lib/custom-standards'
import type { CustomStandardEntry } from '@/features/compliance/lib/types'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'
import { useProjectFormI18n } from './project-form-i18n'
import { cn } from '@/shared/lib/utils'

export function CustomStandardsEditor({ className }: { className?: string }) {
  const { watch, setValue } = useFormContext<ProjectInitializationFormValues>()
  const { t } = useProjectFormI18n()

  const customStandards = watch('customStandards') ?? []

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function addStandard() {
    const trimmedCode = code.trim()
    const trimmedName = name.trim()
    if (!trimmedCode) {
      setFormError(t('validation.customStandardCodeRequired'))
      return
    }
    if (trimmedName.length < 2) {
      setFormError(t('validation.customStandardNameRequired'))
      return
    }

    const duplicate = customStandards.some(
      (s) => s.code.toLowerCase() === trimmedCode.toLowerCase() || s.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      setFormError(t('validation.customStandardDuplicate'))
      return
    }

    const entry: CustomStandardEntry = {
      id: createCustomStandardId(),
      code: trimmedCode,
      name: trimmedName,
      description: description.trim() || undefined,
    }

    setValue('customStandards', [...customStandards, entry], { shouldDirty: true, shouldValidate: true })
    setCode('')
    setName('')
    setDescription('')
    setFormError(null)
  }

  function removeStandard(id: string) {
    setValue(
      'customStandards',
      customStandards.filter((s) => s.id !== id),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  return (
    <div className={cn('rounded-lg border border-dashed bg-muted/5 p-4 space-y-4', className)}>
      <div className="flex items-center gap-2">
        <BookPlus className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">{t('subsections.customStandards')}</p>
      </div>
      <p className="text-xs text-muted-foreground">{t('descriptions.customStandardsHint')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="custom-standard-code">{t('fields.customStandardCode')}</Label>
          <Input
            id="custom-standard-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('ui.customStandardCodePlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="custom-standard-name">{t('fields.customStandardName')}</Label>
          <Input
            id="custom-standard-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('ui.customStandardNamePlaceholder')}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="custom-standard-desc">{t('fields.customStandardDescription')}</Label>
          <Input
            id="custom-standard-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('ui.customStandardDescPlaceholder')}
          />
        </div>
      </div>

      {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

      <Button type="button" variant="secondary" size="sm" onClick={addStandard}>
        <Plus className="h-4 w-4 me-1" />
        {t('ui.addCustomStandard')}
      </Button>

      {customStandards.length > 0 ? (
        <ul className="space-y-2">
          {customStandards.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium">{entry.code}</span>
                <span className="text-muted-foreground"> — {entry.name}</span>
                {entry.description ? (
                  <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeStandard(entry.id)}
                aria-label={t('ui.removeCustomStandard')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t('descriptions.customStandardsEmpty')}</p>
      )}
    </div>
  )
}
