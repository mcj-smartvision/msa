/**
 * @file app/(auth)/forgot-password/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/client, shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/card, shared/components/ui/alert
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/shared/lib/supabase/client'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { AUTH_COPY } from '@/shared/lib/i18n/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
    } else {
      setMessage(AUTH_COPY.forgot.sent)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{AUTH_COPY.forgot.title}</CardTitle>
          <CardDescription>{AUTH_COPY.forgot.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{AUTH_COPY.forgot.email}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? AUTH_COPY.forgot.sending : AUTH_COPY.forgot.send}
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
