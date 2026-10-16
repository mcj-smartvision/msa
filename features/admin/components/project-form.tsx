/**
 * @file features/admin/components/project-form.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (project-form)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/textarea, shared/components/ui/checkbox, shared/components/ui/card, features/schedule/components/schedule-date-input, shared/lib/utils, shared/types/admin, features/admin/config
 */

'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import { cn } from '@/shared/lib/utils'
import type { CreateProjectInput } from '@/shared/types/admin'
import { ADMIN_PROJECT_FORM_COPY as copy } from '@/features/admin/config'

interface ProjectFormProps {
  initial?: Partial<CreateProjectInput>
  submitLabel: string
  onSubmit: (values: CreateProjectInput) => Promise<void>
  /** plain = no card chrome; page = full-width sections */
  variant?: 'card' | 'plain' | 'page'
  onCancel?: () => void
}

function defaultEndDateIso() {
  return new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('border-b border-[#E4E7EC] pb-2 text-sm font-semibold text-[#17202A]', className)}>
      {children}
    </h3>
  )
}

export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  variant = 'card',
  onCancel,
}: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [clientName, setClientName] = useState(initial?.client_name ?? '')
  const [contractorName, setContractorName] = useState(initial?.contractor_name ?? '')
  const [projectManagerName, setProjectManagerName] = useState(initial?.project_manager_name ?? '')
  const [address, setAddress] = useState(initial?.address ?? initial?.location ?? '')
  const [startDate, setStartDate] = useState(initial?.start_date ?? new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(initial?.end_date ?? defaultEndDateIso())
  const [status, setStatus] = useState(initial?.status ?? 'planning')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPage = variant === 'page'
  const gridClass = isPage ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 sm:grid-cols-2'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        location: address.trim().slice(0, 255) || undefined,
        client_name: clientName.trim() || undefined,
        contractor_name: contractorName.trim() || undefined,
        project_manager_name: projectManagerName.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        status,
        is_active: isActive,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setLoading(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className={cn('space-y-6', isPage && 'space-y-8')} autoComplete="off">
      <section className="space-y-4">
        {isPage ? <SectionTitle>{copy.sectionBasics}</SectionTitle> : null}
        <div className={gridClass}>
          <div className="space-y-2">
            <Label htmlFor="project-name">{copy.name}</Label>
            <Input
              id="project-name"
              name="new-project-name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-code">{copy.code}</Label>
            <Input
              id="project-code"
              name="new-project-code"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={copy.codePlaceholder}
            />
          </div>
          <div className={cn('space-y-2', isPage && 'sm:col-span-2 lg:col-span-3')}>
            <Label htmlFor="project-description">{copy.description}</Label>
            <Textarea
              id="project-description"
              name="new-project-description"
              autoComplete="off"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={isPage ? 4 : 3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-status">{copy.status}</Label>
            <select
              id="project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
            >
              <option value="planning">{copy.statusPlanning}</option>
              <option value="active">{copy.statusActive}</option>
              <option value="completed">{copy.statusCompleted}</option>
              <option value="suspended">{copy.statusSuspended}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {isPage ? <SectionTitle>{copy.sectionParties}</SectionTitle> : null}
        <div className={gridClass}>
          <div className="space-y-2">
            <Label htmlFor="project-client">{copy.client}</Label>
            <Input
              id="project-client"
              name="new-project-client"
              autoComplete="off"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-contractor">{copy.contractor}</Label>
            <Input
              id="project-contractor"
              name="new-project-contractor"
              autoComplete="off"
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-manager">{copy.manager}</Label>
            <Input
              id="project-manager"
              name="new-project-manager"
              autoComplete="off"
              value={projectManagerName}
              onChange={(e) => setProjectManagerName(e.target.value)}
              required
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {isPage ? <SectionTitle>{copy.sectionLocation}</SectionTitle> : null}
        <div className="space-y-2">
          <Label htmlFor="project-address">{copy.address}</Label>
          <Textarea
            id="project-address"
            name="new-project-address"
            autoComplete="off"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={isPage ? 4 : 3}
            placeholder={copy.addressPlaceholder}
            required
          />
        </div>
      </section>

      <section className="space-y-4">
        {isPage ? <SectionTitle>{copy.sectionDates}</SectionTitle> : null}
        <div className={gridClass}>
          <ScheduleDateInput
            id="project-start-date"
            label={copy.startDate}
            valueIso={startDate}
            onChangeIso={setStartDate}
            required
          />
          <ScheduleDateInput
            id="project-end-date"
            label={copy.endDate}
            valueIso={endDate}
            onChangeIso={setEndDate}
            required
          />
        </div>
      </section>

      <Checkbox
        id="project-active"
        label={copy.active}
        checked={isActive}
        onChange={(e) => setIsActive(e.target.checked)}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[#E4E7EC] pt-4">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="border-[#E4E7EC] bg-white text-slate-900 hover:bg-slate-50"
            onClick={onCancel}
            disabled={loading}
          >
            {copy.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={loading} className="bg-[#C96A1B] hover:bg-[#A95312]">
          {loading ? copy.saving : submitLabel}
        </Button>
      </div>
    </form>
  )

  if (variant === 'plain' || variant === 'page') return form

  return (
    <Card>
      <CardHeader>
        <CardTitle>{submitLabel}</CardTitle>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}
