/**
 * @file app/layout.tsx
 * @purpose کامپوننت UI — مسیرها و layout (layout)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/components/i18n/locale-provider, features/schedule/components/schedule-calendar-provider, shared/lib/i18n/locale-cookie
 */

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LocaleProvider } from '@/shared/components/i18n/locale-provider'
import { ScheduleCalendarProvider } from '@/features/schedule/components/schedule-calendar-provider'
import { LOCALE_COOKIE } from '@/shared/lib/i18n/locale-cookie'
import { isRtlLocale, normalizeLocale } from '@/features/project-init/lib/i18n/utils'
import { appFont } from './app-font'
import { APP_NAME, APP_PRODUCT_LINE } from '@/shared/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_PRODUCT_LINE,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const initialLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value)
  const dir = isRtlLocale(initialLocale) ? 'rtl' : 'ltr'

  return (
    <html lang={initialLocale} dir={dir} className={appFont.variable} suppressHydrationWarning>
      <body className={`${appFont.className} min-h-screen bg-background font-sans antialiased`}>
        <LocaleProvider initialLocale={initialLocale}>
          <ScheduleCalendarProvider>{children}</ScheduleCalendarProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
