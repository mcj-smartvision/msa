/**
 * @file app/(account)/account/password/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/account/components/account-page-shell, features/account/components/account-password-form, features/account/lib/copy, shared/components/i18n/locale-provider
 */

'use client'

import { AccountPageShell } from '@/features/account/components/account-page-shell'
import { AccountPasswordForm } from '@/features/account/components/account-password-form'
import { accountCopy } from '@/features/account/lib/copy'
import { useLocale } from '@/shared/components/i18n/locale-provider'

export default function AccountPasswordPage() {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')
  return (
    <AccountPageShell title={copy.passwordTitle} hint={copy.passwordHint}>
      <AccountPasswordForm />
    </AccountPageShell>
  )
}
