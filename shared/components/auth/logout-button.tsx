/**
 * @file shared/components/auth/logout-button.tsx
 * @purpose کامپوننت UI — زیرساخت مشترک سامانه (logout-button)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/lib/supabase/client, shared/components/ui/button, shared/lib/i18n/chrome
 */

'use client'

import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/components/i18n/locale-provider';
import { getChromeMessages } from '@/shared/lib/i18n/chrome';

export function LogoutButton({ label, className }: { label?: string; className?: string }) {
  const router = useRouter()
  const { locale } = useLocale()
  const text = label ?? getChromeMessages(locale).signOut

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} className={className}>
      {text}
    </Button>
  )
}
