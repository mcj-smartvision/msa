'use client'

import Link from 'next/link'
import { APP_NAME } from '@/lib/brand'

/** Minimal auth pages header (language switcher hidden while UI is forced to Persian) */
export function AuthHeader() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/login" className="font-bold text-lg">
          {APP_NAME}
        </Link>
      </div>
    </header>
  )
}
