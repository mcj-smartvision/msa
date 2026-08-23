'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'

export function AccountLogoutPanel() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = '/login'
    }
    window.close()
    window.location.href = '/login'
  }

  function handleCancel() {
    if (window.opener && !window.opener.closed) {
      window.close()
      return
    }
    window.history.back()
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="button" variant="destructive" className="flex-1" disabled={loading} onClick={handleLogout}>
        {loading ? copy.saving : copy.confirmLogout}
      </Button>
      <Button type="button" variant="outline" className="flex-1" disabled={loading} onClick={handleCancel}>
        {copy.cancel}
      </Button>
    </div>
  )
}
