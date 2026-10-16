/**
 * @file app/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/landing/components/landing-page, shared/lib/supabase/server, shared/lib/dashboard/user-context, shared/lib/dashboard/redirect
 */

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
