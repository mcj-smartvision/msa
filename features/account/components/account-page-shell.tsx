'use client'

import { X } from 'lucide-react'
import { BrandLogo } from '@/shared/components/brand/brand-logo'
import { accountCopy } from '@/features/account/lib/copy'
import { closeAccountPage } from '@/features/account/lib/open-account-page'
import { useLocale } from '@/shared/components/i18n/locale-provider'

export function AccountPageShell({
  title,
  hint,
  children,
  wide = false,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  wide?: boolean
}) {
  const { locale } = useLocale()
  const copy = accountCopy(locale === 'fa')

  return (
    <div className="min-h-screen bg-[#5a7088] px-4 py-8 sm:px-6">
      <div
        className={
          wide
            ? 'mx-auto w-full max-w-[960px] overflow-hidden rounded-[16px] border border-[#5a7088] bg-white shadow-lg'
            : 'mx-auto w-full max-w-[560px] overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-lg'
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <BrandLogo size="sm" />
          <button
            type="button"
            onClick={() => closeAccountPage()}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-slate-500 hover:bg-slate-100"
            aria-label={copy.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
