/**
 * @file shared/components/brand/brand-logo.tsx
 * @purpose کامپوننت UI — زیرساخت مشترک سامانه (brand-logo)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/lib/brand, shared/lib/utils
 */

'use client'

import { APP_LOGO_DARK_SRC, APP_LOGO_SRC, APP_NAME } from '@/shared/lib/brand'
import { cn } from '@/shared/lib/utils'

const SIZE = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-12 sm:h-14',
} as const

export function BrandLogo({
  size = 'md',
  withName: _withName = false,
  variant = 'light',
  className,
}: {
  size?: keyof typeof SIZE
  /** Kept for callers; the lockup image already includes the name. */
  withName?: boolean
  /** light = black wordmark; dark = white wordmark */
  variant?: 'light' | 'dark'
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center min-w-0', className)}>
      <img
        src={variant === 'dark' ? APP_LOGO_DARK_SRC : APP_LOGO_SRC}
        alt={APP_NAME}
        className={cn('w-auto max-w-full object-contain object-left bg-transparent', SIZE[size])}
      />
    </span>
  )
}
