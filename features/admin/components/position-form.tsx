'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { slugifyKey } from '@/features/admin/lib/access'
import type { CreatePositionInput, Position } from '@/shared/types/admin'

interface PositionFormProps {
  initial?: Partial<Position>
  submitLabel: string
  onSubmit: (values: CreatePositionInput) => Promise<void>
}

export function PositionForm({ initial, submitLabel, onSubmit }: PositionFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [key, setKey] = useState(initial?.key ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        key: key.trim() || slugifyKey(title),
        description: description.trim() || undefined,
        is_active: isActive,
      })
      if (!initial) {
        setTitle('')
        setKey('')
        setDescription('')
        setIsActive(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره سمت ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{submitLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="position-title">عنوان</Label>
              <Input id="position-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-key">کلید</Label>
              <Input id="position-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="site_supervisor" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="position-description">توضیحات</Label>
            <Textarea id="position-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Checkbox id="position-active" label="سمت فعال" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading}>{loading ? 'در حال ذخیره...' : submitLabel}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
