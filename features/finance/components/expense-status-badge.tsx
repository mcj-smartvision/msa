'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { AccountingDocumentStatus } from '@/features/finance/lib/expense-types'
import { isDocumentLocked } from '@/features/finance/lib/expense-types'
import { getExpenseStatusLabel } from '@/shared/lib/i18n/expenses'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'

const STATUS_CLASS: Record<AccountingDocumentStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  submitted: 'bg-sky-100 text-sky-800 border-sky-200',
  finalized: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  corrected: 'bg-violet-100 text-violet-800 border-violet-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  reversed: 'bg-amber-100 text-amber-900 border-amber-200',
}

export function ExpenseStatusBadge({
  status,
  locale,
  showLock = true,
}: {
  status: AccountingDocumentStatus
  locale: FormLocale
  showLock?: boolean
}) {
  const locked = showLock && isDocumentLocked(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        STATUS_CLASS[status]
      )}
    >
      {locked ? <Lock className="h-3 w-3" aria-hidden /> : null}
      {getExpenseStatusLabel(status, locale)}
    </span>
  )
}
