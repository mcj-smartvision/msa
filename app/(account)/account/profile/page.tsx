'use client'

import { AccountPageShell } from '@/features/account/components/account-page-shell'
import { AccountProfileView } from '@/features/account/components/account-profile-view'
import { accountCopy } from '@/features/account/lib/copy'
import { useLocale } from '@/shared/components/i18n/locale-provider'

export default function AccountProfilePage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.profileTitle} hint={copy.profileHint}>
      <AccountProfileView />
    </AccountPageShell>
  )
}
