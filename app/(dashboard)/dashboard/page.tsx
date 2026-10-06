import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import { resolvePostLoginPath } from '@/shared/lib/dashboard/redirect'
import { DashboardClient } from '@/features/dashboard/components/dashboard-client'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)
  const postLogin = resolvePostLoginPath(context)

  if (postLogin === '/first-login') redirect('/first-login')
  if (postLogin === '/admin' && context.projects.length === 0) redirect('/admin')
  // Role users land on their own dashboard, not the generic hub
  if (postLogin !== '/dashboard') redirect(postLogin)

  return <DashboardClient initialContext={context} />
}
