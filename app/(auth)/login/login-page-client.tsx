/**
 * @file app/(auth)/login/login-page-client.tsx
 * @purpose کامپوننت UI — مسیرها و layout (login-page-client)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/client, shared/components/i18n/locale-provider, shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/alert, shared/lib/auth/login-identifier, shared/lib/brand, shared/components/brand/brand-logo
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/client'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Lock, User, ArrowRight } from 'lucide-react'
import { normalizeLoginIdentifier } from '@/shared/lib/auth/login-identifier'
import { APP_TAGLINE } from '@/shared/lib/brand'
import { BrandLogo } from '@/shared/components/brand/brand-logo'
import { AUTH_COPY } from '@/shared/lib/i18n/auth'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { app } = useLocale()
  const redirectParam = searchParams.get('redirect')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const authEmail = normalizeLoginIdentifier(identifier)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      })

      if (signInError) {
        const msg = signInError.message.toLowerCase()
        if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('failed to fetch')) {
          setError(AUTH_COPY.networkError)
        } else if (msg.includes('invalid login credentials')) {
          setError(AUTH_COPY.badCredentials)
        } else {
          setError(signInError.message)
        }
        return
      }

      if (redirectParam && redirectParam !== '/login') {
        router.push(redirectParam)
        router.refresh()
        return
      }

      try {
        const res = await fetch('/api/auth/post-login')
        const data = await res.json().catch(() => ({} as { redirectTo?: string }))
        if (!res.ok || !data.redirectTo || data.redirectTo === '/login') {
          setError(AUTH_COPY.incomplete)
          return
        }
        router.push(data.redirectTo)
      } catch {
        router.push('/dashboard')
      }
      router.refresh()
    } catch {
      setError(AUTH_COPY.failed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 industrial-gradient relative">
      <div className="absolute inset-0 site-grid-bg opacity-10 pointer-events-none" />

      <div className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-background/95 backdrop-blur-sm shadow-elevated p-8 sm:p-10">
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo size="lg" className="mb-3" />
          <p className="text-xs text-muted-foreground mt-1">{APP_TAGLINE}</p>
        </div>

        <div className="space-y-2 mb-6 text-center">
          <h2 className="text-lg font-semibold">{app.signIn}</h2>
          <p className="text-muted-foreground text-sm">
            {AUTH_COPY.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="identifier">{app.email}</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="pl-10 h-11"
                placeholder={AUTH_COPY.identifierPlaceholder}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{app.password}</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                {app.forgotPassword}
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 h-11"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? AUTH_COPY.signingIn : (
              <>
                {app.signIn}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {AUTH_COPY.inviteOnly}
        </p>
      </div>
    </div>
  )
}
