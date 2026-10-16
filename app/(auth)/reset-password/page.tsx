/**
 * @file app/(auth)/reset-password/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/client, shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/card, shared/components/ui/alert
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/client'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { AUTH_COPY } from '@/shared/lib/i18n/auth'
import { COMMON_UI } from '@/shared/lib/i18n/common-ui'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(AUTH_COPY.firstLogin.mismatch)
      return
    }

    if (password.length < AUTH_COPY.minPasswordLength) {
      setError(AUTH_COPY.firstLogin.passwordShort)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    if (user) {
      await supabase
        .from('project_members')
        .update({ password_changed_by_member: true })
        .eq('user_id', user.id)
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{AUTH_COPY.reset.title}</CardTitle>
          <CardDescription>{AUTH_COPY.reset.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{AUTH_COPY.firstLogin.newPassword}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={AUTH_COPY.minPasswordLength}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{AUTH_COPY.firstLogin.confirmPassword}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={AUTH_COPY.minPasswordLength}
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? COMMON_UI.saving : AUTH_COPY.reset.save}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            <Link href="/login" className="text-primary underline">
              {AUTH_COPY.forgot.backToLogin}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
