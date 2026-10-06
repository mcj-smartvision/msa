'use client'

import { useRouter } from 'next/navigation'
import { Monitor, Smartphone } from 'lucide-react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import {
ACCOUNTANT_DESKTOP_PATH,
ACCOUNTANT_MOBILE_PATH,
} from '@/shared/lib/dashboard/accountant-shell'
import { BrandLogo } from '@/shared/components/brand/brand-logo'
import { cn } from '@/shared/lib/utils'

export function ChooseAccountantShellClient() {
  const router = useRouter()
  const { locale, dir } = useLocale()
  const isFa = locale === 'fa' || locale === 'ar'

  const copy = isFa
    ? {
        title: 'نحوه ورود را انتخاب کنید',
        subtitle: 'حساب شما حسابدار است. با کدام نسخه وارد می‌شوید؟',
        mobileTitle: 'نسخه موبایل',
        mobileDesc: 'داشبورد لمسی بهینه‌شده برای گوشی و تبلت',
        desktopTitle: 'نسخه ویندوز',
        desktopDesc: 'داشبورد کامل دسکتاپ برای کار با مانیتور و کیبورد',
        continue: 'ادامه',
      }
    : {
        title: 'Choose how to continue',
        subtitle: 'Your account is an accountant. Which version do you want?',
        mobileTitle: 'Mobile version',
        mobileDesc: 'Touch-friendly dashboard for phone and tablet',
        desktopTitle: 'Windows version',
        desktopDesc: 'Full desktop dashboard for monitor and keyboard',
        continue: 'Continue',
      }

  function go(path: string) {
    router.push(path)
    router.refresh()
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4 industrial-gradient"
      dir={dir}
    >
      <div className="pointer-events-none absolute inset-0 site-grid-bg opacity-10" />
      <div className="relative w-full max-w-lg space-y-6 rounded-2xl border border-white/10 bg-background/95 p-6 shadow-elevated backdrop-blur-sm sm:p-8">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => go(ACCOUNTANT_MOBILE_PATH)}
            className={cn(
              'group flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-4 text-start transition',
              'hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Smartphone className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{copy.mobileTitle}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{copy.mobileDesc}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => go(ACCOUNTANT_DESKTOP_PATH)}
            className={cn(
              'group flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-4 text-start transition',
              'hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(220_14%_22%)] text-white shadow-sm">
              <Monitor className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{copy.desktopTitle}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{copy.desktopDesc}</span>
            </span>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isFa
            ? 'بعداً هم می‌توانید از منو بین نسخه‌ها جابه‌جا شوید.'
            : 'You can switch versions later from the app.'}
        </p>
      </div>
    </div>
  )
}
