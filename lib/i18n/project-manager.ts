import type { FormLocale } from '@/lib/project-init/i18n/types'

const EN = {
  title: 'Project Manager Dashboard',
  description: 'Project management workspace.',
} as const

const FA = {
  title: 'داشبورد مدیر پروژه',
  description: 'فضای کاری مدیر پروژه.',
} as const

export type ProjectManagerMessages = typeof EN

export function getProjectManagerMessages(locale: FormLocale): typeof EN {
  if (locale === 'fa' || locale === 'ar') return FA
  return EN
}
