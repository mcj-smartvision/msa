/**
 * @file app/app-font.ts
 * @purpose ماژول — مسیرها و layout (app-font)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on nothing
 */

import localFont from 'next/font/local'

/** Single UI typeface for the whole app (Persian + Latin from Koloche). */
export const appFont = localFont({
  src: './_fonts/Koloche.WOL.ttf',
  display: 'swap',
  variable: '--font-sans',
  fallback: ['Tahoma', 'ui-sans-serif', 'sans-serif'],
})

/** Canvas/SVG stack: the loaded Koloche face, then system fallbacks. */
export const appFontFamily = appFont.style.fontFamily
