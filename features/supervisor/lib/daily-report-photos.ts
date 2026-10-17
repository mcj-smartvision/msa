/**
 * @file features/supervisor/lib/daily-report-photos.ts
 * @purpose منطق دامنه — عکس‌های گزارش روزانه سرپرست
 * @safe-to-edit YES
 * @affects تب ثبت گزارش روزانه و تاریخچه
 * @depends-on nothing
 */

export const DAILY_REPORT_PHOTO_BUCKET = 'daily-reports' as const

export const DAILY_REPORT_PHOTO_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxCount: 20,
  accept: 'image/jpeg,image/png,image/webp',
} as const

export type DailyReportPhotoItem = {
  id: string
  dailyReportId: string
  reportNo: string
  reportDate: string
  fileName: string
  contentType: string | null
  byteSize: number | null
  url: string
  createdAt: string
  /** Caption shown on printable report */
  caption?: string | null
  /** Tag to activity / zone / location — not a bulk gallery */
  linkedActivityOrLocation?: string | null
}

export function buildDailyReportNo(reportDate: string, reportId: string): string {
  const ymd = reportDate.replace(/-/g, '')
  const short = reportId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `DR-${ymd}-${short}`
}

export function dailyReportPhotoStoragePath(params: {
  projectId: string
  reportDate: string
  reportId: string
  photoId: string
  ext: string
}): string {
  return `${params.projectId}/${params.reportDate}/${params.reportId}/${params.photoId}.${params.ext}`
}

export function validateDailyReportPhotoFile(file: File): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return 'format'
  }
  if (file.size > DAILY_REPORT_PHOTO_LIMITS.maxBytes) {
    return 'size'
  }
  return null
}

export function photoFileExt(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}
