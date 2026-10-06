'use client'

import { Input } from '@/shared/components/ui/input'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import {
formatMoneyFromNumber,
formatMoneyInput,
parseMoneyInput,
} from '@/features/finance/lib/money-input'
import { cn } from '@/shared/lib/utils'

interface MoneyInputProps {
  value: string
  onChange: (formatted: string) => void
  id?: string
  required?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
  min?: number
}

/**
 * Amount field with live thousand separators (e.g. ۲٬۰۰۰٬۰۰۰ / 2,000,000)
 * so zeros are easier to count while typing.
 */
export function MoneyInput({
  value,
  onChange,
  id,
  required,
  disabled,
  className,
  placeholder,
  min = 0,
}: MoneyInputProps) {
  const { locale } = useLocale()

  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      required={required}
      disabled={disabled}
      placeholder={placeholder ?? (locale === 'en' ? '0' : '۰')}
      dir="ltr"
      className={cn('font-mono tabular-nums text-start', className)}
      value={value}
      onChange={(e) => onChange(formatMoneyInput(e.target.value, locale))}
      onBlur={() => {
        const n = parseMoneyInput(value)
        if (Number.isFinite(n) && n >= min) {
          onChange(formatMoneyFromNumber(n, locale))
        }
      }}
    />
  )
}

export { parseMoneyInput, formatMoneyFromNumber, formatMoneyInput }
