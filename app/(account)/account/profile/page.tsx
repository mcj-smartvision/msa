'use client'

import { AccountPageShell } from '@/components/account/account-page-shell'
import { AccountProfileView } from '@/components/account/account-profile-view'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'

export default function AccountProfilePage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.profileTitle} hint={copy.profileHint}>
      <AccountProfileView />
    </AccountPageShell>
  )
}
