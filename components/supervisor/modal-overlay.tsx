'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ModalOverlayProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  overlayClassName?: string
}

export function ModalOverlay({ open, onClose, title, children, className, overlayClassName }: ModalOverlayProps) {
  if (!open) return null

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50', overlayClassName)}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'w-full max-h-[92vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-slate-100 text-slate-900 shadow-lg sm:max-w-lg sm:rounded-xl',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="بستن">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
