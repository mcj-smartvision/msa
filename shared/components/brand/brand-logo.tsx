'use client'

import { APP_NAME } from '@/shared/lib/brand'
import { cn } from '@/shared/lib/utils'

const SIZE = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14 sm:h-16',
} as const

export function BrandLogo({
  size = 'md',
  withName: _withName = false,
  className,
}: {
  size?: keyof typeof SIZE
  /** Kept for callers; the lockup image already includes the name. */
  withName?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center min-w-0', className)}>
      <img
        src="/brand/msa-logo.png"
        alt={APP_NAME}
        className={cn(
          'w-auto max-w-full object-contain object-left bg-white rounded-md',
          SIZE[size]
        )}
      />
    </span>
  )
}
