/**
 * @file app/layout.tsx
 * @purpose کامپوننت UI — مسیرها و layout (layout)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/components/i18n/locale-provider, features/schedule/components/schedule-calendar-provider
 */

import type { Metadata } from 'next'
import { LocaleProvider } from '@/shared/components/i18n/locale-provider'
import { ScheduleCalendarProvider } from '@/features/schedule/components/schedule-calendar-provider'
import { appFont } from './app-font'
import { APP_NAME, APP_PRODUCT_LINE } from '@/shared/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_PRODUCT_LINE,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Temporary: force Persian UI (locale switch cleanup later)
  const initialLocale = 'fa'
  const dir = 'rtl'

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
