/**
 * @file app/(account)/account/change-request/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/account/components/account-page-shell, features/account/components/account-change-request-form, features/account/lib/copy, shared/components/i18n/locale-provider
 */

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
