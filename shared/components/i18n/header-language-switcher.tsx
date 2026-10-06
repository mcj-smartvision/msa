'use client'

import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { LOCALE_OPTIONS } from '@/shared/lib/i18n/app-shell'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { useLocale } from './locale-provider'
import { HEADER_CHIP } from '@/shared/components/layout/header-chip'
import { cn } from '@/shared/lib/utils'

/** Compact language switcher for the global site header */
export function HeaderLanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, app } = useLocale()
  const current = LOCALE_OPTIONS.find((o) => o.value === locale)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  if (!ready) {
    return <div className={cn(className, HEADER_CHIP, 'w-[88px]')} aria-hidden />
  }

  return (
    <div className={className}>
      <Select value={locale} onValueChange={(v) => setLocale(v as FormLocale)}>
        <SelectTrigger
          className={cn(HEADER_CHIP, 'w-auto min-w-0')}
          aria-label={app.language}
        >
          <Globe className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <SelectValue placeholder={app.language}>
            <span className="truncate">{current?.label ?? locale.toUpperCase()}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {LOCALE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="font-medium">{opt.short}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span>{opt.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
