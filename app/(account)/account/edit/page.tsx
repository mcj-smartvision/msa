'use client'

import { AccountPageShell } from '@/components/account/account-page-shell'
import { AccountEditForm } from '@/components/account/account-edit-form'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'

export default function AccountEditPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.editTitle} hint={copy.editHint}>
      <AccountEditForm />
    </AccountPageShell>
  )
}
