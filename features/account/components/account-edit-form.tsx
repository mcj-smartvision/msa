'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/shared/lib/supabase/client'
import { accountCopy } from '@/features/account/lib/copy'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'

export function AccountEditForm() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setError(copy.mustLogin)
        return
      }
      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('full_name, phone, contact_email')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (loadError) {
        setError(loadError.message)
        return
      }
      setFullName(data?.full_name ?? '')
      setPhone(data?.phone ?? '')
      setContactEmail(data?.contact_email ?? '')
    }
    load().catch(() => {
      if (!cancelled) setError(copy.loadError)
    })
    return () => {
      cancelled = true
    }
  }, [copy.loadError, copy.mustLogin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError(copy.mustLogin)
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        contact_email: contactEmail.trim() || null,
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setMessage(copy.saved)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="account-full-name">{copy.fullName}</Label>
        <Input
          id="account-full-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-phone">{copy.phone}</Label>
        <Input id="account-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-contact-email">{copy.contactEmail}</Label>
        <Input
          id="account-contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
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
        {loading ? copy.saving : copy.save}
      </Button>
    </form>
  )
}
