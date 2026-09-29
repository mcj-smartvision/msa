import { Vazirmatn } from 'next/font/google'

/** Scoped to the manager dashboard; the rest of the app keeps the global font stack. */
export const managerFont = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manager',
  fallback: ['Tahoma', 'ui-sans-serif', 'sans-serif'],
})
