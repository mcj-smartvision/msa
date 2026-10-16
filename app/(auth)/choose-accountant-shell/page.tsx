/**
 * @file app/(auth)/choose-accountant-shell/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/user-context, shared/lib/dashboard/accountant-shell, features/finance/components/choose-accountant-shell-client
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import {
ACCOUNTANT_DESKTOP_PATH,
shouldAskAccountantShell,
} from '@/shared/lib/dashboard/accountant-shell'
import { ChooseAccountantShellClient } from '@/features/finance/components/choose-accountant-shell-client'

export default async function ChooseAccountantShellPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)

  if (context.isFirstLogin) redirect('/first-login')
  if (!shouldAskAccountantShell(context)) {
    redirect(context.isSystemAdmin ? '/admin' : ACCOUNTANT_DESKTOP_PATH)
  }

  return <ChooseAccountantShellClient />
}
