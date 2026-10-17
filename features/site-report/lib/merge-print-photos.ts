/**
 * @file features/site-report/lib/merge-print-photos.ts
 * @purpose ادغام عکس‌های آپلود‌شده با پیوست ساختار گزارش برای چاپ
 * @safe-to-edit YES
 * @affects پیش‌نمایش / چاپ A4
 * @depends-on features/site-report/lib/types
 */

import type { SiteReportAttachedPhoto } from '@/features/site-report/lib/types'

/** Prefer live uploaded URLs; fall back to structured attached_photos. */
export function mergePrintPhotos(
  live: SiteReportAttachedPhoto[] | undefined,
  fromReport: SiteReportAttachedPhoto[]
): SiteReportAttachedPhoto[] {
  const fromLive = (live ?? []).filter((p) => typeof p.url === 'string' && p.url.trim())
  if (fromLive.length > 0) return fromLive
  return (fromReport ?? []).filter((p) => typeof p.url === 'string' && p.url.trim())
}
