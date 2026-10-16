/**
 * @file features/admin/components/admin-password-panel.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (admin-password-panel)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/card, shared/lib/auth/login-identifier, features/admin/config, shared/types/admin
 */

'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { formatLoginDisplay } from '@/shared/lib/auth/login-identifier'
import { ADMIN_PASSWORD_COPY } from '@/features/admin/config'
import type { ProjectMember } from '@/shared/types/admin'

interface AdminPasswordPanelProps {
  member: ProjectMember
  onReset: (password: string) => Promise<void>
}

export function AdminPasswordPanel({ member, onReset }: AdminPasswordPanelProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      await onReset(password)
      setMessage(ADMIN_PASSWORD_COPY.updated)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : ADMIN_PASSWORD_COPY.resetFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ADMIN_PASSWORD_COPY.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-4 space-y-2">
          <p className="text-sm">
            <span className="font-medium">{ADMIN_PASSWORD_COPY.username}</span> {formatLoginDisplay(member.email)}
          </p>
          {member.contact_email ? (
            <p className="text-sm">
              <span className="font-medium">{ADMIN_PASSWORD_COPY.email}</span> {member.contact_email}
            </p>
          ) : !member.email?.toLowerCase().endsWith('@site.local') ? (
            <p className="text-sm">
              <span className="font-medium">{ADMIN_PASSWORD_COPY.email}</span> {member.email}
            </p>
          ) : (
            <p className="text-xs text-amber-700">{ADMIN_PASSWORD_COPY.noRealEmail}</p>
          )}
          <p className="text-sm">
            <span className="font-medium">{ADMIN_PASSWORD_COPY.lastVisiblePassword}</span>{' '}
            {member.admin_visible_password || '—'}
          </p>
          {member.password_changed_by_member ? (
            <p className="text-xs text-amber-700">{ADMIN_PASSWORD_COPY.memberChangedPassword}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{ADMIN_PASSWORD_COPY.memberNotChanged}</p>
          )}
        </div>

        <form onSubmit={handleReset} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reset-password">{ADMIN_PASSWORD_COPY.setNewPassword}</Label>
            <Input
              id="reset-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder={ADMIN_PASSWORD_COPY.newPasswordPlaceholder}
              required
            />
          </div>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? ADMIN_PASSWORD_COPY.updating : ADMIN_PASSWORD_COPY.updatePassword}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
