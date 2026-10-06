import type { ManagerPulseKey } from '@/features/manager/lib/overview-types'

export const MANAGER_REMINDER_PREFIX = 'manager_reminder:'

/** Minimum gap between two reminders for the same source, to avoid spamming the site team. */
export const REMINDER_COOLDOWN_MS = 60 * 60 * 1000

/** Positions responsible for each live source; the first key with members wins. */
export const PULSE_ROLES: Record<ManagerPulseKey, string[]> = {
  daily_report: ['site_supervisor', 'site_manager'],
  warehouse: ['storekeeper'],
  hse: ['hse_officer'],
  gate: ['security'],
}

export const REMINDER_COPY: Record<ManagerPulseKey, { title: string; body: string; href: string }> = {
  daily_report: {
    title: 'یادآوری ثبت گزارش روزانه',
    body: 'مدیر پروژه درخواست کرده گزارش روزانهٔ کارگاه را ثبت کنید.',
    href: '/dashboard/site-supervisor/daily-reports',
  },
  warehouse: {
    title: 'یادآوری به‌روزرسانی موجودی انبار',
    body: 'مدیر پروژه درخواست کرده ورود و خروج کالا و موجودی انبار را به‌روز کنید.',
    href: '/dashboard/storekeeper',
  },
  hse: {
    title: 'یادآوری تکمیل چک‌لیست ایمنی',
    body: 'مدیر پروژه درخواست کرده چک‌لیست ایمنی امروز را تکمیل کنید.',
    href: '/dashboard/hse',
  },
  gate: {
    title: 'یادآوری ثبت تردد گیت',
    body: 'مدیر پروژه درخواست کرده وضعیت گیت و ثبت تردد نفرات را بررسی کنید.',
    href: '/dashboard/security',
  },
}

export function isPulseKey(value: unknown): value is ManagerPulseKey {
  return typeof value === 'string' && value in PULSE_ROLES
}
