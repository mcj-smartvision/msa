import { LandingPage } from '@/features/landing/components/landing-page'
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import { resolvePostLoginPath } from '@/shared/lib/dashboard/redirect'

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <LandingPage />
  }

  const context = await fetchDashboardUserContext(supabase, user.id, user.email ?? '')
  redirect(resolvePostLoginPath(context))
}
