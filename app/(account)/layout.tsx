import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GlobalMessengerFab } from '@/components/layout/global-messenger-fab'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <>
      {children}
      <GlobalMessengerFab />
    </>
  )
}
