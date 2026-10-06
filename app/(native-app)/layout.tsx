import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'

/** Fullscreen native shell — no desktop dashboard chrome. */
export default async function NativeAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/accountant-app')

  return (
    <div className="min-h-dvh bg-[#0b0e14] text-stone-100 antialiased">{children}</div>
  )
}
