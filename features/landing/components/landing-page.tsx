/**
 * @file features/landing/components/landing-page.tsx
 * @purpose کامپوننت UI — صفحه فرود (landing-page)
 * @safe-to-edit CAREFUL
 * @affects صفحه فرود
 * @depends-on shared/components/ui/button, shared/lib/brand, shared/components/brand/brand-logo
 */

'use client'

import Link from 'next/link'
import {
ArrowLeft,
BarChart3,
Building2,
CheckCircle2,
Shield,
Sparkles,
Users,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { APP_NAME, APP_TAGLINE } from '@/shared/lib/brand'
import { BrandLogo } from '@/shared/components/brand/brand-logo'
import { LANDING_COPY } from '@/features/landing/config'

const benefitIcons = [BarChart3, Users, Shield, Sparkles] as const

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center">
            <BrandLogo size="md" />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">{LANDING_COPY.login}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 site-grid-bg opacity-40" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <div className="max-w-2xl space-y-6">
              <p className="text-sm font-semibold text-primary">{APP_TAGLINE}</p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                {LANDING_COPY.headline}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {LANDING_COPY.introLead} {APP_NAME} {LANDING_COPY.introMid}{' '}
                <strong>{LANDING_COPY.introStrong}</strong> {LANDING_COPY.introTail}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/login">
                    {LANDING_COPY.enter}
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login?redirect=/dashboard/project-manager">{LANDING_COPY.viewDashboard}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-2xl border bg-muted/30 p-8 sm:p-10 flex flex-col sm:flex-row gap-8 items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">{LANDING_COPY.whatTitle}</h2>
              <p className="text-muted-foreground leading-relaxed max-w-2xl">
                {APP_NAME} {LANDING_COPY.whatBodyBefore}{' '}
                <em>{LANDING_COPY.whatBodyEm}</em> {LANDING_COPY.whatBodyAfter}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">{LANDING_COPY.whyTitle(APP_NAME)}</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {LANDING_COPY.benefits.map((b, i) => {
              const Icon = benefitIcons[i]
              return (
              <div
                key={b.title}
                className="rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <Icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.text}</p>
              </div>
              )
            })}
          </div>
        </section>

        <section className="border-t bg-slate-900 text-white py-16">
          <div className="mx-auto max-w-6xl px-4 text-center space-y-6">
            <CheckCircle2 className="h-12 w-12 mx-auto text-orange-400" />
            <h2 className="text-2xl font-bold">{LANDING_COPY.ctaTitle}</h2>
            <p className="text-slate-300 max-w-lg mx-auto">
              {LANDING_COPY.ctaBody}
            </p>
            <Button asChild size="lg" className="bg-orange-600 hover:bg-orange-700">
              <Link href="/login">{LANDING_COPY.enter}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {APP_NAME} · {APP_TAGLINE}
      </footer>
    </div>
  )
}
