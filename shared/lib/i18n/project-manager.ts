/**
 * @file shared/lib/i18n/project-manager.ts
 * @purpose تنظیمات و برچسب‌ها — زیرساخت مشترک سامانه (project-manager)
 * @safe-to-edit YES
 * @affects زیرساخت مشترک سامانه
 * @depends-on features/project-init/lib/i18n/types
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'

export type ProjectManagerMessages = {
  title: string
  description: string
  executiveTitle: string
  refresh: string
  loading: string
  asOf: (isoDate: string) => string
  evmLoadFailed: string
  emptyAssign: string
}

const EN: ProjectManagerMessages = {
  title: 'Project Manager Dashboard',
  description: 'Project management workspace.',
  executiveTitle: 'Project health',
  refresh: 'Refresh',
  loading: 'Loading EVM indicators…',
  asOf: (isoDate) => `As of ${isoDate}`,
  evmLoadFailed: 'Failed to load EVM indicators',
  emptyAssign: 'Ask an admin to assign you as Project Manager on a project.',
}

const FA: ProjectManagerMessages = {
  title: 'داشبورد مدیر پروژه',
  description: 'فضای کاری مدیر پروژه.',
  executiveTitle: 'سلامت پروژه',
  refresh: 'بروزرسانی',
  loading: 'در حال محاسبهٔ شاخص‌های EVM…',
  asOf: (isoDate) =>
    `تا تاریخ ${new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('fa-IR-u-ca-persian-nu-latn')}`,
  evmLoadFailed: 'بارگذاری شاخص‌های EVM ناموفق بود',
  emptyAssign: 'از ادمین بخواهید شما را به‌عنوان مدیر پروژه روی یک پروژه منصوب کند.',
}

export function getProjectManagerMessages(locale: FormLocale): ProjectManagerMessages {
  if (locale === 'fa' || locale === 'ar') return FA
  return EN
}
