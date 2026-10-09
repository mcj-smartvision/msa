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

export default function SettingsPage() {
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
      setError('رمزهای جدید یکسان نیستند.')
      return
    }

    if (newPassword.length < 6) {
      setError('رمز عبور باید حداقل 6 کاراکتر باشد.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      setError('باید وارد شده باشید.')
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (verifyError) {
      setError('رمز فعلی نادرست است.')
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

    setMessage('رمز عبور با موفقیت به‌روزرسانی شد.')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="تنظیمات حساب"
        description="رمز ورود خود را تغییر دهید. ادمین همچنان آخرین رمزی را که برای شما تنظیم کرده می‌بیند."
      />

      <Card>
        <CardHeader>
          <CardTitle>تقویم</CardTitle>
          <CardDescription>تقویم نمایش تاریخ را از اینجا تغییر دهید.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <HeaderCalendarSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تغییر رمز عبور</CardTitle>
          <CardDescription>رمز فعلی را وارد کنید، سپس رمز جدید را تنظیم کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">رمز فعلی</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">رمز جدید</Label>
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
              <Label htmlFor="confirm-password">تأیید رمز جدید</Label>
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
              {loading ? 'در حال ذخیره...' : 'به‌روزرسانی رمز عبور'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
