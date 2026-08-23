'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessengerButton } from '@/components/messaging/messenger-panel'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import { PageHeader } from '@/components/admin/shared'

const PRIMARY = [
  { href: '/site-ops/schedule', label: 'برنامه' },
  { href: '/site-ops/approvals', label: 'تأییدات' },
  { href: '/site-ops/prepared', label: 'لیست‌ها' },
  { href: '/site-ops/today', label: 'امروز' },
  { href: '/site-ops/flags', label: 'پرچم‌ها' },
]

const ADVANCED = [
  { href: '/site-ops/cre-runs', label: 'اجراهای CRE' },
  { href: '/site-ops/daily-plans', label: 'برنامه روزانه (پیشرفته)' },
  { href: '/site-ops/reports/daily', label: 'گزارش روزانه' },
  { href: '/site-ops/exceptions', label: 'استثناها' },
  { href: '/dashboard/technical-office', label: 'دفتر فنی (پیشرفته)' },
]

export function SiteOpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const asSupervisor = searchParams.get('as') === 'supervisor'
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [readOnly, setReadOnly] = useState(asSupervisor)

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from('projects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  useEffect(() => {
    if (!projectId) return
    void fetch(`/api/workshop/capabilities?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.readOnly === 'boolean') {
          setReadOnly(asSupervisor || data.readOnly)
        }
      })
      .catch(() => setReadOnly(asSupervisor))
  }, [projectId, asSupervisor])

  useEffect(() => {
    if (!projectId && projects[0]) {
      writeProjectCookie(projects[0].id)
      const params = new URLSearchParams(searchParams.toString())
      params.set('projectId', projects[0].id)
      const target =
        pathname === '/site-ops' || pathname === '/site-ops/'
          ? `/site-ops/${asSupervisor ? 'prepared' : 'schedule'}?${params.toString()}`
          : `${pathname}?${params.toString()}`
      router.replace(target)
    } else if (projectId) {
      writeProjectCookie(projectId)
    }
  }, [projectId, projects, pathname, router, searchParams, asSupervisor])

  // Default landing → schedule (or prepared for supervisor view)
  useEffect(() => {
    if (pathname === '/site-ops' || pathname === '/site-ops/') {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)
      if (asSupervisor) params.set('as', 'supervisor')
      const dest = asSupervisor || readOnly ? 'prepared' : 'schedule'
      const q = params.toString() ? `?${params.toString()}` : ''
      router.replace(`/site-ops/${dest}${q}`)
    }
  }, [pathname, projectId, router, asSupervisor, readOnly])

  const q = useMemo(() => {
    const params = new URLSearchParams()
    if (projectId) params.set('projectId', projectId)
    if (asSupervisor || readOnly) params.set('as', 'supervisor')
    const s = params.toString()
    return s ? `?${s}` : ''
  }, [projectId, asSupervisor, readOnly])

  function onProjectChange(id: string) {
    writeProjectCookie(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('projectId', id)
    if (asSupervisor || readOnly) params.set('as', 'supervisor')
    const base = pathname === '/site-ops' ? '/site-ops/schedule' : pathname
    router.push(`${base}?${params.toString()}`)
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="کارگاه روزانه"
        description={
          readOnly
            ? 'نمای سرپرست کارگاه — فقط مشاهده؛ ویرایش برای دفتر فنی است.'
            : 'برنامه را ببینید، زیرمجموعه بسازید، به امروز بفرستید، عملکرد ثبت کنید.'
        }
      />
      <header className="space-y-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="ms-auto order-first sm:order-none">
            <MessengerButton />
          </div>
          <label className="text-sm text-slate-600">
            پروژه
            <select
              className="mt-1 block min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              <option value="">انتخاب پروژه</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <nav className="flex flex-wrap gap-2">
            {PRIMARY.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={`${link.href}${q}`}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-slate-500 underline underline-offset-2"
          >
            {showAdvanced ? 'مخفی کردن ابزار پیشرفته' : 'ابزار پیشرفته'}
          </button>
        </div>
        {showAdvanced && (
          <nav className="flex flex-wrap gap-2 pt-1">
            {ADVANCED.map((link) => (
              <Link
                key={link.href}
                href={link.href.startsWith('/dashboard') ? link.href : `${link.href}${q}`}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {children}
    </div>
  )
}
