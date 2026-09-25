import type { PaceStatus } from '@/lib/schedule/progress-pace'

export type AlertQuadrant = 'urgent' | 'normal_watch' | 'soft_notice' | 'no_display'

export type AlertQuadrantInput = {
  paceStatus: PaceStatus | null
  isCritical?: boolean | null
  totalFloatDays?: number | null
  nearCriticalDays: number
}

/** بحرانی یا نزدیک‌بحرانی (مسیر بحرانی یا شناوری ≤ آستانه). */
export function isCriticalOrNearCritical(
  isCritical: boolean | null | undefined,
  totalFloatDays: number | null | undefined,
  nearCriticalDays: number
): boolean {
  if (isCritical) return true
  if (totalFloatDays == null || !Number.isFinite(Number(totalFloatDays))) return false
  return Number(totalFloatDays) <= nearCriticalDays
}

function paceIsSlow(paceStatus: PaceStatus | null): boolean {
  return paceStatus === 'bad' || paceStatus === 'warning'
}

/**
 * ۲×۲: اهمیت (شناوری) × نرخ پیشروی — فقط وقتی paceStatus معنا دارد (در حال اجرا).
 */
export function computeAlertQuadrant(input: AlertQuadrantInput): AlertQuadrant | null {
  const { paceStatus, nearCriticalDays } = input
  if (paceStatus == null) return null

  const criticalZone = isCriticalOrNearCritical(
    input.isCritical,
    input.totalFloatDays,
    nearCriticalDays
  )
  const slow = paceIsSlow(paceStatus)
  const good = paceStatus === 'good'

  if (criticalZone) {
    if (slow) return 'urgent'
    if (good) return 'normal_watch'
    return null
  }

  if (slow) return 'soft_notice'
  if (good) return 'no_display'
  return null
}

export function alertQuadrantFa(q: AlertQuadrant | null | undefined): string {
  switch (q) {
    case 'urgent':
      return 'فوری'
    case 'normal_watch':
      return 'پایش عادی'
    case 'soft_notice':
      return 'اطلاع‌رسانی ملایم'
    case 'no_display':
      return 'بدون نمایش'
    default:
      return '—'
  }
}

export function alertQuadrantRowClass(q: AlertQuadrant | null | undefined): string {
  switch (q) {
    case 'urgent':
      return 'bg-rose-100/90 border-s-4 border-s-rose-600'
    case 'normal_watch':
      return 'bg-slate-100/90 border-s-4 border-s-slate-500'
    case 'soft_notice':
      return 'bg-amber-50/90 border-s-4 border-s-amber-400'
    case 'no_display':
      return 'bg-emerald-50/40'
    default:
      return ''
  }
}
