'use client'

import { AccountPageShell } from '@/components/account/account-page-shell'
import { AccountChangeRequestForm } from '@/components/account/account-change-request-form'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'

export default function AccountChangeRequestPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.requestTitle} hint={copy.requestHint}>
      <AccountChangeRequestForm />
    </AccountPageShell>
  )
}
