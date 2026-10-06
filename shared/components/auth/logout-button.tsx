'use client'

import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/components/ui/button';

export function LogoutButton({ label = 'خروج', className }: { label?: string; className?: string }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} className={className}>
      {label}
    </Button>
  )
}
