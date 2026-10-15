import type { Metadata } from 'next'
import { LocaleProvider } from '@/shared/components/i18n/locale-provider'
import { ScheduleCalendarProvider } from '@/features/schedule/components/schedule-calendar-provider'
import { appFont } from './app-font'
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
    <html lang={initialLocale} dir={dir} className={appFont.variable} suppressHydrationWarning>
      <body className={`${appFont.className} min-h-screen bg-background font-sans antialiased`}>
        <LocaleProvider initialLocale={initialLocale}>
          <ScheduleCalendarProvider>{children}</ScheduleCalendarProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
