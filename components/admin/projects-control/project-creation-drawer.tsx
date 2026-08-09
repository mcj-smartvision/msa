'use client'

import { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { ProjectForm } from '@/components/admin/project-form'
import { Button } from '@/components/ui/button'
import type { CreateProjectInput } from '@/types/admin'

export function ProjectCreationDrawer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: CreateProjectInput) => Promise<void>
}) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[#17202A]/40"
        aria-label="بستن پنجره ایجاد پروژه"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-s border-[#E4E7EC] bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E4E7EC] px-4 py-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[#17202A]">
              ایجاد پروژه جدید
            </h2>
            <p id={descId} className="mt-0.5 text-xs text-[#667085]">
              مشخصات پایه پروژه را وارد کنید. پس از ایجاد می‌توانید اعضا و سمت‌ها را مدیریت کنید.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="بستن">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ProjectForm
            submitLabel="ایجاد پروژه"
            variant="plain"
            onSubmit={async (values) => {
              await onSubmit(values)
            }}
            onCancel={onClose}
          />
        </div>
      </aside>
    </div>
  )
}
