/**
 * @file app/(dashboard)/settings/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/client, shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/card, shared/components/ui/alert, features/admin/components/shared, features/schedule/components/header-calendar-switcher
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/client'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { PageHeader } from '@/features/admin/components/shared'
import { HeaderCalendarSwitcher } from '@/features/schedule/components/header-calendar-switcher'
import { accountCopy, SETTINGS_PAGE_COPY } from '@/features/account/lib/copy'

export default function SettingsPage() {
  const t = accountCopy(true)
  const page = SETTINGS_PAGE_COPY
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

    if (newPassword.length < 6) {
      setError(t.passwordShort)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      setError(t.mustLogin)
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (verifyError) {
      setError(t.wrongPassword)
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabase
      .from('project_members')
      .update({ password_changed_by_member: true })
      .eq('user_id', user.id)

    await supabase.from('profiles').update({ is_first_login: false }).eq('id', user.id)

    setMessage(t.passwordUpdated)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title={page.title}
        description={page.description}
      />

      <Card>
        <CardHeader>
          <CardTitle>{page.calendar}</CardTitle>
          <CardDescription>{page.calendarHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <HeaderCalendarSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.passwordTitle}</CardTitle>
          <CardDescription>{t.passwordHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t.currentPassword}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t.newPassword}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t.confirmPassword}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
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
            <Button type="submit" disabled={loading}>
              {loading ? t.saving : t.updatePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
