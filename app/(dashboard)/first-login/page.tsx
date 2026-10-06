import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import { resolvePostLoginPath } from '@/shared/lib/dashboard/redirect'
import FirstLoginClient from './first-login-client'

export default async function FirstLoginPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)
  if (!context.isFirstLogin) {
    redirect(resolvePostLoginPath({ ...context, isFirstLogin: false }))
  }

  return <FirstLoginClient />
}
