'use client'

import { AccountPageShell } from '@/features/account/components/account-page-shell'
import { AccountChangeRequestForm } from '@/features/account/components/account-change-request-form'
import { accountCopy } from '@/features/account/lib/copy'
import { useLocale } from '@/shared/components/i18n/locale-provider'

export default function AccountChangeRequestPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.requestTitle} hint={copy.requestHint}>
      <AccountChangeRequestForm />
    </AccountPageShell>
  )
}
