'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatLoginDisplay } from '@/lib/auth/login-identifier'
import type { ProjectMember } from '@/types/admin'

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
      setMessage('رمز عبور با موفقیت به‌روزرسانی شد.')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بازنشانی رمز عبور ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>اطلاعات ورود (نمای ادمین)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-4 space-y-2">
          <p className="text-sm">
            <span className="font-medium">نام کاربری:</span> {formatLoginDisplay(member.email)}
          </p>
          {member.contact_email ? (
            <p className="text-sm">
              <span className="font-medium">ایمیل:</span> {member.contact_email}
            </p>
          ) : !member.email?.toLowerCase().endsWith('@site.local') ? (
            <p className="text-sm">
              <span className="font-medium">ایمیل:</span> {member.email}
            </p>
          ) : (
            <p className="text-xs text-amber-700">
              ایمیل واقعی هنوز ثبت نشده — برای اعلان ورود/خروج در فرم پایین ایمیل بگذارید.
            </p>
          )}
          <p className="text-sm">
            <span className="font-medium">آخرین رمز قابل‌مشاهده برای ادمین:</span>{' '}
            {member.admin_visible_password || '—'}
          </p>
          {member.password_changed_by_member ? (
            <p className="text-xs text-amber-700">
              این عضو رمز خود را در تنظیمات تغییر داده است. ادمین آخرین رمزی را می‌بیند که خودش تنظیم کرده.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">عضو هنوز رمز عبور را تغییر نداده است.</p>
          )}
        </div>

        <form onSubmit={handleReset} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reset-password">تنظیم رمز جدید</Label>
            <Input
              id="reset-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder="رمز جدید برای این عضو"
              required
            />
          </div>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'در حال به‌روزرسانی...' : 'به‌روزرسانی رمز عبور'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
