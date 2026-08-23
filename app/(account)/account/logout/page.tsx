'use client'

import { AccountPageShell } from '@/components/account/account-page-shell'
import { AccountLogoutPanel } from '@/components/account/account-logout-panel'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'

export default function AccountLogoutPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.logoutTitle} hint={copy.logoutHint}>
      <AccountLogoutPanel />
    </AccountPageShell>
  )
}
