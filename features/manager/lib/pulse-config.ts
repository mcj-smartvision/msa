/**
 * @file features/manager/lib/pulse-config.ts
 * @purpose تنظیمات و برچسب‌ها — داشبورد مدیر پروژه و KPI (pulse-config)
 * @safe-to-edit YES
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on features/manager/lib/overview-types, shared/lib/i18n/make-live-copy
 */

import type { ManagerPulseKey } from '@/features/manager/lib/overview-types'
import { makeLiveCopy } from '@/shared/lib/i18n/make-live-copy'

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

const REMINDER_FA: Record<ManagerPulseKey, { title: string; body: string; href: string }> = {
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

const REMINDER_EN: typeof REMINDER_FA = {
  daily_report: {
    title: 'Reminder: record daily report',
    body: 'The project manager asked you to record the site daily report.',
    href: '/dashboard/site-supervisor/daily-reports',
  },
  warehouse: {
    title: 'Reminder: update warehouse stock',
    body: 'The project manager asked you to update receipts, issues and warehouse stock.',
    href: '/dashboard/storekeeper',
  },
  hse: {
    title: 'Reminder: complete safety checklist',
    body: 'The project manager asked you to complete today’s safety checklist.',
    href: '/dashboard/hse',
  },
  gate: {
    title: 'Reminder: record gate traffic',
    body: 'The project manager asked you to review the gate and record person traffic.',
    href: '/dashboard/security',
  },
}

export const REMINDER_COPY = makeLiveCopy({
  fa: REMINDER_FA,
  en: REMINDER_EN as unknown as typeof REMINDER_FA,
})

export function isPulseKey(value: unknown): value is ManagerPulseKey {
  return typeof value === 'string' && value in PULSE_ROLES
}
