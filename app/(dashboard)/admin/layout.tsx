/**
 * @file app/(dashboard)/admin/layout.tsx
 * @purpose کامپوننت UI — مسیرها و layout (layout)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/admin/lib/access, features/admin/components/admin-nav
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { AdminShell } from '@/features/admin/components/admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = await isSystemAdmin(supabase, user.id)
  if (!admin) redirect('/dashboard')

  return <AdminShell email={user.email ?? undefined}>{children}</AdminShell>
}
