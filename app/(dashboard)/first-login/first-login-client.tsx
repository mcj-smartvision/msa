'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/client'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { resolvePostLoginPath } from '@/shared/lib/dashboard/redirect'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import { HardHat, ShieldCheck, Lock } from 'lucide-react'

export default function FirstLoginClient() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('رمزها یکسان نیستند.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      setError('نشست منقضی شده است. لطفاً دوباره وارد شوید.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabase.from('profiles').update({ is_first_login: false }).eq('id', user.id)
    await supabase
      .from('project_members')
      .update({ password_changed_by_member: true })
      .eq('user_id', user.id)

    const context = await fetchDashboardUserContext(supabase, user.id, user.email)
    router.push(resolvePostLoginPath(context))
    router.refresh()
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card shadow-elevated overflow-hidden">
          <div className="industrial-gradient px-6 py-8 text-white text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur border border-white/20">
                <ShieldCheck className="h-7 w-7" />
              </div>
            </div>
            <h1 className="text-xl font-bold">حساب خود را امن کنید</h1>
            <p className="text-sm text-white/70 mt-2">
              ادمین حساب شما را ساخته است. قبل از ادامه، یک رمز شخصی تنظیم کنید.
            </p>
          </div>

          <div className="p-6 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">رمز جدید</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 h-11"
                    placeholder="حداقل ۶ کاراکتر"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأیید رمز</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 h-11"
                    placeholder="رمز را دوباره وارد کنید"
                  />
                </div>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? 'در حال ذخیره...' : 'ادامه به داشبورد'}
              </Button>
            </form>

            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <HardHat className="h-3.5 w-3.5" />
              MSA · امنیت اولین ورود
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
