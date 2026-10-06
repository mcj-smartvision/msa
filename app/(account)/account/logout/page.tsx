'use client'

import { AccountPageShell } from '@/features/account/components/account-page-shell'
import { AccountLogoutPanel } from '@/features/account/components/account-logout-panel'
import { accountCopy } from '@/features/account/lib/copy'
import { useLocale } from '@/shared/components/i18n/locale-provider'

export default function AccountLogoutPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.logoutTitle} hint={copy.logoutHint}>
      <AccountLogoutPanel />
    </AccountPageShell>
  )
}
