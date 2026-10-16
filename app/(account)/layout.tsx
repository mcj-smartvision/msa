/**
 * @file app/(account)/layout.tsx
 * @purpose کامپوننت UI — مسیرها و layout (layout)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <>{children}</>
}
