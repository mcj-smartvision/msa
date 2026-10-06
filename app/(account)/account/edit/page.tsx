'use client'

import { AccountPageShell } from '@/features/account/components/account-page-shell'
import { AccountEditForm } from '@/features/account/components/account-edit-form'
import { accountCopy } from '@/features/account/lib/copy'
import { useLocale } from '@/shared/components/i18n/locale-provider'

export default function AccountEditPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.editTitle} hint={copy.editHint}>
      <AccountEditForm />
    </AccountPageShell>
  )
}
