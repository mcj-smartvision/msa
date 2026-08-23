'use client'

import { AccountPageShell } from '@/components/account/account-page-shell'
import { AccountPasswordForm } from '@/components/account/account-password-form'
import { accountCopy } from '@/lib/account/copy'
import { useLocale } from '@/components/i18n/locale-provider'

export default function AccountPasswordPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.passwordTitle} hint={copy.passwordHint}>
      <AccountPasswordForm />
    </AccountPageShell>
  )
}
