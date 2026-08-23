import type { Metadata } from 'next'
import { Vazirmatn } from 'next/font/google'
import { LocaleProvider } from '@/components/i18n/locale-provider'
import { ScheduleCalendarProvider } from '@/components/schedule/schedule-calendar-provider'
import './globals.css'

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MSA',
  description: 'آمادگی کنترل و عملیات کارگاه',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Temporary: force Persian UI (locale switch cleanup later)
  const initialLocale = 'fa'
  const dir = 'rtl'

  return (
    <html lang={initialLocale} dir={dir} className={vazirmatn.variable} suppressHydrationWarning>
      <body className={`${vazirmatn.className} min-h-screen bg-background font-sans antialiased`}>
        <LocaleProvider initialLocale={initialLocale}>
          <ScheduleCalendarProvider>{children}</ScheduleCalendarProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
