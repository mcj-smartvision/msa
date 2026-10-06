'use client'

import { useEffect, useState } from 'react'
import { documentationData, type DocSection } from '@/features/hse/lib/docs-data'
import { HsePageHeader } from '@/features/hse/components/ui'
import { cn } from '@/shared/lib/utils'

const AUDIENCE_CLASS: Record<DocSection['audience'], string> = {
  همه: 'bg-slate-100 text-slate-700 border-slate-300',
  کارفرما: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'مسئول ایمنی': 'bg-amber-50 text-amber-900 border-amber-200',
  'تیم فنی': 'bg-sky-50 text-sky-800 border-sky-200',
}

export function DocumentationPage() {
  const [active, setActive] = useState(documentationData[0]?.id ?? '')

  useEffect(() => {
    const nodes = documentationData
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => Boolean(n))
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActive(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] }
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title="راهنمای عملیات ایمنی"
        description="این راهنما نحوه استقرار، بهره‌برداری و نگهداری سامانه پایش هوشمند ایمنی MSA را توضیح می‌دهد."
      />

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-3 lg:self-start">
          <nav className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
            <p className="mb-2 px-2 text-[11px] font-semibold text-slate-500">فهرست مطالب</p>
            <ul className="space-y-0.5">
              {documentationData.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={() => setActive(section.id)}
                    className={cn(
                      'block rounded px-2 py-1.5 text-xs font-medium transition-colors',
                      active === section.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="space-y-4">
          {documentationData.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                <span
                  className={cn(
                    'rounded border px-2 py-0.5 text-[11px] font-medium',
                    AUDIENCE_CLASS[section.audience]
                  )}
                >
                  مخاطب: {section.audience}
                </span>
              </div>
              <div className="space-y-3 text-sm leading-7 text-slate-700 text-justify">
                {section.content.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
