/**
 * @file app/(dashboard)/first-login/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/user-context, shared/lib/dashboard/redirect
 */

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
