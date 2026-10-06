'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, Maximize2, Minimize2 } from 'lucide-react'
import { PageHeader } from '@/features/admin/components/shared'
import { ProjectForm } from '@/features/admin/components/project-form'
import { Button } from '@/shared/components/ui/button'
import { useControlCenterDetailsOptional } from '@/features/admin/components/control-center-details-context'
import { ALL_PROJECTS_SCOPE, writeProjectCookie } from '@/shared/lib/project/project-cookie'
import { cn } from '@/shared/lib/utils'
import type { CreateProjectInput } from '@/shared/types/admin'

export function ProjectCreationPage() {
  const router = useRouter()
  const pathname = usePathname()
  const adminCtx = useControlCenterDetailsOptional()
  const [expanded, setExpanded] = useState(false)
  const [formKey, setFormKey] = useState(() => crypto.randomUUID())

  const setAdminScope = adminCtx?.setScope
  const refreshProjects = adminCtx?.refreshProjects

  useEffect(() => {
    if (pathname !== '/admin/projects/new') return
    setFormKey(crypto.randomUUID())
    setAdminScope?.(ALL_PROJECTS_SCOPE)
  }, [pathname, setAdminScope])

  async function handleCreate(input: CreateProjectInput) {
    const res = await fetch('/api/admin/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => ({}))) as { project?: { id?: string }; error?: string }
    if (!res.ok || !json.project?.id) {
      throw new Error(json.error || 'ذخیره پروژه ناموفق بود')
    }
    writeProjectCookie(json.project.id)
    setAdminScope?.(json.project.id)
    await refreshProjects?.()
    router.refresh()
    router.push(`/admin/projects/${json.project.id}/members`)
  }

  return (
    <div
      className={cn(
        expanded
          ? 'fixed inset-0 z-50 overflow-y-auto bg-[#5a7088] p-3 sm:p-5'
          : 'mx-auto max-w-[1100px] space-y-5'
      )}
    >
      {!expanded ? (
        <PageHeader
          title="ایجاد پروژه جدید"
          description="مشخصات پایه پروژه را وارد کنید. پس از ایجاد می‌توانید اعضا و سمت‌ها را مدیریت کنید."
          actions={
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/admin">
                <ArrowRight className="h-4 w-4" />
                بازگشت
              </Link>
            </Button>
          }
        />
      ) : null}

      <div
        className={cn(
          'rounded-[12px] border border-[#5a7088] bg-white shadow-[0_8px_30px_rgba(16,24,40,0.12)]',
          expanded ? 'min-h-[calc(100vh-2.5rem)]' : ''
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4E7EC] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#17202A]">فرم ایجاد پروژه</h2>
            <p className="mt-1 text-sm text-[#667085]">
              کارفرما، پیمانکار، مدیر پروژه، آدرس و تاریخ‌های قرارداد را تکمیل کنید.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#E4E7EC] bg-white text-slate-800"
              onClick={() => setExpanded((current) => !current)}
              aria-label={expanded ? 'خروج از حالت تمام‌صفحه' : 'بزرگ‌نمایی فرم'}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {expanded ? 'کوچک‌کردن' : 'بزرگ‌نمایی'}
            </Button>
            {expanded ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[#E4E7EC] bg-white text-slate-800"
              >
                <Link href="/admin">
                  <ArrowRight className="h-4 w-4" />
                  بازگشت
                </Link>
              </Button>
            ) : null}
          </div>
        </header>

        <div className={cn('px-4 py-5 sm:px-6 sm:py-6', expanded && 'px-6 py-8 sm:px-10')}>
          <ProjectForm
            key={formKey}
            variant="page"
            submitLabel="ایجاد پروژه"
            onSubmit={handleCreate}
            onCancel={() => router.push('/admin')}
          />
        </div>
      </div>
    </div>
  )
}
