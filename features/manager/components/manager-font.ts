import { Vazirmatn } from 'next/font/google'

/**
 * Manager dashboard is data-dense (KPIs, gauges, charts).
 * Koloche is a single-weight display face and reads as bold/overlapping here,
 * so this shell uses Vazirmatn with real 400–700 weights.
 */
export const managerFont = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-manager',
})
