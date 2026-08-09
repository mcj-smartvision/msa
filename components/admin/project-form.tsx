'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { slugifyKey } from '@/lib/admin/access'
import type { CreateProjectInput } from '@/types/admin'

interface ProjectFormProps {
  initial?: Partial<CreateProjectInput>
  submitLabel: string
  onSubmit: (values: CreateProjectInput) => Promise<void>
  /** plain = no card chrome (for drawer/modal) */
  variant?: 'card' | 'plain'
  onCancel?: () => void
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
  const [location, setLocation] = useState(initial?.location ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'planning')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim() || slugifyKey(name),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        status,
        is_active: isActive,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره پروژه ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-name">نام پروژه</Label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-code">کد پروژه</Label>
          <Input
            id="project-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="به‌صورت خودکار از نام ساخته می‌شود"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">توضیحات</Label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-location">محل</Label>
          <Input id="project-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-status">وضعیت</Label>
          <select
            id="project-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="planning">در حال برنامه‌ریزی</option>
            <option value="active">فعال</option>
            <option value="completed">تکمیل‌شده</option>
            <option value="suspended">متوقف</option>
          </select>
        </div>
      </div>
      <Checkbox
        id="project-active"
        label="پروژه فعال"
        checked={isActive}
        onChange={(e) => setIsActive(e.target.checked)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#E4E7EC] pt-4">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            انصراف
          </Button>
        ) : null}
        <Button type="submit" disabled={loading} className="bg-[#C96A1B] hover:bg-[#A95312]">
          {loading ? 'در حال ذخیره...' : submitLabel}
        </Button>
      </div>
    </form>
  )

  if (variant === 'plain') return form

  return (
    <Card>
      <CardHeader>
        <CardTitle>{submitLabel}</CardTitle>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}
