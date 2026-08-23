'use client'

import { useState } from 'react'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

const FIELDS = ['username', 'full_name', 'phone', 'contact_email', 'other'] as const

export function AccountChangeRequestForm() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  const [fieldKey, setFieldKey] = useState<(typeof FIELDS)[number]>('username')
  const [requestedValue, setRequestedValue] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fieldLabels: Record<(typeof FIELDS)[number], string> = {
    username: copy.fieldUsername,
    full_name: copy.fieldFullName,
    phone: copy.fieldPhone,
    contact_email: copy.fieldContactEmail,
    other: copy.fieldOther,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const res = await fetch('/api/account/change-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field_key: fieldKey,
        requested_value: requestedValue.trim(),
        note: note.trim(),
      }),
    })

    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(body.error || copy.loadError)
      setLoading(false)
      return
    }

    setMessage(copy.requestSent)
    setRequestedValue('')
    setNote('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="account-request-field">{copy.field}</Label>
        <select
          id="account-request-field"
          value={fieldKey}
          onChange={(e) => setFieldKey(e.target.value as (typeof FIELDS)[number])}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {FIELDS.map((key) => (
            <option key={key} value={key}>
              {fieldLabels[key]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-request-value">{copy.requestedValue}</Label>
        <Input
          id="account-request-value"
          value={requestedValue}
          onChange={(e) => setRequestedValue(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-request-note">{copy.note}</Label>
        <Textarea
          id="account-request-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />
      </div>
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? copy.submitting : copy.submitRequest}
      </Button>
    </form>
  )
}
