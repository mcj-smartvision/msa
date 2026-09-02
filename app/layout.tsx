import type { Metadata } from 'next'
import { LocaleProvider } from '@/components/i18n/locale-provider'
import { ScheduleCalendarProvider } from '@/components/schedule/schedule-calendar-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'MSA',
  description: 'آمادگی کنترل و عملیات کارگاه',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Temporary: force Persian UI (locale switch cleanup later)
  const initialLocale = 'fa'
  const dir = 'rtl'

  return (
    <html lang={initialLocale} dir={dir} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <LocaleProvider initialLocale={initialLocale}>
          <ScheduleCalendarProvider>{children}</ScheduleCalendarProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
