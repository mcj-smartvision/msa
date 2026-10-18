/**
 * @file app/(dashboard)/dashboard/daily-report/page.tsx
 * @purpose مسیر موقت فرم گزارش روزانه ساختاریافته (SDR) — تا تکمیل گام ۳
 * @safe-to-edit YES
 * @affects /dashboard/daily-report
 * @depends-on shared/lib/i18n/pick-messages, shared/lib/i18n/locale-cookie
 */

import { cookies } from 'next/headers'
import { normalizeLocale } from '@/features/project-init/lib/i18n/utils'
import { LOCALE_COOKIE } from '@/shared/lib/i18n/locale-cookie'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

const FA = {
  title: 'گزارش روزانه سرپرست',
  body: 'مسیر آماده است. فرم کامل در گام ۳ ساخته می‌شود. پنل فعلی سرپرست کارگاه تغییر نکرده است.',
  back: 'بازگشت به داشبورد سرپرست',
}

const EN = {
  title: 'Supervisor daily report',
  body: 'Route is ready. The full form ships in step 3. The current site-supervisor panel is unchanged.',
  back: 'Back to supervisor dashboard',
}

export default async function DailyReportStubPage() {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)
  const copy = pickMessages(locale, { fa: FA, en: EN, de: EN })
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">{copy.title}</h1>
      <p className="text-sm leading-6 text-slate-600">{copy.body}</p>
      <a
        href="/dashboard/site-supervisor"
        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {copy.back}
      </a>
    </div>
  )
}
